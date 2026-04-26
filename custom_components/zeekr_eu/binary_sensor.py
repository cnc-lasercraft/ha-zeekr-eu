"""Binary sensor platform for Zeekr EU Integration."""

from __future__ import annotations

import json

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity


def _parse_storage_box_status(value) -> bool | None:
    """Parse storageBoxStatus JSON-encoded array; True if any box has status='1'."""
    if value is None or value == "":
        return None
    try:
        boxes = json.loads(value) if isinstance(value, str) else value
        if not isinstance(boxes, list):
            return None
        return any(str(b.get("status")) == "1" for b in boxes if isinstance(b, dict))
    except (json.JSONDecodeError, TypeError, AttributeError):
        return None


class ZeekrBinarySensor(ZeekrEntity, BinarySensorEntity):
    """Zeekr Binary Sensor class."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        key: str,
        name: str,
        value_fn,
        device_class: BinarySensorDeviceClass | None = None,
    ) -> None:
        """Initialize the binary sensor."""
        super().__init__(coordinator, vin)
        self.key = key
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} {name}"
        self._attr_unique_id = f"{vin}_{key}"
        self._value_fn = value_fn
        self._attr_device_class = device_class

    @property
    def is_on(self) -> bool | None:
        """Return true if the binary sensor is on."""
        data = self.coordinator.data.get(self.vin, {})
        if not data:
            return None
        return self._value_fn(data)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the binary sensor platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = []
    for vin in coordinator.data:
        # Charging Status
        entities.append(
            ZeekrBinarySensor(
                coordinator,
                vin,
                "charging_status",
                "Charging Status",
                lambda d: int(
                    d.get("additionalVehicleStatus", {})
                    .get("electricVehicleStatus", {})
                    .get("chargerState", "0")
                ) in [1, 2, 3, 15],
                BinarySensorDeviceClass.BATTERY_CHARGING,
            )
        )
        # Plugged In Status
        entities.append(
            ZeekrBinarySensor(
                coordinator,
                vin,
                "plugged_in",
                "Plugged In",
                lambda d: int(
                    d.get("additionalVehicleStatus", {})
                    .get("electricVehicleStatus", {})
                    .get("statusOfChargerConnection")
                ),
                BinarySensorDeviceClass.PLUG,
            )
        )

        # Door open sensors from drivingSafetyStatus
        door_fields = {
            "door_open_driver": ("doorOpenStatusDriver", "Driver door open"),
            "door_open_passenger": ("doorOpenStatusPassenger", "Passenger door open"),
            "door_open_driver_rear": (
                "doorOpenStatusDriverRear",
                "Driver rear door open",
            ),
            "door_open_passenger_rear": (
                "doorOpenStatusPassengerRear",
                "Passenger rear door open",
            ),
            "trunk_open": ("trunkOpenStatus", "Trunk open"),
            "hood_open": ("engineHoodOpenStatus", "Hood open"),
        }

        for key, (field_name, label) in door_fields.items():
            entities.append(
                ZeekrBinarySensor(
                    coordinator,
                    vin,
                    key,
                    label,
                    lambda d, f=field_name: (
                        None
                        if (
                            v := d.get("additionalVehicleStatus", {})
                            .get("drivingSafetyStatus", {})
                            .get(f)
                        )
                        is None
                        else str(v) == "1"
                    ),
                    BinarySensorDeviceClass.DOOR,
                )
            )

        # Tire Pre-Warning & Temp Warning
        for tire in ["Driver", "Passenger", "DriverRear", "PassengerRear"]:
            # Pre-Warning
            entities.append(
                ZeekrBinarySensor(
                    coordinator,
                    vin,
                    f"tire_pre_warning_{tire.lower()}",
                    f"Tire Pre-Warning {tire}",
                    lambda d, t=tire: (
                        None
                        if (
                            v := d.get("additionalVehicleStatus", {})
                            .get("maintenanceStatus", {})
                            .get(f"tyrePreWarning{t}")
                        )
                        is None
                        else str(v) != "0"
                    ),
                    BinarySensorDeviceClass.PROBLEM,
                )
            )
            # Temp Warning
            entities.append(
                ZeekrBinarySensor(
                    coordinator,
                    vin,
                    f"tire_temp_warning_{tire.lower()}",
                    f"Tire Temp Warning {tire}",
                    lambda d, t=tire: (
                        None
                        if (
                            v := d.get("additionalVehicleStatus", {})
                            .get("maintenanceStatus", {})
                            .get(f"tyreTempWarning{t}")
                        )
                        is None
                        else str(v) != "0"
                    ),
                    BinarySensorDeviceClass.PROBLEM,
                )
            )

        # Engine running (38)
        entities.append(
            ZeekrBinarySensor(
                coordinator,
                vin,
                "engine_running",
                "Engine Running",
                lambda d: (
                    None
                    if (v := d.get("basicVehicleStatus", {}).get("engineStatus")) is None
                    or v == ""
                    else v == "engine-on"
                ),
                BinarySensorDeviceClass.RUNNING,
            )
        )

        # Fragrance active (44)
        entities.append(
            ZeekrBinarySensor(
                coordinator,
                vin,
                "fragrance_active",
                "Fragrance Active",
                lambda d: d.get("additionalVehicleStatus", {})
                .get("climateStatus", {})
                .get("fragActive"),
                None,
            )
        )

        # Storage box open (45)
        entities.append(
            ZeekrBinarySensor(
                coordinator,
                vin,
                "storage_box_open",
                "Storage Box Open",
                lambda d: _parse_storage_box_status(
                    d.get("additionalVehicleStatus", {})
                    .get("climateStatus", {})
                    .get("storageBoxStatus")
                ),
                BinarySensorDeviceClass.OPENING,
            )
        )

        # Charging needed - signals "I need power" based on configurable threshold
        entities.append(ZeekrChargingNeededBinarySensor(coordinator, vin))

        # PV Ladewunsch - signals "accept PV surplus" based on per-VIN ceiling
        entities.append(ZeekrPvLadewunschBinarySensor(coordinator, vin))

    async_add_entities(entities)


def _read_soc(coordinator, vin) -> float | None:
    """Helper to read current state of charge as float, or None if unavailable."""
    try:
        val = (
            coordinator.data.get(vin, {})
            .get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("chargeLevel")
        )
        return float(val) if val not in (None, "") else None
    except (ValueError, TypeError):
        return None


class ZeekrChargingNeededBinarySensor(ZeekrEntity, BinarySensorEntity):
    """Binary sensor that reports True when SoC is below the configured threshold."""

    _attr_device_class = BinarySensorDeviceClass.BATTERY
    _attr_icon = "mdi:battery-alert-variant-outline"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the entity."""
        super().__init__(coordinator, vin)
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} Charging Needed"
        self._attr_unique_id = f"{vin}_charging_needed"

    def _current_soc(self) -> float | None:
        """Return current state of charge as float or None."""
        try:
            val = (
                self.coordinator.data.get(self.vin, {})
                .get("additionalVehicleStatus", {})
                .get("electricVehicleStatus", {})
                .get("chargeLevel")
            )
            return float(val) if val not in (None, "") else None
        except (ValueError, TypeError):
            return None

    def _threshold(self) -> float:
        """Return current threshold from per-VIN ZeekrConfigState."""
        return float(self.coordinator.get_config(self.vin).charging_needed_threshold)

    @property
    def is_on(self) -> bool | None:
        """Return true if SoC is below threshold."""
        soc = self._current_soc()
        if soc is None:
            return None
        return soc < self._threshold()

    @property
    def extra_state_attributes(self):
        """Expose SoC and threshold for diagnostics."""
        return {
            "state_of_charge": self._current_soc(),
            "threshold": self._threshold(),
        }


