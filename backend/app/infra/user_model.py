from dataclasses import dataclass


# 저장용 레코드
@dataclass(frozen=True, slots=True)
class UserModel:
    id: str
    name: str
    email: str
    password: str

# 보안상의 이유로 인증된 사용자 정보에는 비밀번호를 포함하지 않는다.
@dataclass(frozen=True, slots=True)
class AuthUserModel:
    id: str
    name: str
    email: str
