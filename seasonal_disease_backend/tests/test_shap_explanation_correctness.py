"""Locked local models + pre-fix golden; no production DB, lifespan or network."""
from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import ParentDiseaseVisibilityAudit, ParentDiseaseVisibilitySetting
from app.routers.public import router as public_router
from app.routers.weather_ai import router as admin_router
from app.services.weather_ai_eligibility import ParentDiseaseVisibilitySnapshot
from app.services.weather_ai_explanations import Tier1ExplanationService
from app.services.weather_ai_features import DEFAULT_TIMEZONE
from app.weather_ai_schemas import Tier1Response, WeatherAIPredictResponse

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = json.loads((Path(__file__).parent / 'fixtures/shap_explanation_before.json').read_text(encoding='utf-8'))
BEFORE = GOLDEN['response']
ANCHOR = date.fromisoformat(BEFORE['context']['anchor_date'])
WEATHER = {'anchor_date': str(ANCHOR), **BEFORE['weather']['features']}


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    monkeypatch.setattr('urllib.request.urlopen', Mock(side_effect=AssertionError('No external network in SHAP tests')))


@pytest.fixture
def prepared(runtime_service):
    return runtime_service.feature_builder.prepare(
        BEFORE['input']['age_group'], BEFORE['input']['gender'], WEATHER,
        None, None, DEFAULT_TIMEZONE, ANCHOR,
    )


def assert_legacy_prediction_preserved(after, before, *, ignore_rank=False):
    """Only the new field and corrected summary may differ from pre-fix output."""
    projected = copy.deepcopy(after)
    projected['tier1'].pop('display_factors', None)
    assert 'điểm AI' in projected['tier1']['summary_vi']
    assert 'xếp hạng cao hơn' not in projected['tier1']['summary_vi']
    projected['tier1']['summary_vi'] = before['tier1']['summary_vi']
    if ignore_rank:
        projected['rank'] = before['rank']
    assert projected == before


@pytest.mark.parametrize('case', GOLDEN['cases'], ids=lambda c: c['disease_id'])
def test_raw_45_contributions_and_legacy_top5_are_exactly_preserved(case, registry, runtime_service, prepared, monkeypatch):
    assert list(prepared.encoded.columns) == GOLDEN['feature_order']
    np.testing.assert_array_equal(prepared.encoded.iloc[0].to_numpy(), GOLDEN['encoded'])
    before = next(p for p in BEFORE['predictions'] if p['disease_id'] == case['disease_id'])
    values, base, error = registry.local_contributions(case['disease_id'], prepared.encoded)
    assert len(values) == 45
    np.testing.assert_array_equal(values, [f['shap_value'] for f in case['all_factors']])
    assert base == case['base_value_raw']
    assert abs(base + values.sum() - case['raw_margin']) <= 1e-6
    assert error <= 1e-6
    assert abs(1 / (1 + np.exp(-case['raw_margin'])) - before['ranking_score']) <= 1e-12
    tracked = Mock(wraps=registry.local_contributions)
    monkeypatch.setattr(registry, 'local_contributions', tracked)
    result = runtime_service.tier1.explain(case['disease_id'], prepared.encoded, prepared.raw)
    tracked.assert_called_once_with(case['disease_id'], prepared.encoded)
    assert result['positive_factors'] == before['tier1']['positive_factors']
    assert result['negative_factors'] == before['tier1']['negative_factors']
    assert result['display_factors'] == [f for f in case['all_factors'] if abs(f['shap_value']) > 1e-12]
    assert 0 <= len(result['positive_factors']) <= 5
    assert len(result['display_factors']) <= 45
    for factor in result['display_factors']:
        assert (factor['direction'] == 'UP') == (factor['shap_value'] > 0)


@pytest.mark.parametrize('positive_count', range(7))
def test_zero_to_six_positives_keep_legacy_limit_and_complete_display(positive_count, registry, prepared):
    values = np.zeros(45)
    values[:positive_count] = np.arange(positive_count, 0, -1)
    values[10:17] = -np.arange(7, 0, -1)
    contributions = Mock(return_value=(values, 0.0, 0.0))
    synthetic = SimpleNamespace(feature_schema=registry.feature_schema, feature_order=registry.feature_order,
                                local_contributions=contributions)
    result = Tier1ExplanationService(synthetic).explain('synthetic', prepared.encoded, prepared.raw)
    assert len(result['positive_factors']) == min(positive_count, 5)
    assert len(result['negative_factors']) == 5
    assert len(result['display_factors']) == positive_count + 7
    assert [f['feature'] for f in result['positive_factors']] == list(registry.feature_order[:min(positive_count, 5)])
    contributions.assert_called_once()