class ZeekrPvLadewunschBinarySensor(ZeekrEntity, BinarySensorEntity):
    """Binary sensor that reports True when SoC is below the car's charging limit.

    Uses the cloud-side charging_limit (set via Zeekr app or our number entity)
    as the single source of truth for "stop charging at this SoC". huawei_solar
    reads the aggregated `aktives_fahrzeug_pv_ladewunsch` and gates PV charging
    on it — without this gate the wallbox keeps trying to charge a car already
    at its limit, triggering OCPP rejects.
    """

    _attr_icon = "mdi:solar-power-variant"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the entity."""
        super().__init__(coordinator, vin)
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} PV Ladewunsch"
        self._attr_unique_id = f"{vin}_pv_ladewunsch"

    def _current_soc(self) -> float | None:
        """Return current state of charge as float or None."""
        try:
            val = (
                self.coordinator.data.get(self.vin, {})
                .get("additionalVehicleStatus", {})
                .get("electricVehicleStatus", {})
                .get("chargeLevel")
            )
            return float(val) if val not in (None, "") else None
        except (ValueError, TypeError):
            return None

    def _charging_limit(self) -> float | None:
        """Return car's cloud-side charging limit (0-100), or None if unknown."""
        try:
            val = (
                self.coordinator.data.get(self.vin, {})
                .get("chargingLimit", {})
                .get("soc")
            )
            # API returns value * 10 (e.g. 890 -> 89.0)
            return float(val) / 10.0 if val not in (None, "") else None
        except (ValueError, TypeError):
            return None

    @property
    def is_on(self) -> bool | None:
        """Return true if SoC is below the car's charging limit."""
        soc = self._current_soc()
        limit = self._charging_limit()
        if soc is None or limit is None:
            return None
        return soc < limit

    @property
    def extra_state_attributes(self):
        """Expose SoC and limit for diagnostics."""
        return {
            "state_of_charge": self._current_soc(),
            "charging_limit": self._charging_limit(),
        }
