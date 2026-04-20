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
    async_add_entities([
        DoenCountSensor(coordinator, "tasks_total", "Doen Taken Totaal", "mdi:format-list-checks"),
        DoenCountSensor(coordinator, "tasks_due_today", "Doen Taken Vandaag", "mdi:calendar-today"),
        DoenCountSensor(coordinator, "tasks_overdue", "Doen Achterstallige Taken", "mdi:alert-circle"),
    ])


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
