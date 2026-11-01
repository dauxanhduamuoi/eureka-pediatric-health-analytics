"""Error contracts only: isolated routers, fake dependencies, no DB/model execution."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.routers import forecast, weather_ai
from app.services.weather_ai_runtime import ModelRuntimeError


@pytest.mark.parametrize('kind,status', [('missing', 503), ('runtime', 500), ('input', 400)])
def test_forecast_errors_do_not_publish_internal_exception(monkeypatch, kind, status):
    errors = {'missing': FileNotFoundError, 'runtime': RuntimeError, 'input': ValueError}
    sentinel = 'PRIVATE_SENTINEL_D:/private/credentials-and-model'
    def fail(**kwargs):
        raise errors[kind](sentinel)
    monkeypatch.setattr(forecast, 'run_forecast', fail)
    app = FastAPI()
    app.include_router(forecast.router)
    app.dependency_overrides[get_db] = lambda: object()
    route = next(r for r in forecast.router.routes if r.path.endswith('/run'))
    for dep in route.dependant.dependencies:
        if dep.call is not get_db:
            app.dependency_overrides[dep.call] = lambda: object()
    with TestClient(app) as client:
        response = client.post('/api/forecast/run')
    assert response.status_code == status
    assert 'PRIVATE_SENTINEL' not in response.text
    assert 'D:/private' not in response.text
    assert response.json()['detail']


@pytest.mark.parametrize('endpoint', ['options', 'predict-risk'])
def test_weather_model_errors_do_not_publish_internal_exception(monkeypatch, endpoint):
    def fail(**kwargs):
        raise ModelRuntimeError('PRIVATE_SENTINEL_D:/private/model')
    monkeypatch.setattr(weather_ai, 'get_weather_ai_options' if endpoint == 'options' else 'predict_weather_risk', fail)
    app = FastAPI()
    app.include_router(weather_ai.router)
    for route in weather_ai.router.routes:
        for dep in route.dependant.dependencies:
            app.dependency_overrides[dep.call] = lambda: object()
    with TestClient(app) as client:
        response = client.get('/api/weather-ai/options') if endpoint == 'options' else client.post(
            '/api/weather-ai/predict-risk', json={'age_group': '1-5 tuổi', 'gender': 'Nam', 'latitude': 10.77, 'longitude': 106.69})
    assert response.status_code == 503
    assert 'PRIVATE_SENTINEL' not in response.text
    assert 'D:/private' not in response.text
