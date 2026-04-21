from dataclasses import dataclass

from openai import OpenAI

from app.core.settings import OPENAI_API_KEY


@dataclass(frozen=True, slots=True)
class OpenAiTranscriptionResponse:
    text: str
    usage: object | None
    raw: object | None


@dataclass(frozen=True, slots=True)
class OpenAiChatResponse:
    content: str
    usage: object | None


def _client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


def transcribe_audio_chunk(
    audio_bytes: bytes,
    extension: str,
    mime_type: str,
    prompt: str | None,
) -> OpenAiTranscriptionResponse:
    file_name = f"chunk.{extension.strip() or 'webm'}"
    if prompt:
        response = _client().audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=(file_name, audio_bytes, mime_type),
            prompt=prompt,
        )
    else:
        response = _client().audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=(file_name, audio_bytes, mime_type),
        )
    return OpenAiTranscriptionResponse(
        text=(response.text or "").strip(),
        usage=getattr(response, "usage", None),
        raw=response,
    )


def suggest_minutes_json(system_instruction: str, user_prompt: str) -> OpenAiChatResponse:
    response = _client().chat.completions.create(
        model="gpt-5-nano",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return OpenAiChatResponse(content=content, usage=getattr(response, "usage", None))


def repair_minutes_json(raw_content: str) -> OpenAiChatResponse:
    response = _client().chat.completions.create(
        model="gpt-5-nano",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "너는 JSON 복구기다. 반드시 JSON 객체만 반환한다. "
                    "키는 agenda, meeting_content, meeting_result 3개만 사용한다. "
                    "각 값은 문자열 배열이어야 한다."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"아래 모델 응답을 유효한 JSON 객체로 복구하라. 설명하지 말고 JSON만 반환하라.\n\n{raw_content}"
                ),
            },
        ],
    )
    content = response.choices[0].message.content or "{}"
    return OpenAiChatResponse(content=content, usage=getattr(response, "usage", None))