@pytest.mark.parametrize('just_above_threshold', [False, True])
def test_zero_and_threshold_do_not_become_effects(just_above_threshold, registry, prepared):
    values = np.zeros(45)
    values[:2] = [1e-12, -1e-12]
    if just_above_threshold:
        values[2:4] = [1.01e-12, -1.01e-12]
    synthetic = SimpleNamespace(feature_schema=registry.feature_schema, feature_order=registry.feature_order,
                                local_contributions=Mock(return_value=(values, 0.0, 0.0)))
    result = Tier1ExplanationService(synthetic).explain('synthetic', prepared.encoded, prepared.raw)
    assert len(result['display_factors']) == (2 if just_above_threshold else 0)
    assert len(result['positive_factors']) == len(result['negative_factors']) == int(just_above_threshold)


@pytest.mark.parametrize('bad_value', [float('nan'), float('inf'), float('-inf')])
@pytest.mark.parametrize('position', ['contribution', 'base', 'additivity_error'])
def test_invalid_shap_is_unavailable_without_changing_prediction(position, bad_value, runtime_service, monkeypatch):
    values, base, error = np.zeros(45), 0.0, 0.0
    if position == 'contribution':
        values[0] = bad_value
    elif position == 'base':
        base = bad_value
    else:
        error = bad_value
    monkeypatch.setattr(runtime_service.registry, 'local_contributions', Mock(return_value=(values, base, error)))
    result = runtime_service.predict(BEFORE['input']['age_group'], BEFORE['input']['gender'], 1, weather=WEATHER)
    prediction = result['predictions'][0]
    assert prediction['disease_id'] == BEFORE['predictions'][0]['disease_id']
    assert prediction['ranking_score'] == BEFORE['predictions'][0]['ranking_score']
    assert prediction['tier1']['available'] is False
    assert prediction['tier1']['positive_factors'] == prediction['tier1']['negative_factors'] == []


def test_top3_5_10_visibility_and_all_legacy_prediction_fields_are_preserved(runtime_service):
    for k in (3, 5, 10):
        result = runtime_service.predict(BEFORE['input']['age_group'], BEFORE['input']['gender'], k, weather=WEATHER)
        assert result['model']['model_count'] == 221
        assert result['context']['horizon'] == 'H14'
        for after, before in zip(result['predictions'], BEFORE['predictions'][:k], strict=True):
            assert_legacy_prediction_preserved(after, before)
    visibility = ParentDiseaseVisibilitySnapshot(17, frozenset({BEFORE['predictions'][0]['disease_id']}), 221)
    result = runtime_service.predict(BEFORE['input']['age_group'], BEFORE['input']['gender'], 5, weather=WEATHER,
                                     parent_visibility=visibility)
    for after, before in zip(result['predictions'], BEFORE['predictions'][1:6], strict=True):
        assert_legacy_prediction_preserved(after, before, ignore_rank=True)


def test_optional_api_field_accepts_legacy_and_rejects_more_than_45():
    old = copy.deepcopy(BEFORE['predictions'][0]['tier1'])
    assert Tier1Response.model_validate(old).display_factors is None
    assert Tier1Response.model_validate({**old, 'display_factors': []}).display_factors == []
    with pytest.raises(ValidationError):
        Tier1Response.model_validate({**old, 'display_factors': old['positive_factors'] * 10})


def test_public_and_admin_api_preserve_full_display_and_write_frontend_evidence():
    # Deliberately use a standalone FastAPI instance; never app.main/lifespan.
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    ParentDiseaseVisibilitySetting.__table__.create(engine)
    ParentDiseaseVisibilityAudit.__table__.create(engine)
    session_factory = sessionmaker(bind=engine)

    def isolated_db():
        with session_factory() as db:
            yield db

    app = FastAPI()
    app.include_router(public_router)
    app.include_router(admin_router)
    app.dependency_overrides[get_db] = isolated_db
    admin_route = next(route for route in admin_router.routes if getattr(route, 'path', '') == '/api/weather-ai/predict-risk')
    for dependency in admin_route.dependant.dependencies:
        app.dependency_overrides[dependency.call] = lambda: object()
    payload = {'age_group': BEFORE['input']['age_group'], 'gender': BEFORE['input']['gender'],
               'top_k': 10, 'weather': WEATHER}
    with TestClient(app) as client:
        for path in ('/api/public/parent-risk', '/api/weather-ai/predict-risk'):
            response = client.post(path, json=payload)
            assert response.status_code == 200, response.text
            body = response.json()
            WeatherAIPredictResponse.model_validate(body)
            assert body['top_risks'] == body['predictions']
            for after, before in zip(body['predictions'], BEFORE['predictions'], strict=True):
                assert_legacy_prediction_preserved(after, before)
                case = next(c for c in GOLDEN['cases'] if c['disease_id'] == after['disease_id'])
                assert after['tier1']['display_factors'] == [f for f in case['all_factors'] if abs(f['shap_value']) > 1e-12]
            if path == '/api/public/parent-risk':
                (ROOT / 'weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json').write_text(
                    json.dumps(body, ensure_ascii=False, indent=2), encoding='utf-8',
                )
    engine.dispose()
