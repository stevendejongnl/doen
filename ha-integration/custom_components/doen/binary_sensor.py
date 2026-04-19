"""Doen binary sensor — has_overdue."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
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
    async_add_entities([DoenOverdueBinarySensor(coordinator)])


class DoenOverdueBinarySensor(CoordinatorEntity, BinarySensorEntity):
    _attr_name = "Doen Achterstallig"
    _attr_unique_id = "doen_has_overdue"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:alert"

    def __init__(self, coordinator: DoenCoordinator) -> None:
        super().__init__(coordinator)

    @property
    def is_on(self) -> bool:
        return bool(self.coordinator.data.get("has_overdue", False)) if self.coordinator.data else False
