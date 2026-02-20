from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DomainError:
    code: str
    message: str
