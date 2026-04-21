from decimal import Decimal

from app.service.ai_service import _calc_usd_cost, suggest_minutes_bullets, transcribe_audio_chunk
from app.service.domain import DomainError


def test_should_keep_sub_cent_ai_cost_precision() -> None:
    usd_cost = _calc_usd_cost(
        input_tokens=Decimal("100"),
        output_tokens=Decimal("100"),
        input_price=Decimal("0.0500"),
        output_price=Decimal("0.4000"),
    )

    assert usd_cost == Decimal("0.000045")


def test_should_return_domain_error_when_minutes_model_returns_non_object_json(monkeypatch) -> None:
    monkeypatch.setattr("app.service.ai_service.OPENAI_API_KEY", "test-key")

    class FakeGatewayResponse:
        content = "[]"
        usage = None

    monkeypatch.setattr(
        "app.service.ai_service.suggest_minutes_json",
        lambda system_instruction, user_prompt: FakeGatewayResponse(),
    )

    result = suggest_minutes_bullets(
        transcript="speaker1: 이번 주 배포 일정을 조정합니다.",
        existing_agenda="",
        existing_meeting_content="",
        existing_meeting_result="",
    )

    assert isinstance(result, DomainError)
    assert result.code == "INVALID_ARGUMENT"
    assert "JSON 객체" in result.message


def test_should_use_openai_transcribe_function_without_recursive_self_call(monkeypatch) -> None:
    monkeypatch.setattr("app.service.ai_service.OPENAI_API_KEY", "test-key")

    class FakeGatewayResponse:
        text = "speaker1: 테스트"
        usage = None

    monkeypatch.setattr(
        "app.service.ai_service.openai_transcribe_audio_chunk",
        lambda **kwargs: FakeGatewayResponse(),
    )

    result = transcribe_audio_chunk(
        audio_base64="dGVzdA==",
        mime_type="audio/webm",
        previous_text="",
    )

    assert not isinstance(result, DomainError)
    assert result.text == "speaker1: 테스트"
