"""Offline Parent contract checks: no app.main, real DB, HTTP weather, or queues."""
from __future__ import annotations

import numpy as np
import pytest

from app.routers.public import ParentRiskRequest
from app.services.weather_ai_eligibility import ParentDiseaseVisibilitySnapshot


def test_parent_contract_and_45_features_have_no_hospital_or_province_inputs(registry):
    forbidden = {'province_code', 'province_name', 'address', 'patient_address',
                 'recent_cases', 'local_cases', 'forecast_cases', 'forecast_risk_level'}
    assert forbidden.isdisjoint(ParentRiskRequest.model_fields)
    assert forbidden.isdisjoint(registry.feature_order)
    assert len(registry.feature_order) == 45
    assert len(registry.disease_order) == 221


def test_identical_weather_features_rank_identically_for_different_coordinates(
    registry, runtime_service, train_context
):
    results = []
    encoded_inputs = []
    # Explicit weather is the same: coordinates must not become model features.
    for latitude, longitude in [(10.98, 106.65), (21.03, 105.85)]:
        prepared = runtime_service.feature_builder.prepare(
            train_context['age_group'], train_context['gender'], train_context['weather'],
            latitude, longitude, 'Asia/Ho_Chi_Minh', train_context['target_date'],
        )
        assert list(prepared.encoded.columns) == list(registry.feature_order)
        encoded_inputs.append(prepared.encoded.to_numpy())
        result = runtime_service.predict(
            train_context['age_group'], train_context['gender'], top_k=5,
            weather=train_context['weather'], latitude=latitude, longitude=longitude,
            target_date=train_context['target_date'],
        )
        results.append([(row['disease_group_id'],row['rank'],row['ranking_score']) for row in result['predictions']])
    np.testing.assert_array_equal(encoded_inputs[0], encoded_inputs[1])
    assert results[0] == results[1]


@pytest.mark.parametrize('top_k', [3, 5, 10])
def test_top_k_remains_model_score_order_after_admin_visibility(
    top_k, registry, runtime_service, train_context
):
    prepared = runtime_service.feature_builder.prepare(
        train_context['age_group'], train_context['gender'], train_context['weather'],
        None, None, 'Asia/Ho_Chi_Minh', train_context['target_date'],
    )
    scores = registry.predict_scores(prepared.encoded)
    ranked = np.argsort(-scores, kind='stable')
    disabled = frozenset(registry.disease_order[int(index)] for index in ranked[:2])
    policy = ParentDiseaseVisibilitySnapshot(version=1,disabled_ids=disabled,manifest_count=221)
    expected = [int(index) for index in ranked if registry.disease_order[int(index)] not in disabled][:top_k]
    result = runtime_service.predict(
        train_context['age_group'], train_context['gender'], top_k=top_k,
        weather=train_context['weather'], target_date=train_context['target_date'],
        parent_visibility=policy,
    )
    assert [row['disease_group_id'] for row in result['predictions']] == [registry.disease_order[index] for index in expected]
    assert [row['ranking_score'] for row in result['predictions']] == [float(scores[index]) for index in expected]
    assert [row['rank'] for row in result['predictions']] == list(range(1,top_k+1))
    assert result['context']['ranking_universe'] == 221
    assert result['context']['horizon'] == 'H14'
    assert result['context']['returned_count'] == top_k


def test_tied_model_scores_keep_manifest_order_without_hospital_tie_break(
    monkeypatch, registry, runtime_service, train_context
):
    monkeypatch.setattr(registry,'predict_scores',lambda _features: np.full(221,0.5))
    monkeypatch.setattr(runtime_service.tier1,'explain',lambda *_args: {'available':False})
    disabled = frozenset(registry.disease_order[:4])
    result = runtime_service.predict(
        train_context['age_group'], train_context['gender'], top_k=5,
        weather=train_context['weather'], target_date=train_context['target_date'],
        parent_visibility=ParentDiseaseVisibilitySnapshot(version=2,disabled_ids=disabled,manifest_count=221),
    )
    assert [row['disease_group_id'] for row in result['predictions']] == list(registry.disease_order[4:9])
