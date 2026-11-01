from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ParentDiseaseVisibilityItem(BaseModel):
    disease_group_id: str
    disease_group_name: str
    report_group_code: str
    enabled: bool


class ParentDiseaseVisibilityResponse(BaseModel):
    version: int
    total_count: int
    enabled_count: int
    disabled_count: int
    updated_at: datetime | None
    updated_by_user_id: int | None
    items: list[ParentDiseaseVisibilityItem]


class ParentDiseaseVisibilityPatch(BaseModel):
    enabled: bool
    expected_version: int = Field(ge=0)
    reason: str | None = Field(default=None, max_length=500)
