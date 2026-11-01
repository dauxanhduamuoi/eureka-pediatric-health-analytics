"""Read-only offline audit. Does not import app.main or use the real database."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'seasonal_disease_backend'))

from app.services.weather_ai_service import get_runtime_service
from app.services.weather_ai_explanations import Tier1ExplanationService
from app.services.weather_ai_features import DEFAULT_TIMEZONE
from app.services.weather_ai_eligibility import ParentDiseaseVisibilitySnapshot
from app.weather_ai_schemas import WeatherAIPredictResponse


def main():
    service = get_runtime_service()
    registry = service.registry
    times = pd.date_range('2026-08-01', periods=168, freq='h')
    hourly = {
        'time': times.strftime('%Y-%m-%dT%H:%M').tolist(),
        'temperature_2m': [24 + (i % 24) / 4 for i in range(168)],
        'relative_humidity_2m': [60 + i % 20 for i in range(168)],
        'precipitation': [float(i % 3) for i in range(168)],
        'rain': [float(i % 2) for i in range(168)],
        'weather_code': [2] * 168,
        'wind_speed_10m': [4 + i % 6 for i in range(168)],
        'wind_gusts_10m': [10 + i % 7 for i in range(168)],
    }
    anchor = date(2026, 8, 7)
    baseline = json.loads((ROOT / 'seasonal_disease_backend/tests/fixtures/weather_input_valid_baseline.json').read_text(encoding='utf-8'))
    age, gender = baseline['age_group'], baseline['gender']
    builder = service.feature_builder
    frame = builder._hourly_frame(hourly, DEFAULT_TIMEZONE, anchor)
    assert len(frame) == 168
    daily = builder._daily_from_hourly(frame)
    weather = {'daily': daily.assign(date=daily['date'].dt.strftime('%Y-%m-%d')).to_dict(orient='records')}
    prepared = builder.prepare(age, gender, weather, None, None, DEFAULT_TIMEZONE, anchor)
    np.testing.assert_array_equal(prepared.encoded.iloc[0].to_numpy(), baseline['encoded'])
    scores = registry.predict_scores(prepared.encoded)
    order = np.argsort(-scores, kind='stable')
    ranks = {registry.disease_order[int(i)]: rank for rank, i in enumerate(order, 1)}
    outputs = {k: service.predict(age, gender, top_k=k, weather=weather, target_date=anchor) for k in (3, 5, 10)}
    assert outputs[3]['predictions'] == outputs[10]['predictions'][:3]
    assert outputs[5]['predictions'] == outputs[10]['predictions'][:5]
    hidden_id = outputs[10]['predictions'][0]['disease_id']
    visibility = ParentDiseaseVisibilitySnapshot(9, frozenset({hidden_id}), 221)
    filtered = service.predict(age, gender, top_k=5, weather=weather, target_date=anchor, parent_visibility=visibility)
    unfiltered = {p['disease_id']: p for p in outputs[10]['predictions']}
    for item in filtered['predictions']:
        previous = unfiltered[item['disease_id']]
        assert item['tier1'] == previous['tier1']
        assert item['ranking_score'] == previous['ranking_score']
    assert hidden_id not in {p['disease_id'] for p in filtered['predictions']}

    cases = []
    ids = list(dict.fromkeys(['6', *[p['disease_id'] for p in outputs[10]['predictions']]]))
    for disease_id in ids:
        values, base, error = registry.local_contributions(disease_id, prepared.encoded)
        model = registry._models[disease_id]
        raw = float(model.predict(prepared.encoded, raw_score=True)[0])
        score = float(model.predict(prepared.encoded)[0])
        assert len(values) == 45 and np.isfinite(values).all()
        assert abs(base + values.sum() - raw) < 1e-6
        assert abs(1 / (1 + np.exp(-raw)) - score) < 1e-12
        tier1 = service.tier1.explain(disease_id, prepared.encoded, prepared.raw)
        positive = [i for i in np.argsort(-values, kind='stable') if values[i] > 1e-12][:5]
        negative = [i for i in np.argsort(values, kind='stable') if values[i] < -1e-12][:5]
        expected = [registry.feature_order[int(i)] for i in [*positive, *negative]]
        selected = tier1['positive_factors'] + tier1['negative_factors']
        assert [f['feature'] for f in selected] == expected
        for factor in selected:
            assert factor['shap_value'] == values[registry.feature_order.index(factor['feature'])]
            assert (factor['direction'] == 'UP') == (factor['shap_value'] > 0)
        case = {
            'disease_id': disease_id, 'disease_name': registry.disease_catalog[disease_id]['disease_group_name'],
            'rank_without_visibility': ranks[disease_id], 'ranking_score': score,
            'raw_margin': raw, 'base_value_raw': base, 'additivity_error': error,
            'objective': model.dump_model()['objective'], 'tier1': tier1,
            'nonzero_count': int(np.count_nonzero(np.abs(values) > 1e-12)),
            'selected_count': len(selected),
            'selected_abs_mass': float(sum(abs(f['shap_value']) for f in selected)),
            'total_abs_mass': float(np.abs(values).sum()),
            'selected_sum': float(sum(f['shap_value'] for f in selected)),
            'all_sum': float(values.sum()),
            'features': [
                {
                    'feature': name, 'input_value': prepared.raw[name],
                    'encoded_value': float(prepared.encoded.iloc[0][name]),
                    'shap_value': float(values[i]),
                    'direction': 'UP' if values[i] > 1e-12 else 'DOWN' if values[i] < -1e-12 else 'ZERO_OR_THRESHOLD',
                    'in_api': name in expected,
                    'reason': 'Top 5 cùng dấu' if name in expected else 'Zero hoặc |SHAP| ≤ 1e-12' if abs(values[i]) <= 1e-12 else 'Ngoài Top 5 cùng dấu',
                    'factor': service.tier1._factor(name, prepared.raw[name], float(values[i])),
                }
                for i, name in enumerate(registry.feature_order)
            ],
        }
        cases.append(case)

    # Actual public router + real service, isolated in-memory visibility tables.
    # No application lifespan, auth, queue, or production API server is involved.
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.database import get_db
    from app.models import ParentDiseaseVisibilitySetting, ParentDiseaseVisibilityAudit
    from app.routers.public import router

    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    ParentDiseaseVisibilitySetting.__table__.create(engine)
    ParentDiseaseVisibilityAudit.__table__.create(engine)
    session_factory = sessionmaker(bind=engine)

    def isolated_db():
        with session_factory() as session:
            yield session

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = isolated_db
    public_bodies = {}
    with TestClient(app) as client:
        for k in (3, 5, 10):
            response = client.post('/api/public/parent-risk', json={
                'age_group': age, 'gender': gender, 'top_k': k,
                'weather': {'anchor_date': str(anchor), **{f: prepared.raw[f] for f in registry.feature_order[6:]}},
            })
            assert response.status_code == 200, response.text
            body = response.json()
            WeatherAIPredictResponse.model_validate(body)
            assert body['predictions'] == outputs[k]['predictions']
            assert body['top_risks'] == body['predictions']
            public_bodies[str(k)] = body
    engine.dispose()

    # Synthetic contributions use the real 45-feature schema; never called real model output.
    class SyntheticRegistry:
        feature_order = registry.feature_order
        feature_schema = registry.feature_schema
        contributions = np.zeros(45)

        def local_contributions(self, *_args):
            return self.contributions.copy(), 0.0, 0.0

    synthetic = SyntheticRegistry()
    explainer = Tier1ExplanationService(synthetic)
    zero = explainer.explain('synthetic', prepared.encoded, prepared.raw)
    assert not zero['positive_factors'] and not zero['negative_factors']
    synthetic.contributions[:6] = [0, 1e-12, -1e-12, 1.01e-12, -1.01e-12, 0]
    threshold = explainer.explain('synthetic', prepared.encoded, prepared.raw)
    assert len(threshold['positive_factors']) == len(threshold['negative_factors']) == 1

    with patch.object(service.tier1, 'explain', side_effect=RuntimeError('isolated unavailable explanation probe')):
        unavailable = service.predict(age, gender, top_k=1, weather=weather, target_date=anchor)
    assert unavailable['predictions'][0]['ranking_score'] == outputs[3]['predictions'][0]['ranking_score']
    assert unavailable['predictions'][0]['disease_id'] == outputs[3]['predictions'][0]['disease_id']
    assert unavailable['predictions'][0]['tier1'] == service._tier1_unavailable()

    from app.services.weather_ai_runtime import ModelRuntimeError
    first_model = registry._models[outputs[3]['predictions'][0]['disease_id']]
    original_predict = first_model.predict
    for failure_mode in ('wrong_shape', 'failed_additivity'):
        def invalid_prediction(data, **kwargs):
            if kwargs.get('pred_contrib'):
                if failure_mode == 'wrong_shape':
                    return np.zeros((1, 45))
                invalid = np.asarray(original_predict(data, **kwargs)).copy()
                invalid[0, -1] += 1.0
                return invalid
            return original_predict(data, **kwargs)

        with patch.object(first_model, 'predict', side_effect=invalid_prediction):
            try:
                registry.local_contributions(outputs[3]['predictions'][0]['disease_id'], prepared.encoded)
            except ModelRuntimeError:
                pass
            else:
                raise AssertionError(f'{failure_mode} was not rejected')

    result = {
        'fixture': {'kind': 'synthetic 168-hour offline substitute; NOT original screenshot prediction',
                    'anchor_date': str(anchor), 'age_group': age, 'gender': gender, 'timezone': DEFAULT_TIMEZONE},
        'model_count': len(registry.disease_order), 'feature_order': list(registry.feature_order),
        'encoded': prepared.encoded.iloc[0].tolist(),
        'raw_input': prepared.raw, 'cases': cases, 'public_api': public_bodies,
        'filtered_predictions': filtered['predictions'], 'unavailable_prediction': unavailable['predictions'][0],
        'checks': {'168_hour_fixture': True, 'baseline_45_identical': True, 'additivity_all_sampled': True,
                   'sigmoid_matches_scores': True, 'raw_vs_payload_exact': True,
                   'top_3_5_10_consistent': True, 'visibility_keeps_disease_shap': True,
                   'public_router_serialization_exact': True, 'zero_contributions_omitted': True,
                   'threshold_boundary': True, 'explanation_failure_keeps_correct_ranking': True,
                   'invalid_shape_rejected': True, 'failed_additivity_rejected': True},
    }
    (HERE / 'backend_evidence.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'cases': len(cases), 'checks': result['checks'], 'id6': {k: v for k, v in cases[0].items() if k not in {'features', 'tier1'}}}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    with patch('urllib.request.urlopen', side_effect=AssertionError('External network prohibited during audit')):
        main()
