from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.parent_disease_visibility_schemas import (
    ParentDiseaseVisibilityPatch,
    ParentDiseaseVisibilityResponse,
)
from app.security import require_permission
from app.services.parent_disease_visibility_service import (
    ParentDiseaseVisibilityConflictError,
    ParentDiseaseVisibilityService,
    ParentDiseaseVisibilityStorageError,
    ParentDiseaseVisibilityUnknownDiseaseError,
)
from app.services.weather_ai_runtime import ModelRuntimeError
from app.services.weather_ai_service import get_model_registry


PERMISSION_CODE = "feature.parent_disease_visibility"
router = APIRouter(
    prefix="/api/admin/parent-disease-visibility",
    tags=["Parent disease visibility"],
)


def get_parent_disease_visibility_service(
    db: Session = Depends(get_db),
) -> ParentDiseaseVisibilityService:
    try:
        registry = get_model_registry()
        registry.load()
    except ModelRuntimeError as exc:
        raise _storage_error() from exc
    return ParentDiseaseVisibilityService(
        db,
        registry.disease_order,
        registry.disease_catalog,
    )


def _storage_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "code": "PARENT_DISEASE_VISIBILITY_UNAVAILABLE",
            "message": "Không thể đọc cấu hình hiển thị nhóm bệnh trên Parent.",
        },
    )


@router.get("", response_model=ParentDiseaseVisibilityResponse)
def read_parent_disease_visibility(
    _actor: User = Depends(require_permission(PERMISSION_CODE)),
    service: ParentDiseaseVisibilityService = Depends(
        get_parent_disease_visibility_service
    ),
):
    try:
        return service.read()
    except (ParentDiseaseVisibilityStorageError, ModelRuntimeError) as exc:
        raise _storage_error() from exc


@router.patch("/{disease_group_id}", response_model=ParentDiseaseVisibilityResponse)
def update_parent_disease_visibility(
    disease_group_id: str,
    payload: ParentDiseaseVisibilityPatch,
    actor: User = Depends(require_permission(PERMISSION_CODE)),
    service: ParentDiseaseVisibilityService = Depends(
        get_parent_disease_visibility_service
    ),
):
    try:
        return service.update(
            disease_group_id=disease_group_id,
            enabled=payload.enabled,
            expected_version=payload.expected_version,
            actor_user_id=actor.id,
            reason=payload.reason,
        )
    except ParentDiseaseVisibilityUnknownDiseaseError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ParentDiseaseVisibilityConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PARENT_DISEASE_VISIBILITY_CONFLICT",
                "message": "Cấu hình vừa được thay đổi ở phiên khác. Hãy tải lại và thử lại.",
            },
        ) from exc
    except (ParentDiseaseVisibilityStorageError, ModelRuntimeError) as exc:
        raise _storage_error() from exc
