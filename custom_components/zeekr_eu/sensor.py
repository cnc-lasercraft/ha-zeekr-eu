"""Sensor platform for Zeekr EU Integration."""

from __future__ import annotations

import logging

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .api import zeekr_app_sig
from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity
from .sensor_definitions import build_vehicle_sensors

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities: list[SensorEntity] = []

    # Add API Status sensor with token attributes (one per integration, not per vehicle)
    entities.append(ZeekrAPIStatusSensor(coordinator, entry.entry_id))

    # Add API stats sensors (global, not per vehicle)
    entities.append(
        ZeekrAPIStatSensor(
            coordinator,
            entry.entry_id,
            "api_requests_today",
            "API Requests Today",
            lambda stats: stats.api_requests_today,
        )
    )
    entities.append(
        ZeekrAPIStatSensor(
            coordinator,
            entry.entry_id,
            "api_invokes_today",
            "API Invokes Today",
            lambda stats: stats.api_invokes_today,
        )
    )
    entities.append(
        ZeekrAPIStatSensor(
            coordinator,
            entry.entry_id,
            "api_requests_total",
            "API Requests Total",
            lambda stats: stats.api_requests_total,
        )
    )
    entities.append(
        ZeekrAPIStatSensor(
            coordinator,
            entry.entry_id,
            "api_invokes_total",
            "API Invokes Total",
            lambda stats: stats.api_invokes_total,
        )
    )

    # coordinator.data might be None or empty on first setup
    if not coordinator.data:
        async_add_entities(entities)
        return

    for vin, data in coordinator.data.items():
        entities.extend(
            build_vehicle_sensors(
                coordinator, vin, data, ZeekrSensor, ZeekrChargerStateSensor
            )
        )
    async_add_entities(entities)


class ZeekrSensor(ZeekrEntity, SensorEntity):
    """Zeekr Sensor class."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        key: str,
        name: str,
        value_fn,
        unit: str | None = None,
        device_class: SensorDeviceClass | None = None,
        state_class: SensorStateClass | None = None,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, vin)
        self.key = key
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} {name}"
        self._attr_unique_id = f"{vin}_{key}"
        self._value_fn = value_fn
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class
        self._attr_state_class = state_class

    @property
    def native_value(self):
        """Return the state of the sensor."""
        data = self.coordinator.data.get(self.vin, {})
        if not data:
            return None
        return self._value_fn(data)


class ZeekrAPIStatusSensor(CoordinatorEntity, SensorEntity):
    """Zeekr API Status sensor with token attributes."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        entry_id: str,
    ) -> None:
        """Initialize the API status sensor."""
        super().__init__(coordinator)
        self._entry_id = entry_id
        self._attr_name = "Zeekr API Status"
        self._attr_unique_id = f"{entry_id}_api_status"
        self._attr_icon = "mdi:api"

    @property
    def device_info(self):
        """Return device info to associate with main Zeekr API device."""
        return {
            "identifiers": {(DOMAIN, self._entry_id)},
            "name": "Zeekr API",
            "manufacturer": "Zeekr",
            "model": "API Integration",
        }

    @property
    def native_value(self):
        """Return the state of the sensor."""
        if self.coordinator.client and self.coordinator.client.logged_in:
            return "Connected"
        return "Disconnected"

    @property
    def extra_state_attributes(self):
        """Return connection diagnostics. Tokens are masked — never expose
        raw JWTs as entity attributes (they end up in the frontend, history
        and logbook)."""
        attrs = {}
        client = self.coordinator.client
        if client:
            attrs["auth_token_present"] = bool(client.auth_token)
            attrs["bearer_token_present"] = bool(client.bearer_token)
            attrs["logged_in"] = client.logged_in
            attrs["username"] = getattr(client, "username", None)
            attrs["region_code"] = getattr(client, "region_code", None)
            attrs["app_server_host"] = getattr(client, "app_server_host", None)
            attrs["usercenter_host"] = getattr(client, "usercenter_host", None)
            # Include vehicle count
            attrs["vehicle_count"] = (
                len(self.coordinator.vehicles) if self.coordinator.vehicles else 0
            )
            # Include X-VIN (encrypted VIN) for each vehicle
            if self.coordinator.vehicles:
                try:
                    x_vins = {}
                    for vehicle in self.coordinator.vehicles:
                        vin = vehicle.vin
                        encrypted_vin = zeekr_app_sig.aes_encrypt(
                            vin, client.vin_key, client.vin_iv
                        )
                        x_vins[vin] = encrypted_vin
                    attrs["x_vins"] = x_vins
                except Exception as e:
                    _LOGGER.error("Failed to generate X-VIN: %s", e)
        return attrs


# Dedicated sensor for API stats
class ZeekrAPIStatSensor(CoordinatorEntity, SensorEntity):
    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        entry_id: str,
        key: str,
        name: str,
        value_fn,
    ) -> None:
        super().__init__(coordinator)
        self._entry_id = entry_id
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_{key}"
        self._value_fn = value_fn
        self._attr_icon = "mdi:counter"

    @property
    def native_value(self):
        stats = getattr(self.coordinator, "request_stats", None)
        if stats:
            return self._value_fn(stats)
        return None

    @property
    def device_info(self):
        """Return device info."""
        return {
            "identifiers": {(DOMAIN, self._entry_id)},
            "name": "Zeekr API",
            "manufacturer": "Zeekr",
            "model": "API Integration",
        }


class ZeekrChargerStateSensor(ZeekrEntity, SensorEntity):
    """Sensor to expose raw chargerState value for diagnostics."""
    def __init__(self, coordinator: ZeekrCoordinator, vin: str):
        super().__init__(coordinator, vin)
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} Charger State"
        self._attr_unique_id = f"{vin}_charger_state"

    @property
    def state(self):
        return (
            self.coordinator.data.get(self.vin, {})
            .get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("chargerState")
        )

    @property
    def extra_state_attributes(self):
        return {
            "raw_charger_state": self.state
        }
