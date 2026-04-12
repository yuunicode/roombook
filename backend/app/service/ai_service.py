import base64
import json
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.core.settings import OPENAI_API_KEY
from app.infra.openai_gateway import (
    suggest_minutes_json,
)
from app.infra.openai_gateway import (
    transcribe_audio_chunk as transcribe_audio_chunk_gateway,
)
from app.service.domain import DomainError

GPT4O_TRANSCRIPT_INPUT_PER_1M = Decimal("2.5000")
GPT4O_TRANSCRIPT_OUTPUT_PER_1M = Decimal("10.0000")
GPT5_NANO_INPUT_PER_1M = Decimal("0.0500")
GPT5_NANO_OUTPUT_PER_1M = Decimal("0.4000")


@dataclass
class MinutesSuggestionResult:
    agenda: list[str]
    meeting_content: list[str]
    meeting_result: list[str]
    usd_cost: Decimal


@dataclass
class TranscriptionResult:
    text: str
    usd_cost: Decimal


def _sanitize_items(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    sanitized: list[str] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        sanitized.append(normalized)
    return sanitized


def _to_decimal(value: object) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, str):
        try:
            return Decimal(value)
        except Exception:
            return Decimal("0")
    return Decimal("0")


def _extract_usage_tokens(usage: object) -> tuple[Decimal, Decimal]:
    if usage is None:
        return Decimal("0"), Decimal("0")
    usage_dict: dict[str, object] = {}
    if hasattr(usage, "model_dump"):
        try:
            usage_dict = dict(usage.model_dump())
        except Exception:
            usage_dict = {}
    if not usage_dict and isinstance(usage, dict):
        usage_dict = usage
    input_tokens = _to_decimal(
        usage_dict.get("input_tokens")
        or usage_dict.get("prompt_tokens")
        or getattr(usage, "input_tokens", None)
        or getattr(usage, "prompt_tokens", None)
    )
    output_tokens = _to_decimal(
        usage_dict.get("output_tokens")
        or usage_dict.get("completion_tokens")
        or getattr(usage, "output_tokens", None)
        or getattr(usage, "completion_tokens", None)
    )
    if input_tokens == 0 and output_tokens == 0:
        total = _to_decimal(usage_dict.get("total_tokens") or getattr(usage, "total_tokens", None))
        input_tokens = total
    return input_tokens, output_tokens


def _calc_usd_cost(
    input_tokens: Decimal,
    output_tokens: Decimal,
    input_price: Decimal,
    output_price: Decimal,
) -> Decimal:
    per_million = Decimal("1000000")
    usd = (input_tokens / per_million) * input_price + (output_tokens / per_million) * output_price
    return usd.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _require_api_key() -> DomainError | None:
    if OPENAI_API_KEY:
        return None
    return DomainError(code="INVALID_ARGUMENT", message="OPENAI_API_KEY가 설정되지 않았습니다.")


def transcribe_audio_chunk(
    audio_base64: str,
    mime_type: str | None,
    previous_text: str | None,
) -> TranscriptionResult | DomainError:
    missing_key = _require_api_key()
    if missing_key is not None:
        return missing_key

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception:
        return DomainError(code="INVALID_ARGUMENT", message="오디오 데이터 형식이 올바르지 않습니다.")
    if len(audio_bytes) == 0:
        return DomainError(code="INVALID_ARGUMENT", message="빈 오디오 데이터입니다.")

    content_type = (mime_type or "audio/webm").strip() or "audio/webm"
    if "/" in content_type:
        extension = content_type.split("/")[-1].split(";")[0].strip() or "webm"
    else:
        extension = "webm"

    try:
        prompt = (previous_text or "").strip()[-1000:]
        gateway_result = transcribe_audio_chunk_gateway(
            audio_bytes=audio_bytes,
            extension=extension,
            prompt=prompt if prompt else None,
        )
        input_tokens, output_tokens = _extract_usage_tokens(gateway_result.usage)
        usd_cost = _calc_usd_cost(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_price=GPT4O_TRANSCRIPT_INPUT_PER_1M,
            output_price=GPT4O_TRANSCRIPT_OUTPUT_PER_1M,
        )
        return TranscriptionResult(text=gateway_result.text, usd_cost=usd_cost)
    except Exception as exc:
        return DomainError(code="INVALID_ARGUMENT", message=f"전사에 실패했습니다: {exc}")


def suggest_minutes_bullets(
    transcript: str,
    existing_agenda: str,
    existing_meeting_content: str,
    existing_meeting_result: str,
) -> MinutesSuggestionResult | DomainError:
    missing_key = _require_api_key()
    if missing_key is not None:
        return missing_key

    if not transcript.strip():
        return DomainError(code="INVALID_ARGUMENT", message="전사 텍스트가 비어있습니다.")

    system_instruction = (
        "너는 회의록 정리 비서다. 반드시 한국어로 응답한다. "
        "JSON 객체만 반환하고, 키는 agenda, meeting_content, meeting_result 3개만 사용한다. "
        "각 값은 문자열 배열이다. 각 항목은 1문장 불릿 포인트용 문장이다. "
        "이미 사용자 작성본과 의미가 겹치는 내용은 제외한다. "
        "새로운 정보만 반환한다."
    )
    user_prompt = (
        "[기존 주요 안건]\n"
        f"{existing_agenda}\n\n"
        "[기존 회의 내용]\n"
        f"{existing_meeting_content}\n\n"
        "[기존 회의 결과]\n"
        f"{existing_meeting_result}\n\n"
        "[전사 원문]\n"
        f"{transcript}\n\n"
        "위 정보를 바탕으로 JSON만 반환하라."
    )

    try:
        gateway_result = suggest_minutes_json(system_instruction=system_instruction, user_prompt=user_prompt)
        parsed = json.loads(gateway_result.content)
    except Exception as exc:
        return DomainError(code="INVALID_ARGUMENT", message=f"회의록 생성에 실패했습니다: {exc}")

    agenda = _sanitize_items(parsed.get("agenda"))
    meeting_content = _sanitize_items(parsed.get("meeting_content"))
    meeting_result = _sanitize_items(parsed.get("meeting_result"))
    input_tokens, output_tokens = _extract_usage_tokens(gateway_result.usage)
    usd_cost = _calc_usd_cost(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_price=GPT5_NANO_INPUT_PER_1M,
        output_price=GPT5_NANO_OUTPUT_PER_1M,
    )
    return MinutesSuggestionResult(
        agenda=agenda,
        meeting_content=meeting_content,
        meeting_result=meeting_result,
        usd_cost=usd_cost,
    )
