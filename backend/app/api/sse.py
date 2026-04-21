import asyncio
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user_sse
from app.models.user import User
from app.services.sse_bus import sse_bus

router = APIRouter(tags=["sse"])


@router.get("/events")
async def events(current_user: User = Depends(get_current_user_sse)) -> EventSourceResponse:
    async def generator() -> AsyncGenerator[str]:
        q = sse_bus.subscribe(current_user.id)
        try:
            yield "data: connected\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(q.get(), timeout=30.0)
                    if message is None:
                        break
                    yield message
                except TimeoutError:
                    # keepalive ping
                    yield ": ping\n\n"
        finally:
            sse_bus.unsubscribe(current_user.id, q)

    return EventSourceResponse(generator())
