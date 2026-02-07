from app.infra.health_model import HealthModel


def get_health_status() -> HealthModel:
    return HealthModel(status="ok")
