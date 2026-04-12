from dataclasses import dataclass

from openai import OpenAI

from app.core.settings import OPENAI_API_KEY


@dataclass(frozen=True, slots=True)
class GatewayTranscriptionResponse:
    text: str
    usage: object | None


@dataclass(frozen=True, slots=True)
class GatewayChatResponse:
    content: str
    usage: object | None


def _client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


def transcribe_audio_chunk(
    audio_bytes: bytes,
    extension: str,
    mime_type: str,
    prompt: str | None,
) -> GatewayTranscriptionResponse:
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
    return GatewayTranscriptionResponse(text=(response.text or "").strip(), usage=getattr(response, "usage", None))


def suggest_minutes_json(system_instruction: str, user_prompt: str) -> GatewayChatResponse:
    response = _client().chat.completions.create(
        model="gpt-5-nano",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
    )
    content = response.choices[0].message.content or "{}"
    return GatewayChatResponse(content=content, usage=getattr(response, "usage", None))
