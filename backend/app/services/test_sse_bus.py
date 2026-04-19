import json

import pytest

from app.services.sse_bus import SSEBus


@pytest.fixture
def bus() -> SSEBus:
    return SSEBus()


@pytest.mark.asyncio
async def test_subscribe_returns_queue(bus):
    q = bus.subscribe("user-1")
    assert q is not None


@pytest.mark.asyncio
async def test_publish_delivers_to_subscriber(bus):
    # Given a subscriber
    q = bus.subscribe("user-1")

    # When a message is published
    await bus.publish("user-1", "task_created", {"id": "task-abc"})

    # Then the message is in the queue
    msg = q.get_nowait()
    assert "task_created" in msg
    assert "task-abc" in msg


@pytest.mark.asyncio
async def test_publish_does_not_deliver_to_other_users(bus):
    # Given two subscribers
    q1 = bus.subscribe("user-1")
    q2 = bus.subscribe("user-2")

    # When publishing to user-1
    await bus.publish("user-1", "ping", {"x": 1})

    # Then user-1 gets the message
    assert not q1.empty()
    # Then user-2 does not
    assert q2.empty()


@pytest.mark.asyncio
async def test_publish_to_group_delivers_to_all(bus):
    # Given three subscribers
    q1 = bus.subscribe("u1")
    q2 = bus.subscribe("u2")
    q3 = bus.subscribe("u3")

    # When publishing to a group
    await bus.publish_to_group(["u1", "u2"], "task_completed", {"id": "t1"})

    # Then u1 and u2 get it, u3 does not
    assert not q1.empty()
    assert not q2.empty()
    assert q3.empty()


@pytest.mark.asyncio
async def test_unsubscribe_removes_queue(bus):
    # Given a subscriber who unsubscribes
    q = bus.subscribe("user-1")
    bus.unsubscribe("user-1", q)

    # When publishing after unsubscribe
    await bus.publish("user-1", "ping", {})

    # Then the queue is still empty (was removed)
    assert q.empty()


@pytest.mark.asyncio
async def test_message_is_valid_sse_format(bus):
    q = bus.subscribe("u1")
    await bus.publish("u1", "task_updated", {"id": "xyz", "title": "Clean kitchen"})

    raw = q.get_nowait()
    # SSE format: "event: ...\ndata: ...\n\n"
    assert raw.startswith("event: task_updated\n")
    assert "data: " in raw
    data_line = [line for line in raw.split("\n") if line.startswith("data: ")][0]
    payload = json.loads(data_line[len("data: "):])
    assert payload["id"] == "xyz"
