from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.reservation_label_repo import (
    add_reservation_label,
    delete_reservation_label,
    find_reservation_label,
    list_reservation_labels,
    rename_reservation_label,
)
from app.service.admin_service import is_admin_user
from app.service.auth_service import AuthUser
from app.service.domain import DomainError

NONE_LABEL = "없음"


@dataclass(frozen=True, slots=True)
class ReservationLabelItem:
    name: str


async def list_labels(db: AsyncSession) -> list[ReservationLabelItem]:
    names = await list_reservation_labels(db)
    return [ReservationLabelItem(name=name) for name in names]


async def create_label(name: str, auth_user: AuthUser, db: AsyncSession) -> ReservationLabelItem | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 라벨을 관리할 수 있습니다.")

    normalized = name.strip()
    if not normalized:
        return DomainError(code="INVALID_ARGUMENT", message="라벨 이름은 비어 있을 수 없습니다.")

    duplicated = await find_reservation_label(db, normalized)
    if duplicated is not None:
        return DomainError(code="CONFLICT", message="이미 존재하는 라벨입니다.")

    add_reservation_label(db, normalized)
    await db.commit()
    return ReservationLabelItem(name=normalized)


async def update_label(
    old_name: str,
    new_name: str,
    auth_user: AuthUser,
    db: AsyncSession,
) -> ReservationLabelItem | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 라벨을 관리할 수 있습니다.")

    old_normalized = old_name.strip()
    new_normalized = new_name.strip()
    if not old_normalized or not new_normalized:
        return DomainError(code="INVALID_ARGUMENT", message="라벨 이름은 비어 있을 수 없습니다.")
    if old_normalized == NONE_LABEL:
        return DomainError(code="INVALID_ARGUMENT", message="'없음' 라벨은 수정할 수 없습니다.")

    target = await find_reservation_label(db, old_normalized)
    if target is None:
        return DomainError(code="NOT_FOUND", message="라벨을 찾을 수 없습니다.")

    duplicated = await find_reservation_label(db, new_normalized)
    if duplicated is not None and duplicated.name != old_normalized:
        return DomainError(code="CONFLICT", message="이미 존재하는 라벨입니다.")

    if old_normalized != new_normalized:
        target.name = new_normalized
        await rename_reservation_label(db, old_normalized, new_normalized)
        await db.commit()

    return ReservationLabelItem(name=new_normalized)


async def remove_label(name: str, auth_user: AuthUser, db: AsyncSession) -> None | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 라벨을 관리할 수 있습니다.")

    normalized = name.strip()
    if not normalized:
        return DomainError(code="INVALID_ARGUMENT", message="라벨 이름은 비어 있을 수 없습니다.")
    if normalized == NONE_LABEL:
        return DomainError(code="INVALID_ARGUMENT", message="'없음' 라벨은 삭제할 수 없습니다.")

    label = await find_reservation_label(db, normalized)
    if label is None:
        return DomainError(code="NOT_FOUND", message="라벨을 찾을 수 없습니다.")

    await delete_reservation_label(db, normalized)
    await db.commit()
    return None
