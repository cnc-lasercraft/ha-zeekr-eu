"""Time platform for Zeekr EU Integration (Vorbereitung slots)."""

from __future__ import annotations

from datetime import time as dtime

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity
from .vorbereitung import NUM_SLOTS


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the time platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[TimeEntity] = []
    for vehicle in coordinator.vehicles:
        for slot_idx in range(NUM_SLOTS):
            entities.append(ZeekrSlotZeitTime(coordinator, vehicle.vin, slot_idx))
        entities.append(ZeekrDeadlineZeitTime(coordinator, vehicle.vin))
    async_add_entities(entities)


class ZeekrSlotZeitTime(ZeekrEntity, RestoreEntity, TimeEntity):
    """Time entity for a recurring slot's departure time."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG
    _attr_icon = "mdi:clock-time-eight-outline"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str, slot_idx: int) -> None:
        super().__init__(coordinator, vin)
        self._slot_idx = slot_idx
        self._attr_name = f"Vorklimatisieren Slot {slot_idx + 1} Zeit"
        self._attr_unique_id = f"{vin}_vorbereitung_slot{slot_idx + 1}_zeit"

    @property
    def native_value(self) -> dtime | None:
        return self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx].zeit

    async def async_set_value(self, value: dtime) -> None:
        self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx].zeit = value
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state not in (None, "", "unknown", "unavailable"):
            try:
                parts = last.state.split(":")
                hour = int(parts[0])
                minute = int(parts[1]) if len(parts) > 1 else 0
                self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx].zeit = dtime(
                    hour, minute
                )
            except (ValueError, IndexError):
                pass


class ZeekrDeadlineZeitTime(ZeekrEntity, RestoreEntity, TimeEntity):
    """Time entity for the next charging deadline (fertig bis HH:MM).

    Scheduler-card (HACS nielsfaber/scheduler-card) schreibt diesen Wert pro
    Wochenplan; huawei_solar Ladeplanung liest ihn als Deadline.
    """

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG
    _attr_icon = "mdi:clock-end"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Deadline Zeit"
        self._attr_unique_id = f"{vin}_deadline_zeit"

    @property
    def native_value(self) -> dtime | None:
        return self.coordinator.get_config(self.vin).deadline_zeit

    async def async_set_value(self, value: dtime) -> None:
        self.coordinator.get_config(self.vin).deadline_zeit = value
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state not in (None, "", "unknown", "unavailable"):
            try:
                parts = last.state.split(":")
                self.coordinator.get_config(self.vin).deadline_zeit = dtime(
                    int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                )
            except (ValueError, IndexError):
                pass
