from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
import pandas as pd


DEFAULT_LATITUDE = 10.790861
DEFAULT_LONGITUDE = 106.6313
DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"
HOURLY_WEATHER_FIELDS = (
    "temperature_2m", "relative_humidity_2m", "precipitation", "rain",
    "weather_code", "wind_speed_10m", "wind_gusts_10m",
)


class WeatherProviderError(RuntimeError):
    """Unavailable/invalid upstream weather, not invalid Parent demographics."""

    code = "WEATHER_DATA_UNAVAILABLE"
    message = "Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại."

    def __init__(self) -> None:
        super().__init__(self.message)


CATEGORICAL_FEATURES = ("age_group", "gender", "season")
CALENDAR_FEATURES = (
    "age_group",
    "gender",
    "month",
    "season",
    "day_of_year_sin",
    "day_of_year_cos",
)


def month_to_season(month: int) -> str:
    value = int(month)
    if value in {12, 1, 2, 3, 4}:
        return "Mùa khô"
    if value in {5, 6, 7, 8, 9, 10, 11}:
        return "Mùa mưa"
    raise ValueError(f"Tháng không hợp lệ: {month}")


def _mode_or_nan(series: pd.Series) -> float:
    values = series.dropna()
    return float(values.mode().iloc[0]) if not values.empty else float("nan")


@dataclass(frozen=True)
class PreparedFeatures:
    encoded: pd.DataFrame
    raw: dict[str, Any]
    weather_meta: dict[str, Any]
    anchor_date: date


