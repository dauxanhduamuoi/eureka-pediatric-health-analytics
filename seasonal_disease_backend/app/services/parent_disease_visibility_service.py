from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Mapping, Sequence

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import ParentDiseaseVisibilityAudit, ParentDiseaseVisibilitySetting
from app.parent_disease_visibility_schemas import (
    ParentDiseaseVisibilityItem,
    ParentDiseaseVisibilityResponse,
)
from app.services.weather_ai_eligibility import ParentDiseaseVisibilitySnapshot


class ParentDiseaseVisibilityError(RuntimeError):
    pass


class ParentDiseaseVisibilityStorageError(ParentDiseaseVisibilityError):
    pass


class ParentDiseaseVisibilityConflictError(ParentDiseaseVisibilityError):
    pass


class ParentDiseaseVisibilityUnknownDiseaseError(ParentDiseaseVisibilityError):
    pass


class ParentDiseaseVisibilityService:
    def __init__(
        self,
        db: Session,
        disease_order: Sequence[str],
        disease_catalog: Mapping[str, Mapping[str, Any]],
    ) -> None:
        self.db = db
        self.disease_order = tuple(disease_order)
        self.disease_ids = frozenset(self.disease_order)
        self.disease_catalog = disease_catalog
        if not self.disease_order or len(self.disease_order) != len(self.disease_ids):
            raise ValueError("Weather AI disease manifest must be non-empty and unique.")

    def _decode_disabled_ids(self, raw: str) -> frozenset[str]:
        try:
            values = json.loads(raw)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ParentDiseaseVisibilityStorageError(
                "Stored Parent disease visibility configuration is corrupt."
            ) from exc
        if not isinstance(values, list) or any(
            not isinstance(value, str) or not value.strip() for value in values
        ):
            raise ParentDiseaseVisibilityStorageError(
                "Stored Parent disease visibility configuration is corrupt."
            )
        normalized = [value.strip() for value in values]
        if len(normalized) != len(set(normalized)) or not set(normalized).issubset(
            self.disease_ids
        ):
            raise ParentDiseaseVisibilityStorageError(
                "Stored Parent disease visibility configuration is corrupt."
            )
        return frozenset(normalized)

    def read_snapshot(self) -> ParentDiseaseVisibilitySnapshot:
        try:
            row = self.db.get(ParentDiseaseVisibilitySetting, 1)
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise ParentDiseaseVisibilityStorageError(
                "Parent disease visibility storage is unavailable."
            ) from exc
        if row is None:
            return ParentDiseaseVisibilitySnapshot(
                version=0,
                disabled_ids=frozenset(),
                manifest_count=len(self.disease_order),
            )
        if row.version < 1:
            raise ParentDiseaseVisibilityStorageError(
                "Stored Parent disease visibility configuration is corrupt."
            )
        return ParentDiseaseVisibilitySnapshot(
            version=row.version,
            disabled_ids=self._decode_disabled_ids(row.disabled_disease_ids_json),
            manifest_count=len(self.disease_order),
        )

    def read(self) -> ParentDiseaseVisibilityResponse:
        snapshot = self.read_snapshot()
        try:
            row = self.db.get(ParentDiseaseVisibilitySetting, 1)
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise ParentDiseaseVisibilityStorageError(
                "Parent disease visibility storage is unavailable."
            ) from exc
        items = []
        for disease_id in self.disease_order:
            disease = self.disease_catalog[disease_id]
            items.append(
                ParentDiseaseVisibilityItem(
                    disease_group_id=disease_id,
                    disease_group_name=str(disease.get("disease_group_name") or ""),
                    report_group_code=str(disease.get("report_group_code") or ""),
                    enabled=disease_id not in snapshot.disabled_ids,
                )
            )
        return ParentDiseaseVisibilityResponse(
            version=snapshot.version,
            total_count=len(items),
            enabled_count=snapshot.enabled_count,
            disabled_count=len(snapshot.disabled_ids),
            updated_at=row.updated_at if row else None,
            updated_by_user_id=row.updated_by_user_id if row else None,
            items=items,
        )

    def update(
        self,
        *,
        disease_group_id: str,
        enabled: bool,
        expected_version: int,
        actor_user_id: int,
        reason: str | None = None,
    ) -> ParentDiseaseVisibilityResponse:
        disease_id = disease_group_id.strip()
        if disease_id not in self.disease_ids:
            raise ParentDiseaseVisibilityUnknownDiseaseError(
                "Disease group is outside the locked Weather AI manifest."
            )
        snapshot = self.read_snapshot()
        if snapshot.version != expected_version:
            raise ParentDiseaseVisibilityConflictError(
                "Parent disease visibility changed in another session. Reload and try again."
            )
        currently_enabled = disease_id not in snapshot.disabled_ids
        if currently_enabled == enabled:
            return self.read()

        disabled_ids = set(snapshot.disabled_ids)
        if enabled:
            disabled_ids.discard(disease_id)
        else:
            disabled_ids.add(disease_id)
        ordered_disabled_ids = [
            item for item in self.disease_order if item in disabled_ids
        ]
        next_version = snapshot.version + 1
        now = datetime.utcnow()
        reason_value = reason.strip() if reason and reason.strip() else None

        try:
            if snapshot.version == 0:
                self.db.add(
                    ParentDiseaseVisibilitySetting(
                        id=1,
                        version=next_version,
                        disabled_disease_ids_json=json.dumps(
                            ordered_disabled_ids, ensure_ascii=False
                        ),
                        updated_at=now,
                        updated_by_user_id=actor_user_id,
                    )
                )
                self.db.flush()
            else:
                result = self.db.execute(
                    update(ParentDiseaseVisibilitySetting)
                    .where(
                        ParentDiseaseVisibilitySetting.id == 1,
                        ParentDiseaseVisibilitySetting.version == expected_version,
                    )
                    .values(
                        version=next_version,
                        disabled_disease_ids_json=json.dumps(
                            ordered_disabled_ids, ensure_ascii=False
                        ),
                        updated_at=now,
                        updated_by_user_id=actor_user_id,
                    )
                )
                if result.rowcount != 1:
                    self.db.rollback()
                    raise ParentDiseaseVisibilityConflictError(
                        "Parent disease visibility changed in another session. Reload and try again."
                    )
            self.db.add(
                ParentDiseaseVisibilityAudit(
                    version=next_version,
                    disease_group_id=disease_id,
                    enabled=enabled,
                    actor_user_id=actor_user_id,
                    reason=reason_value,
                    created_at=now,
                )
            )
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ParentDiseaseVisibilityConflictError(
                "Parent disease visibility changed in another session. Reload and try again."
            ) from exc
        except ParentDiseaseVisibilityConflictError:
            raise
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise ParentDiseaseVisibilityStorageError(
                "Parent disease visibility storage is unavailable."
            ) from exc
        return self.read()
