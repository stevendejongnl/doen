from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import settings

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "emails"


def _build_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.smtp_user,
        MAIL_PASSWORD=settings.smtp_password,
        MAIL_FROM=settings.smtp_from,
        MAIL_FROM_NAME=settings.smtp_from_name,
        MAIL_PORT=settings.smtp_port,
        MAIL_SERVER=settings.smtp_host or "localhost",
        MAIL_STARTTLS=settings.smtp_use_starttls,
        MAIL_SSL_TLS=settings.smtp_use_tls,
        USE_CREDENTIALS=bool(settings.smtp_user),
        VALIDATE_CERTS=True,
        TEMPLATE_FOLDER=_TEMPLATE_DIR,
    )


class MailService:
    """Thin wrapper around FastMail with a log-only fallback when MAIL_ENABLED=False."""

    def __init__(self) -> None:
        self._fm = FastMail(_build_config()) if settings.mail_enabled else None

    async def send(
        self,
        to: str,
        subject: str,
        template_name: str,
        context: dict[str, Any],
    ) -> None:
        if self._fm is None:
            logger.info(
                "MAIL_DISABLED — would send %r to %s (template=%s, context=%s)",
                subject,
                to,
                template_name,
                context,
            )
            return

        message = MessageSchema(
            subject=subject,
            recipients=[to],
            template_body=context,
            subtype=MessageType.html,
        )
        try:
            await self._fm.send_message(message, template_name=template_name)
            logger.info("Mail sent: %r → %s (template=%s)", subject, to, template_name)
        except Exception:
            logger.exception("Failed to send mail %r to %s", subject, to)
            raise

    def send_background(
        self,
        to: str,
        subject: str,
        template_name: str,
        context: dict[str, Any],
    ) -> None:
        """Fire-and-forget — never blocks or raises into the caller's request path."""

        async def _runner() -> None:
            try:
                await self.send(to, subject, template_name, context)
            except Exception:
                logger.exception("Background mail failed for %s", to)

        try:
            asyncio.get_running_loop().create_task(_runner())
        except RuntimeError:
            logger.warning("send_background called without a running loop; dropping mail to %s", to)


@lru_cache(maxsize=1)
def get_mail_service() -> MailService:
    return MailService()
