from __future__ import annotations

import numpy as np

from app.services.weather_ai_eligibility import ParentDiseaseVisibilitySnapshot
from app.services.weather_ai_service import WeatherAIRuntimeService


def test_internal_ranking_without_parent_policy_preserves_full_universe(
    runtime_service, train_context
):
    result = runtime_service.predict(
        train_context["age_group"],
        train_context["gender"],
        top_k=5,
        weather=train_context["weather"],
        target_date=train_context["target_date"],
    )

    assert result["context"]["eligibility_filter_active"] is False
    assert result["context"]["eligible_parent_universe"] is None
    assert result["context"]["parent_visibility_version"] is None
    assert result["context"]["ranking_universe"] == 221
    assert result["context"]["returned_count"] == 5


def test_parent_policy_filters_after_221_scores_but_before_top_k(
    registry, runtime_service, train_context
):
    prepared = runtime_service.feature_builder.prepare(
        train_context["age_group"],
        train_context["gender"],
        train_context["weather"],
        None,
        None,
        "Asia/Ho_Chi_Minh",
        train_context["target_date"],
    )
    ranked_indices = np.argsort(-registry.predict_scores(prepared.encoded), kind="stable")
    enabled_ids = [
        registry.disease_order[int(ranked_indices[8])],
        registry.disease_order[int(ranked_indices[13])],
    ]
    visibility = ParentDiseaseVisibilitySnapshot(
        version=7,
        disabled_ids=frozenset(set(registry.disease_order) - set(enabled_ids)),
        manifest_count=len(registry.disease_order),
    )
    service = WeatherAIRuntimeService(
        registry,
        runtime_service.medical_knowledge,
        parent_visibility=visibility,
    )

    result = service.predict(
        train_context["age_group"],
        train_context["gender"],
        top_k=5,
        weather=train_context["weather"],
        target_date=train_context["target_date"],
    )

    assert [row["disease_group_id"] for row in result["predictions"]] == enabled_ids
    assert result["context"]["eligible_parent_universe"] == 2
    assert result["context"]["parent_visibility_version"] == 7
    assert result["context"]["returned_count"] == 2


def test_parent_policy_preserves_stable_rank_order():
    snapshot = ParentDiseaseVisibilitySnapshot(
        version=1,
        disabled_ids=frozenset({"b", "d"}),
        manifest_count=4,
    )

    assert snapshot.filter_indices([3, 1, 2, 0], ["a", "b", "c", "d"]) == [2, 0]


def test_zero_enabled_parent_policy_returns_empty_result(
    registry, runtime_service, train_context
):
    visibility = ParentDiseaseVisibilitySnapshot(
        version=221,
        disabled_ids=frozenset(registry.disease_order),
        manifest_count=len(registry.disease_order),
    )

    result = runtime_service.predict(
        train_context["age_group"],
        train_context["gender"],
        top_k=5,
        weather=train_context["weather"],
        target_date=train_context["target_date"],
        parent_visibility=visibility,
    )

    assert result["predictions"] == []
    assert result["top_risks"] == []
    assert result["context"]["eligible_parent_universe"] == 0
    assert result["context"]["returned_count"] == 0
    assert "đang được bật" in result["message"]
