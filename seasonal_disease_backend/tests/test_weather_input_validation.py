"""Offline W01/W02 regression: real locked models, mocked provider, isolated DB."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from unittest.mock import Mock

import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import ParentDiseaseVisibilityAudit, ParentDiseaseVisibilitySetting
from app.routers.public import router as public_router
from app.routers.weather_ai import router as admin_router
from app.services.weather_ai_features import (
    DEFAULT_TIMEZONE, HOURLY_WEATHER_FIELDS, WeatherFeatureBuilder, WeatherProviderError,
)

ANCHOR = date(2026, 8, 7)


@pytest.fixture
def hourly():
    times = pd.date_range('2026-08-01', periods=168, freq='h')
    return {
        'time': times.strftime('%Y-%m-%dT%H:%M').tolist(),
        'temperature_2m': [24 + (i % 24) / 4 for i in range(168)],
        'relative_humidity_2m': [60 + i % 20 for i in range(168)],
        'precipitation': [float(i % 3) for i in range(168)],
        'rain': [float(i % 2) for i in range(168)],
        'weather_code': [2] * 168,
        'wind_speed_10m': [4 + i % 6 for i in range(168)],
        'wind_gusts_10m': [10 + i % 7 for i in range(168)],
    }


@pytest.fixture
def provider(monkeypatch, hourly):
    payload = {'timezone': DEFAULT_TIMEZONE, 'hourly': hourly}

    class Response:
        def __enter__(self): return self
        def __exit__(self, *_args): return False
        def read(self): return json.dumps(payload).encode('utf-8')

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 8, 7, 12, tzinfo=tz)

    monkeypatch.setattr('app.services.weather_ai_features.datetime', FixedDatetime)
    monkeypatch.setattr('app.services.weather_ai_features.urllib.request.urlopen', lambda *_args, **_kwargs: Response())
    return payload


def test_complete_168_hours_preserve_pre_fix_45_features_ranking_and_shap(provider, runtime_service):
    baseline = json.loads((Path(__file__).parent / 'fixtures/weather_input_valid_baseline.json').read_text(encoding='utf-8'))
    prepared = runtime_service.feature_builder.prepare(
        baseline['age_group'], baseline['gender'], None, 10.79, 106.63, DEFAULT_TIMEZONE, None,
    )
    assert list(prepared.encoded.columns) == baseline['feature_order']
    np.testing.assert_array_equal(prepared.encoded.iloc[0].to_numpy(), baseline['encoded'])
    result = runtime_service.predict(baseline['age_group'], baseline['gender'], top_k=5)
    # SHAP presentation may add full display data and correct summary wording.
    # Every legacy score/factor/value/order/Tier-2 field stays exactly locked.
    for actual, expected in zip(result['predictions'], baseline['predictions'], strict=True):
        legacy = {**actual, 'tier1': dict(actual['tier1'])}
        display = legacy['tier1'].pop('display_factors')
        assert len(display) <= 45
        assert all(abs(factor['shap_value']) > 1e-12 for factor in display)
        assert 'điểm AI' in legacy['tier1']['summary_vi']
        legacy['tier1']['summary_vi'] = expected['tier1']['summary_vi']
        assert legacy == expected
    assert result['context']['anchor_date'] == baseline['anchor_date']
    assert result['context']['horizon'] == 'H14'
    assert result['model']['model_count'] == 221


def test_real_zero_rain_is_valid(provider, runtime_service):
    provider['hourly']['rain'] = [0] * 168
    provider['hourly']['precipitation'] = [0] * 168
    values, _, _ = runtime_service.feature_builder._fetch_open_meteo(10.79, 106.63, DEFAULT_TIMEZONE, None)
    assert values['rain_sum_7d'] == values['precipitation_sum_7d'] == values['rain_days_7d'] == 0


@pytest.mark.parametrize('field', HOURLY_WEATHER_FIELDS)
@pytest.mark.parametrize('bad_value', [None, float('nan'), float('inf'), float('-inf'), 'not-a-number'])
def test_no_required_hourly_value_can_be_missing_or_nonfinite(hourly, field, bad_value):
    hourly[field][80] = bad_value
    with pytest.raises(ValueError):
        WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR)


@pytest.mark.parametrize('field', ['rain', 'precipitation'])
def test_all_null_rain_never_becomes_zero(hourly, field):
    hourly[field] = [None] * 168
    with pytest.raises(ValueError):
        WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR)


def test_one_hour_per_day_is_not_seven_complete_days(hourly):
    sparse = {key: values[::24] for key, values in hourly.items()}
    with pytest.raises(ValueError, match='168'):
        WeatherFeatureBuilder._hourly_frame(sparse, target_date=ANCHOR)


def test_every_required_hour_is_checked_including_window_edges(hourly):
    for missing_index in range(168):
        broken = {key: values[:missing_index] + values[missing_index + 1:] for key, values in hourly.items()}
        with pytest.raises(ValueError, match='168'):
            WeatherFeatureBuilder._hourly_frame(broken, target_date=ANCHOR)


@pytest.mark.parametrize('kind', ['duplicate', 'reverse', 'invalid', 'null', 'not-hour-boundary', 'wrong-offset'])
def test_invalid_timestamp_contract_is_rejected(hourly, kind):
    if kind == 'duplicate': hourly['time'][50] = hourly['time'][49]
    elif kind == 'reverse': hourly['time'][50], hourly['time'][51] = hourly['time'][51], hourly['time'][50]
    elif kind == 'invalid': hourly['time'][50] = 'not-a-timestamp'
    elif kind == 'null': hourly['time'][50] = None
    elif kind == 'not-hour-boundary': hourly['time'][50] = '2026-08-03T02:30'
    else: hourly['time'] = [value + '+00:00' for value in hourly['time']]
    with pytest.raises(ValueError):
        WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR)


def test_explicit_correct_timezone_offset_is_accepted(hourly):
    hourly['time'] = [value + '+07:00' for value in hourly['time']]
    frame = WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR)
    assert len(frame) == 168
    assert str(frame['time'].dt.tz) == 'None'


def test_daily_aggregation_cannot_bypass_validation(hourly):
    frame = WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR)
    frame['rain'] = float('nan')
    with pytest.raises(ValueError):
        WeatherFeatureBuilder._daily_from_hourly(frame)


def test_full_D_forecast_hours_are_kept_not_cut_at_current_noon(provider, runtime_service):
    provider['hourly']['temperature_2m'][-24:] = [20.0] * 12 + [40.0] * 12
    values, anchor, _ = runtime_service.feature_builder._fetch_open_meteo(10.79, 106.63, DEFAULT_TIMEZONE, None)
    assert anchor == ANCHOR
    assert values['temperature_mean_current'] == 30.0


def test_missing_entire_current_day_does_not_silently_shift_D(provider, runtime_service):
    provider['hourly'] = {key: values[:-24] for key, values in provider['hourly'].items()}
    with pytest.raises(WeatherProviderError):
        runtime_service.feature_builder._fetch_open_meteo(10.79, 106.63, DEFAULT_TIMEZONE, None)


@pytest.mark.parametrize('kind', ['missing-field', 'wrong-length', 'wrong-timezone', 'missing-timezone', 'empty', 'null', 'nonfinite'])
def test_provider_malformed_data_is_distinct_from_parent_input(provider, runtime_service, kind):
    if kind == 'missing-field': del provider['hourly']['rain']
    elif kind == 'wrong-length': provider['hourly']['rain'].pop()
    elif kind == 'wrong-timezone': provider['timezone'] = 'UTC'
    elif kind == 'missing-timezone': del provider['timezone']
    elif kind == 'empty': provider['hourly'] = {}
    elif kind == 'null': provider['hourly'] = None
    else: provider['hourly']['temperature_2m'][-1] = float('inf')
    with pytest.raises(WeatherProviderError) as caught:
        runtime_service.feature_builder._fetch_open_meteo(10.79, 106.63, DEFAULT_TIMEZONE, None)
    assert caught.value.code == 'WEATHER_DATA_UNAVAILABLE'
    assert 'Vui lòng thử lại' in str(caught.value)


def test_network_timeout_is_a_safe_provider_error(provider, monkeypatch, runtime_service):
    def fail(*_args, **_kwargs): raise TimeoutError('PRIVATE UPSTREAM DETAILS')
    monkeypatch.setattr('app.services.weather_ai_features.urllib.request.urlopen', fail)
    with pytest.raises(WeatherProviderError) as caught:
        runtime_service.feature_builder._fetch_open_meteo(10.79, 106.63, DEFAULT_TIMEZONE, None)
    assert 'PRIVATE' not in str(caught.value)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(public_router)
    app.include_router(admin_router)
    route = next(route for route in admin_router.routes if route.path == '/api/weather-ai/predict-risk')
    for dependency in route.dependant.dependencies:
        app.dependency_overrides[dependency.call] = lambda: object()
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    ParentDiseaseVisibilitySetting.__table__.create(engine)
    ParentDiseaseVisibilityAudit.__table__.create(engine)
    def db():
        with Session(engine) as session: yield session
    app.dependency_overrides[get_db] = db
    try:
        with TestClient(app) as value: yield value
    finally:
        engine.dispose()


@pytest.mark.parametrize('path', ['/api/public/parent-risk', '/api/weather-ai/predict-risk'])
@pytest.mark.parametrize('kind', ['all-null', 'partial-null', 'one-hour-per-day', 'missing-hour', 'wrong-timezone'])
def test_invalid_provider_never_reaches_models_or_shap_and_returns_502(
    client, provider, registry, runtime_service, monkeypatch, path, kind,
):
    if kind == 'all-null': provider['hourly']['rain'] = provider['hourly']['precipitation'] = [None] * 168
    elif kind == 'partial-null': provider['hourly']['rain'][5] = None
    elif kind == 'one-hour-per-day': provider['hourly'] = {key: values[::24] for key, values in provider['hourly'].items()}
    elif kind == 'missing-hour': provider['hourly'] = {key: values[1:] for key, values in provider['hourly'].items()}
    else: provider['timezone'] = 'UTC'
    scores = Mock(wraps=registry.predict_scores)
    shap = Mock(wraps=runtime_service.tier1.explain)
    monkeypatch.setattr(registry, 'predict_scores', scores)
    monkeypatch.setattr(runtime_service.tier1, 'explain', shap)
    response = client.post(path, json={'age_group': next(iter(registry.category_mappings['age_group'])),
        'gender': next(iter(registry.category_mappings['gender'])), 'top_k': 5, 'latitude': 10.79, 'longitude': 106.63})
    assert response.status_code == 502
    assert response.json()['detail'] == {'code': WeatherProviderError.code, 'message': WeatherProviderError.message}
    scores.assert_not_called()
    shap.assert_not_called()


def test_invalid_parent_input_still_returns_422_not_a_provider_error(client):
    response = client.post('/api/public/parent-risk', json={'age_group': 'invalid-age', 'gender': 'Nam', 'latitude': 10.79, 'longitude': 106.63})
    assert response.status_code == 422


def test_manual_daily_infinite_is_rejected_before_rolling(hourly):
    daily = WeatherFeatureBuilder._daily_from_hourly(WeatherFeatureBuilder._hourly_frame(hourly, target_date=ANCHOR))
    daily.loc[0, 'rain_sum_daily'] = float('inf')
    with pytest.raises(ValueError):
        WeatherFeatureBuilder._weather_feature_frame(daily)