class WeatherFeatureBuilder:
    """Build the exact locked V3 current/3d/7d feature vector."""

    def __init__(
        self,
        feature_order: list[str],
        category_mappings: dict[str, dict[str, int]],
    ) -> None:
        self.feature_order = list(feature_order)
        self.category_mappings = category_mappings
        if tuple(self.feature_order[: len(CALENDAR_FEATURES)]) != CALENDAR_FEATURES:
            raise ValueError("Feature manifest không bắt đầu bằng contract calendar/demographic V3.")
        self.weather_features = self.feature_order[len(CALENDAR_FEATURES) :]

    @staticmethod
    def _normalize_option(value: str, valid_values: list[str], field_name: str) -> str:
        normalized = str(value or "").strip()
        if not normalized:
            raise ValueError(f"Thiếu {field_name}.")
        if normalized in valid_values:
            return normalized
        lookup = {item.casefold(): item for item in valid_values}
        match = lookup.get(normalized.casefold())
        if match is not None:
            return match
        raise ValueError(
            f"{field_name} không hợp lệ: {value!r}. Giá trị hợp lệ: {', '.join(valid_values)}"
        )

    @staticmethod
    def _hourly_frame(
        hourly: dict[str, list[Any]],
        timezone: str = DEFAULT_TIMEZONE,
        target_date: date | None = None,
    ) -> pd.DataFrame:
        required = ("time", *HOURLY_WEATHER_FIELDS)
        if not isinstance(hourly, dict):
            raise ValueError("Open-Meteo không trả hourly object hợp lệ.")
        missing = [column for column in required if column not in hourly]
        if missing:
            raise ValueError(f"Open-Meteo thiếu hourly fields: {missing}")
        if any(not isinstance(hourly[column], list) for column in required):
            raise ValueError("Open-Meteo hourly fields phải là các mảng.")
        if not hourly["time"] or any(not isinstance(value, str) for value in hourly["time"]):
            raise ValueError("Open-Meteo không trả timestamp hợp lệ.")
        frame = pd.DataFrame({column: hourly[column] for column in required})
        timestamps = pd.DatetimeIndex(pd.to_datetime(frame["time"], format="ISO8601", errors="raise"))
        zone = ZoneInfo(timezone)
        if timestamps.tz is not None:
            local = timestamps.tz_convert(zone).tz_localize(None)
            if not local.equals(timestamps.tz_localize(None)):
                raise ValueError("Open-Meteo timestamp không đúng múi giờ đã yêu cầu.")
            timestamps = local
        else:
            # Provider ISO timestamps are local wall-clock times; metadata is
            # checked by _fetch_open_meteo before reaching this parser.
            timestamps.tz_localize(zone, ambiguous="raise", nonexistent="raise")
        frame["time"] = timestamps
        for column in HOURLY_WEATHER_FIELDS:
            if any(isinstance(value, bool) for value in hourly[column]):
                raise ValueError("Open-Meteo weather không chấp nhận giá trị boolean.")
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        return WeatherFeatureBuilder._complete_hourly_window(frame, target_date)

    @staticmethod
    def _complete_hourly_window(frame: pd.DataFrame, target_date: date | None = None) -> pd.DataFrame:
        """Validate before any aggregation can skip missing data or invent zero."""
        if frame.empty or any(column not in frame for column in ("time", *HOURLY_WEATHER_FIELDS)):
            raise ValueError("Thiếu hourly weather bắt buộc.")
        timestamps = pd.DatetimeIndex(frame["time"])
        if timestamps.hasnans or timestamps.tz is not None:
            raise ValueError("Timestamp hourly phải là thời gian local hợp lệ.")
        if timestamps.has_duplicates or not timestamps.is_monotonic_increasing:
            raise ValueError("Timestamp hourly trùng hoặc sai thứ tự.")
        if not timestamps.equals(timestamps.floor("h")):
            raise ValueError("Timestamp hourly không nằm đúng đầu giờ.")
        anchor = pd.Timestamp(target_date).normalize() if target_date else timestamps[-1].normalize()
        expected = pd.date_range(anchor - pd.Timedelta(days=6), periods=168, freq="h")
        selected = frame.loc[(timestamps >= expected[0]) & (timestamps <= expected[-1])].copy()
        if not pd.DatetimeIndex(selected["time"]).equals(expected):
            raise ValueError("Weather D−6 đến D phải có đủ 168 giờ, 24 giờ mỗi ngày.")
        try:
            finite = np.isfinite(selected[list(HOURLY_WEATHER_FIELDS)].to_numpy(dtype=float)).all()
        except (TypeError, ValueError) as exc:
            raise ValueError("Hourly weather phải là số hữu hạn.") from exc
        if not finite:
            raise ValueError("Hourly weather thiếu giá trị hoặc chứa NaN/infinite.")
        return selected.reset_index(drop=True)

    @staticmethod
    def _daily_from_hourly(hourly: pd.DataFrame) -> pd.DataFrame:
        frame = WeatherFeatureBuilder._complete_hourly_window(hourly)
        frame["date"] = frame["time"].dt.normalize()
        daily = (
            frame.groupby("date", as_index=False)
            .agg(
                temperature_mean_daily=("temperature_2m", "mean"),
                temperature_max_daily=("temperature_2m", "max"),
                temperature_min_daily=("temperature_2m", "min"),
                humidity_mean_daily=("relative_humidity_2m", "mean"),
                humidity_max_daily=("relative_humidity_2m", "max"),
                humidity_min_daily=("relative_humidity_2m", "min"),
                weather_code_daily=("weather_code", _mode_or_nan),
                wind_speed_mean_daily=("wind_speed_10m", "mean"),
                wind_speed_max_daily=("wind_speed_10m", "max"),
                precipitation_sum_daily=("precipitation", "sum"),
                rain_sum_daily=("rain", "sum"),
                wind_gust_max_daily=("wind_gusts_10m", "max"),
            )
            .sort_values("date", kind="mergesort")
            .reset_index(drop=True)
        )
        return daily

    @staticmethod
    def _daily_from_manual(rows: list[dict[str, Any]]) -> pd.DataFrame:
        if not isinstance(rows, list) or len(rows) < 7:
            raise ValueError("Manual weather.daily phải có ít nhất 7 ngày liên tiếp.")
        aliases = {
            "temperature_mean": "temperature_mean_daily",
            "temperature_max": "temperature_max_daily",
            "temperature_min": "temperature_min_daily",
            "humidity_mean": "humidity_mean_daily",
            "humidity_max": "humidity_max_daily",
            "humidity_min": "humidity_min_daily",
            "weather_code": "weather_code_daily",
            "wind_speed_mean": "wind_speed_mean_daily",
            "wind_speed_max": "wind_speed_max_daily",
            "precipitation_sum": "precipitation_sum_daily",
            "rain_sum": "rain_sum_daily",
            "wind_gust_max": "wind_gust_max_daily",
        }
        normalized: list[dict[str, Any]] = []
        for item in rows:
            row = dict(item)
            normalized.append(
                {
                    "date": row.get("date"),
                    **{
                        destination: row.get(destination, row.get(source))
                        for source, destination in aliases.items()
                    },
                }
            )
        daily = pd.DataFrame(normalized)
        daily["date"] = pd.to_datetime(daily["date"], errors="coerce").dt.normalize()
        required = ["date", *aliases.values()]
        for column in required[1:]:
            daily[column] = pd.to_numeric(daily[column], errors="coerce")
        if daily[required].isna().any().any():
            raise ValueError("Manual weather.daily thiếu trường daily aggregate bắt buộc.")
        return daily.sort_values("date", kind="mergesort").reset_index(drop=True)

    @staticmethod
    def _weather_feature_frame(daily: pd.DataFrame) -> pd.DataFrame:
        if daily.empty:
            raise ValueError("Không có daily weather để tạo feature.")
        expected = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
        if not pd.DatetimeIndex(daily["date"]).equals(expected):
            raise ValueError("Weather history phải là chuỗi ngày liên tục.")
        features = pd.DataFrame({"anchor_date": daily["date"]})
        current_map = {
            "weather_code_daily": "weather_code_current",
            "temperature_mean_daily": "temperature_mean_current",
            "temperature_max_daily": "temperature_max_current",
            "temperature_min_daily": "temperature_min_current",
            "humidity_mean_daily": "humidity_mean_current",
            "humidity_max_daily": "humidity_max_current",
            "humidity_min_daily": "humidity_min_current",
            "wind_speed_mean_daily": "wind_speed_mean_current",
            "wind_speed_max_daily": "wind_speed_max_current",
            "precipitation_sum_daily": "precipitation_sum_current",
            "rain_sum_daily": "rain_sum_current",
            "wind_gust_max_daily": "wind_gust_max_current",
        }
        if any(column not in daily for column in current_map):
            raise ValueError("Thiếu daily weather bắt buộc.")
        if not np.isfinite(daily[list(current_map)].to_numpy(dtype=float)).all():
            raise ValueError("Daily weather phải đầy đủ và hữu hạn trước khi tạo features.")
        for source, destination in current_map.items():
            features[destination] = daily[source].to_numpy()
        features["rain_day_current"] = (daily["rain_sum_daily"] > 0).astype("int8")
        for window in (3, 7):
            suffix = f"{window}d"
            features[f"temperature_mean_{suffix}"] = daily["temperature_mean_daily"].rolling(window, min_periods=window).mean()
            features[f"temperature_max_{suffix}"] = daily["temperature_max_daily"].rolling(window, min_periods=window).max()
            features[f"temperature_min_{suffix}"] = daily["temperature_min_daily"].rolling(window, min_periods=window).min()
            features[f"humidity_mean_{suffix}"] = daily["humidity_mean_daily"].rolling(window, min_periods=window).mean()
            features[f"humidity_max_{suffix}"] = daily["humidity_max_daily"].rolling(window, min_periods=window).max()
            features[f"humidity_min_{suffix}"] = daily["humidity_min_daily"].rolling(window, min_periods=window).min()
            features[f"wind_speed_mean_{suffix}"] = daily["wind_speed_mean_daily"].rolling(window, min_periods=window).mean()
            features[f"wind_speed_max_{suffix}"] = daily["wind_speed_max_daily"].rolling(window, min_periods=window).max()
            features[f"precipitation_sum_{suffix}"] = daily["precipitation_sum_daily"].rolling(window, min_periods=window).sum()
            features[f"rain_sum_{suffix}"] = daily["rain_sum_daily"].rolling(window, min_periods=window).sum()
            features[f"rain_days_{suffix}"] = (daily["rain_sum_daily"] > 0).rolling(window, min_periods=window).sum()
            features[f"rain_max_daily_{suffix}"] = daily["rain_sum_daily"].rolling(window, min_periods=window).max()
            features[f"wind_gust_max_{suffix}"] = daily["wind_gust_max_daily"].rolling(window, min_periods=window).max()
        numeric = [column for column in features.columns if column not in {"anchor_date", "weather_code_current"}]
        features[numeric] = features[numeric].round(6)
        return features

    @staticmethod
    def _daily_series(daily: pd.DataFrame) -> list[dict[str, Any]]:
        output: list[dict[str, Any]] = []
        for row in daily.tail(7).to_dict(orient="records"):
            output.append(
                {
                    "date": str(pd.Timestamp(row["date"]).date()),
                    "temperature_mean": float(row["temperature_mean_daily"]),
                    "humidity_mean": float(row["humidity_mean_daily"]),
                    "rain_sum": float(row["rain_sum_daily"]),
                    "precipitation_sum": float(row["precipitation_sum_daily"]),
                }
            )
        return output

    def _select_from_daily(
        self, daily: pd.DataFrame, target_date: date | None
    ) -> tuple[dict[str, float], date, list[dict[str, Any]]]:
        features = self._weather_feature_frame(daily)
        anchor = pd.Timestamp(target_date).normalize() if target_date else features["anchor_date"].max()
        selected = features.loc[features["anchor_date"] == anchor]
        if selected.empty:
            raise ValueError(f"Không có weather cho ngày {anchor.date()}.")
        row = selected.iloc[0]
        missing = [column for column in self.weather_features if column not in row or pd.isna(row[column])]
        if missing:
            raise ValueError(
                "Không đủ 7 ngày weather hoàn chỉnh cho feature V3: " + ", ".join(missing[:8])
            )
        return (
            {column: float(row[column]) for column in self.weather_features},
            anchor.date(),
            self._daily_series(daily.loc[daily["date"] <= anchor]),
        )

    def _fetch_open_meteo(
        self,
        latitude: float,
        longitude: float,
        timezone: str,
        target_date: date | None,
    ) -> tuple[dict[str, float], date, dict[str, Any]]:
        if not -90 <= float(latitude) <= 90 or not -180 <= float(longitude) <= 180:
            raise ValueError("Latitude/longitude không hợp lệ.")
        try:
            zone = ZoneInfo(timezone)
        except (ZoneInfoNotFoundError, ValueError, TypeError) as exc:
            raise ValueError("Múi giờ không hợp lệ.") from exc
        # D remains the requested/current local day, including forecast hours
        # later in D. Never silently move D to yesterday if today's data is absent.
        anchor_date = target_date or datetime.now(zone).date()
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(
                (
                    "temperature_2m",
                    "relative_humidity_2m",
                    "precipitation",
                    "rain",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_gusts_10m",
                )
            ),
            "past_days": 6,
            "forecast_days": 1,
            "timezone": timezone,
        }
        url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(url, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict) or payload.get("timezone") != timezone:
                raise ValueError("Open-Meteo timezone metadata không khớp yêu cầu.")
            frame = self._hourly_frame(payload.get("hourly", {}), timezone, anchor_date)
            daily = self._daily_from_hourly(frame)
            values, anchor, series = self._select_from_daily(daily, anchor_date)
        except Exception as exc:
            raise WeatherProviderError() from exc
        return values, anchor, {
            "source": "open_meteo",
            "latitude": float(latitude),
            "longitude": float(longitude),
            "timezone": timezone,
            "date": str(anchor),
            "daily_series": series,
        }

    def _manual_weather(
        self, weather: dict[str, Any], target_date: date | None
    ) -> tuple[dict[str, float], date, dict[str, Any]]:
        direct = all(column in weather for column in self.weather_features)
        if direct:
            anchor_value = target_date or weather.get("anchor_date") or weather.get("date")
            if anchor_value is None:
                raise ValueError("Manual feature vector cần target_date hoặc weather.anchor_date.")
            anchor = pd.Timestamp(anchor_value).date()
            try:
                values = {column: float(weather[column]) for column in self.weather_features}
            except (TypeError, ValueError) as exc:
                raise ValueError("Manual weather feature phải là số.") from exc
            return values, anchor, {"source": "manual_locked_features", "date": str(anchor), "daily_series": []}
        if isinstance(weather.get("daily"), list):
            daily = self._daily_from_manual(weather["daily"])
            values, anchor, series = self._select_from_daily(daily, target_date)
            return values, anchor, {"source": "manual_daily_history", "date": str(anchor), "daily_series": series}
        raise ValueError(
            "Manual weather phải chứa đủ 39 weather feature theo manifest hoặc weather.daily gồm ít nhất 7 ngày."
        )

    def prepare(
        self,
        age_group: str,
        gender: str,
        weather: dict[str, Any] | None,
        latitude: float | None,
        longitude: float | None,
        timezone: str,
        target_date: date | None,
    ) -> PreparedFeatures:
        age = self._normalize_option(age_group, list(self.category_mappings["age_group"]), "age_group")
        sex = self._normalize_option(gender, list(self.category_mappings["gender"]), "gender")
        if weather:
            weather_values, anchor, meta = self._manual_weather(dict(weather), target_date)
        else:
            if latitude is None or longitude is None:
                raise ValueError("Cần latitude và longitude khi dùng weather realtime.")
            weather_values, anchor, meta = self._fetch_open_meteo(latitude, longitude, timezone, target_date)
        month = int(anchor.month)
        day = int(anchor.timetuple().tm_yday)
        raw: dict[str, Any] = {
            "age_group": age,
            "gender": sex,
            "month": month,
            "season": month_to_season(month),
            "day_of_year_sin": math.sin(2 * math.pi * day / 365.25),
            "day_of_year_cos": math.cos(2 * math.pi * day / 365.25),
            **weather_values,
        }
        if list(raw) != self.feature_order:
            raise RuntimeError("Feature order runtime không khớp manifest V3.")
        encoded = dict(raw)
        for column in CATEGORICAL_FEATURES:
            encoded[column] = self.category_mappings[column].get(str(raw[column]), -1)
        frame = pd.DataFrame([[encoded[column] for column in self.feature_order]], columns=self.feature_order)
        for column in self.feature_order:
            frame[column] = pd.to_numeric(frame[column], errors="raise")
        if frame.isna().any().any() or not np.isfinite(frame.to_numpy(dtype=float)).all():
            raise ValueError("Feature runtime có giá trị thiếu hoặc không hữu hạn.")
        return PreparedFeatures(encoded=frame, raw=raw, weather_meta=meta, anchor_date=anchor)
