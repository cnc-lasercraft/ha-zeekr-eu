"""DateTime platform for Zeekr EU Integration (one-shot Vorbereitung)."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.datetime import DateTimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the datetime platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[DateTimeEntity] = []
    for vehicle in coordinator.vehicles:
        entities.append(ZeekrEinmaligZeitDateTime(coordinator, vehicle.vin))
        entities.append(ZeekrCloudTravelPlanZeitDateTime(coordinator, vehicle.vin))
    async_add_entities(entities)


class ZeekrEinmaligZeitDateTime(ZeekrEntity, RestoreEntity, DateTimeEntity):
    """DateTime entity for the one-shot preconditioning departure."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Einmalig Zeit"
        self._attr_unique_id = f"{vin}_vorbereitung_einmalig_zeit"

    @property
    def native_value(self) -> datetime | None:
        return self.coordinator.get_vorbereitung(self.vin).einmalig.zeit

    async def async_set_value(self, value: datetime) -> None:
        # HA passes a tz-aware datetime
        self.coordinator.get_vorbereitung(self.vin).einmalig.zeit = value
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state not in (None, "", "unknown", "unavailable"):
            parsed = dt_util.parse_datetime(last.state)
            if parsed is not None:
                self.coordinator.get_vorbereitung(self.vin).einmalig.zeit = parsed


class ZeekrCloudTravelPlanZeitDateTime(ZeekrEntity, RestoreEntity, DateTimeEntity):
    """DateTime entity for the cloud-side travel plan departure."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG
    _attr_icon = "mdi:cloud-clock"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Cloud Zeit"
        self._attr_unique_id = f"{vin}_cloud_travel_plan_zeit"

    @property
    def native_value(self) -> datetime | None:
        return self.coordinator.get_config(self.vin).cloud_travel_plan_zeit

    async def async_set_value(self, value: datetime) -> None:
        self.coordinator.get_config(self.vin).cloud_travel_plan_zeit = value
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state not in (None, "", "unknown", "unavailable"):
            parsed = dt_util.parse_datetime(last.state)
            if parsed is not None:
                self.coordinator.get_config(self.vin).cloud_travel_plan_zeit = parsed
