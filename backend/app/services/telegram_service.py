"""Telegram notification service for deployment/lifecycle events."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import httpx

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org"
_HTTP_TIMEOUT = 10.0


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


class TelegramNotificationService:
    """Fire-and-forget notifications to a Telegram chat.

    Any failure (missing creds, network, API error) is logged but never raised — lifecycle
    hooks must not block app startup/shutdown because a bot is down.
    """

    def __init__(
        self,
        bot_token: str,
        chat_id: str,
        app_name: str = "Doen",
        app_url: str | None = None,
    ) -> None:
        self._bot_token = bot_token
        self._chat_id = chat_id
        self._app_name = app_name
        self._app_url = app_url

    def _configured(self) -> bool:
        return bool(self._bot_token and self._chat_id)

    async def _send(self, message: str, silent: bool = False) -> None:
        if not self._configured():
            logger.info("Telegram not configured, skipping notification")
            return
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.post(
                    f"{_TELEGRAM_API}/bot{self._bot_token}/sendMessage",
                    json={
                        "chat_id": self._chat_id,
                        "text": message,
                        "parse_mode": "HTML",
                        "disable_notification": silent,
                        "disable_web_page_preview": False,
                    },
                )
            if resp.status_code != 200:
                logger.warning("Telegram API returned %s: %s", resp.status_code, resp.text[:200])
        except httpx.TimeoutException:
            logger.warning("Telegram notification timed out")
        except httpx.RequestError as e:
            logger.warning("Telegram request error: %s", e)
        except Exception as e:  # noqa: BLE001 — belt-and-braces, must not raise
            logger.warning("Unexpected Telegram error: %s", e)

    def _footer(self) -> str:
        if not self._app_url:
            return ""
        return f'\n\n<a href="{self._app_url}">Open {_escape_html(self._app_name)}</a>'

    async def send_startup(self, version: str, pod_name: str | None = None) -> None:
        ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        msg = (
            f"<b>🚀 {_escape_html(self._app_name)} started</b>\n\n"
            f"<b>Version:</b> {_escape_html(version)}\n"
            f"<b>Timestamp:</b> {ts}"
        )
        if pod_name:
            msg += f"\n<b>Pod:</b> <code>{_escape_html(pod_name)}</code>"
        msg += self._footer()
        await self._send(msg)

    async def send_shutdown(
        self,
        version: str,
        pod_name: str | None = None,
        reason: str = "graceful",
    ) -> None:
        ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        msg = (
            f"<b>🔄 {_escape_html(self._app_name)} shutting down</b>\n\n"
            f"<b>Reason:</b> {_escape_html(reason)}\n"
            f"<b>Version:</b> {_escape_html(version)}\n"
            f"<b>Timestamp:</b> {ts}"
        )
        if pod_name:
            msg += f"\n<b>Pod:</b> <code>{_escape_html(pod_name)}</code>"
        msg += self._footer()
        await self._send(msg, silent=True)

    async def send_crash(
        self,
        error: BaseException,
        version: str,
        pod_name: str | None = None,
    ) -> None:
        ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        error_type = type(error).__name__
        error_text = str(error)[:500]
        msg = (
            f"<b>❌ {_escape_html(self._app_name)} crashed</b>\n\n"
            f"<b>Error:</b> {_escape_html(error_type)}\n"
            f"<b>Message:</b> <code>{_escape_html(error_text)}</code>\n"
            f"<b>Version:</b> {_escape_html(version)}\n"
            f"<b>Timestamp:</b> {ts}"
        )
        if pod_name:
            msg += f"\n<b>Pod:</b> <code>{_escape_html(pod_name)}</code>"
        msg += self._footer()
        await self._send(msg)

    async def send_health_failure(
        self,
        reason: str,
        version: str,
        pod_name: str | None = None,
    ) -> None:
        ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        msg = (
            f"<b>⚠️ {_escape_html(self._app_name)} unhealthy</b>\n\n"
            f"<b>Reason:</b> <code>{_escape_html(reason)}</code>\n"
            f"<b>Version:</b> {_escape_html(version)}\n"
            f"<b>Timestamp:</b> {ts}"
        )
        if pod_name:
            msg += f"\n<b>Pod:</b> <code>{_escape_html(pod_name)}</code>"
        msg += self._footer()
        await self._send(msg, silent=True)
