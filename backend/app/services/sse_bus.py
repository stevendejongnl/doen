import asyncio
import json
from collections import defaultdict
from typing import Any


class SSEBus:
    def __init__(self) -> None:
        # user_id → list of queues
        self._queues: dict[str, list[asyncio.Queue[str | None]]] = defaultdict(list)

    def subscribe(self, user_id: str) -> asyncio.Queue[str | None]:
        q: asyncio.Queue[str | None] = asyncio.Queue()
        self._queues[user_id].append(q)
        return q

    def unsubscribe(self, user_id: str, q: asyncio.Queue[str | None]) -> None:
        self._queues[user_id].remove(q)
        if not self._queues[user_id]:
            del self._queues[user_id]

    async def publish(self, user_id: str, event: str, data: Any) -> None:
        message = f"event: {event}\ndata: {json.dumps(data)}\n\n"
        for q in list(self._queues.get(user_id, [])):
            await q.put(message)

    async def publish_to_group(self, user_ids: list[str], event: str, data: Any) -> None:
        for uid in user_ids:
            await self.publish(uid, event, data)


sse_bus = SSEBus()
