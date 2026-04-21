"""Access-policy rules for admin-triggered actions on users.

Invariants:
- There is always at least one active admin (otherwise the instance is orphaned).
- An admin cannot disable or delete themselves via the admin path.
- A hard-delete never orphans FK rows that aren't ON DELETE CASCADE.
"""
from __future__ import annotations

from app.exceptions import AccessDeniedError, ConflictError
from app.models.user import User


def ensure_can_disable(actor: User, target: User, active_admin_count: int) -> None:
    if actor.id == target.id:
        raise AccessDeniedError("Je kunt je eigen account niet uitschakelen.")
    if target.is_admin and target.disabled_at is None and active_admin_count <= 1:
        raise ConflictError(
            "Dit is de laatste actieve beheerder — promoveer eerst iemand anders."
        )


def ensure_can_delete(
    actor: User, target: User, active_admin_count: int, owned_counts: dict[str, int]
) -> None:
    if actor.id == target.id:
        raise AccessDeniedError(
            "Verwijder je eigen account via de Account-pagina, niet via Gebruikersbeheer."
        )
    if target.is_admin and target.disabled_at is None and active_admin_count <= 1:
        raise ConflictError(
            "Dit is de laatste actieve beheerder — promoveer eerst iemand anders."
        )
    blocking = {k: v for k, v in owned_counts.items() if v > 0}
    if blocking:
        summary = ", ".join(f"{k} ({v})" for k, v in blocking.items())
        raise ConflictError(
            f"Gebruiker bezit nog data: {summary}. "
            "Schakel het account eerst uit of draag de data over."
        )


def ensure_can_demote(actor: User, target: User, active_admin_count: int) -> None:
    if actor.id == target.id:
        raise AccessDeniedError("Je kunt je eigen beheerdersrechten niet intrekken.")
    if active_admin_count <= 1:
        raise ConflictError(
            "Dit is de laatste actieve beheerder — promoveer eerst iemand anders."
        )
