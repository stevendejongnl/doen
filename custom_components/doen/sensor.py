"""Doen sensor entities."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import DoenCoordinator
from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: DoenCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities: list[SensorEntity] = [
        DoenCountSensor(coordinator, "tasks_total", "Doen Taken Totaal", "mdi:format-list-checks"),
        DoenCountSensor(coordinator, "tasks_due_today", "Doen Taken Vandaag", "mdi:calendar-today"),
        DoenCountSensor(coordinator, "tasks_overdue", "Doen Achterstallige Taken", "mdi:alert-circle"),
        DoenPointsSensor(coordinator),
    ]

    for group in (coordinator.data or {}).get("groups", []):
        entities.append(DoenGroupSensor(coordinator, group["id"], group["name"]))

    async_add_entities(entities)


class DoenCountSensor(CoordinatorEntity, SensorEntity):
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "taken"

    def __init__(self, coordinator: DoenCoordinator, key: str, name: str, icon: str) -> None:
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_icon = icon
        self._attr_unique_id = f"doen_{key}"

    @property
    def native_value(self) -> int:
        return self.coordinator.data.get(self._key, 0) if self.coordinator.data else 0


class DoenPointsSensor(CoordinatorEntity, SensorEntity):
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "punten"
    _attr_name = "Doen Punten Deze Week"
    _attr_unique_id = "doen_points_this_week"
    _attr_icon = "mdi:star-circle"

    def __init__(self, coordinator: DoenCoordinator) -> None:
        super().__init__(coordinator)

    @property
    def native_value(self) -> int:
        return self.coordinator.data.get("points_this_week", 0) if self.coordinator.data else 0


class DoenGroupSensor(CoordinatorEntity, SensorEntity):
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "taken"
    _attr_icon = "mdi:account-group"

    def __init__(self, coordinator: DoenCoordinator, group_id: str, group_name: str) -> None:
        super().__init__(coordinator)
        self._group_id = group_id
        self._attr_name = f"Doen {group_name} Taken"
        self._attr_unique_id = f"doen_group_{group_id}_tasks_total"

    def _group_data(self) -> dict:
        for g in (self.coordinator.data or {}).get("groups", []):
            if g["id"] == self._group_id:
                return g
        return {}

    @property
    def native_value(self) -> int:
        return self._group_data().get("tasks_total", 0)

    @property
    def extra_state_attributes(self) -> dict:
        g = self._group_data()
        return {
            "tasks_due_today": g.get("tasks_due_today", 0),
            "tasks_overdue": g.get("tasks_overdue", 0),
        }
