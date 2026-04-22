"""Number platform for Zeekr EU Integration."""

from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.components.number import NumberEntity, RestoreNumber
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfTemperature, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity
from .herold import async_notify as herold_notify
from .vorbereitung import NUM_SLOTS

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the number platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]

    # We create global configuration numbers, not per vehicle
    entities: list[NumberEntity] = [
        ZeekrPollingIntervalNumber(coordinator, entry.entry_id),
        ZeekrConfigNumber(
            coordinator,
            entry.entry_id,
            "seat_operation_duration",
            "Seat Operation Duration",
            "seat_duration",
        ),
        ZeekrConfigNumber(
            coordinator,
            entry.entry_id,
            "ac_operation_duration",
            "AC Operation Duration",
            "ac_duration",
        ),
        ZeekrConfigNumber(
            coordinator,
            entry.entry_id,
            "steering_wheel_heat_duration",
            "Steering Wheel Heat Duration",
            "steering_wheel_duration",
        ),
    ]

    for vehicle in coordinator.vehicles:
        entities.append(ZeekrChargingLimitNumber(coordinator, vehicle.vin))
        entities.append(ZeekrChargingNeededThreshold(coordinator, vehicle.vin))

        # Vorbereitung config numbers
        # Per slot: ac_temp, dauer, sitz_fahrer, sitz_beifahrer, sitz_hl, sitz_hr
        for slot_idx in range(NUM_SLOTS):
            entities.extend(_make_slot_numbers(coordinator, vehicle.vin, slot_idx))
        # Einmalig
        entities.extend(_make_einmalig_numbers(coordinator, vehicle.vin))
        # Sofort
        entities.extend(_make_sofort_numbers(coordinator, vehicle.vin))
        # Globals
        entities.extend(_make_global_numbers(coordinator, vehicle.vin))

        # User settings (migrated from legacy HA input_number helpers)
        entities.extend(_make_settings_numbers(coordinator, vehicle.vin))

    async_add_entities(entities)


def _make_settings_numbers(coordinator: ZeekrCoordinator, vin: str):
    """Create per-vehicle user configuration number entities."""
    return [
        # Tire pressures
        ZeekrSettingsNumber(
            coordinator, vin, "reifendruck_vorne_sommer",
            "Reifendruck Vorne Sommer", 1.5, 4.0, 0.1, "bar", "mdi:tire",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "reifendruck_hinten_sommer",
            "Reifendruck Hinten Sommer", 1.5, 4.0, 0.1, "bar", "mdi:tire",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "reifendruck_vorne_winter",
            "Reifendruck Vorne Winter", 1.5, 4.0, 0.1, "bar", "mdi:tire",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "reifendruck_hinten_winter",
            "Reifendruck Hinten Winter", 1.5, 4.0, 0.1, "bar", "mdi:tire",
        ),
        # Auto-Notladung (Default-Deadline): wenn User unter trigger_soc ankommt
        # ohne manuelle Deadline, wird automatisch ziel_soc innerhalb stunden geplant.
        ZeekrSettingsNumber(
            coordinator, vin, "auto_notladung_trigger_soc",
            "Auto Notladung Trigger SoC", 5, 50, 1, PERCENTAGE, "mdi:battery-alert-variant-outline",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "auto_notladung_ziel_soc",
            "Auto Notladung Ziel SoC", 20, 80, 5, PERCENTAGE, "mdi:battery-charging-80",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "auto_notladung_stunden",
            "Auto Notladung Zeitfenster", 1, 48, 1, UnitOfTime.HOURS, "mdi:clock-time-eight-outline",
        ),
        # Deadline (Ziel für scheduler-card + huawei_solar Ladeplanung)
        ZeekrSettingsNumber(
            coordinator, vin, "deadline_soc",
            "Deadline SoC", 0, 100, 5, PERCENTAGE, "mdi:battery-charging-high",
        ),
        # PV-Überschuss-Ceiling: Obergrenze fürs Weiterladen nach Deadline
        ZeekrSettingsNumber(
            coordinator, vin, "pv_ceiling_soc",
            "PV Ceiling SoC", 70, 100, 5, PERCENTAGE, "mdi:solar-power-variant",
        ),
        # Herold-Benachrichtigungs-Schwellwerte
        ZeekrSettingsNumber(
            coordinator, vin, "warnung_akku_soc",
            "Warnung Akku SoC", 5, 50, 1, PERCENTAGE, "mdi:battery-alert",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "warnung_offen_min",
            "Warnung Tuer Fenster offen", 1, 120, 1, UnitOfTime.MINUTES, "mdi:door-open",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "warnung_unverriegelt_min",
            "Warnung unverriegelt", 1, 240, 1, UnitOfTime.MINUTES, "mdi:lock-open-variant",
        ),
        ZeekrSettingsNumber(
            coordinator, vin, "warnung_deadline_vorlauf_min",
            "Warnung Deadline Vorlauf", 0, 240, 5, UnitOfTime.MINUTES, "mdi:bell-outline",
        ),
    ]


def _num_specs():
    """Field specs shared by slot/einmalig/sofort: (field, label, min, max, step, unit, icon)."""
    return [
        ("ac_temp", "AC Temperatur", 15, 28, 0.5, UnitOfTemperature.CELSIUS, "mdi:thermometer"),
        ("dauer", "Dauer", 5, 60, 1, UnitOfTime.MINUTES, "mdi:timer"),
        ("sitz_fahrer", "Sitzheizung Fahrer", 0, 3, 1, None, "mdi:car-seat-heater"),
        ("sitz_beifahrer", "Sitzheizung Beifahrer", 0, 3, 1, None, "mdi:car-seat-heater"),
        ("sitz_hl", "Sitzheizung Hinten Links", 0, 3, 1, None, "mdi:car-seat-heater"),
        ("sitz_hr", "Sitzheizung Hinten Rechts", 0, 3, 1, None, "mdi:car-seat-heater"),
    ]


def _make_slot_numbers(coordinator: ZeekrCoordinator, vin: str, slot_idx: int):
    return [
        ZeekrSlotNumber(coordinator, vin, slot_idx, *spec) for spec in _num_specs()
    ]


def _make_einmalig_numbers(coordinator: ZeekrCoordinator, vin: str):
    return [
        ZeekrEinmaligNumber(coordinator, vin, *spec) for spec in _num_specs()
    ]


def _make_sofort_numbers(coordinator: ZeekrCoordinator, vin: str):
    return [
        ZeekrSofortNumber(coordinator, vin, *spec) for spec in _num_specs()
    ]


def _make_global_numbers(coordinator: ZeekrCoordinator, vin: str):
    return [
        ZeekrGlobalNumber(
            coordinator, vin, "vorlaufzeit", "Vorklimatisieren Vorlaufzeit",
            5, 60, 5, UnitOfTime.MINUTES, "mdi:clock-start",
        ),
        ZeekrGlobalNumber(
            coordinator, vin, "wetter_schwelle_kalt", "Vorklimatisieren Wetter Kälte-Schwelle",
            -20, 20, 1, UnitOfTemperature.CELSIUS, "mdi:snowflake",
        ),
        ZeekrGlobalNumber(
            coordinator, vin, "wetter_extra_min", "Vorklimatisieren Wetter Extra-Minuten",
            0, 30, 1, UnitOfTime.MINUTES, "mdi:timer-plus",
        ),
    ]


class ZeekrPollingIntervalNumber(CoordinatorEntity, RestoreNumber):
    """Number entity to change polling interval at runtime."""

    _attr_has_entity_name = True
    _attr_native_min_value = 1
    _attr_native_max_value = 60
    _attr_native_step = 1
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES
    _attr_icon = "mdi:update"

    def __init__(self, coordinator: ZeekrCoordinator, entry_id: str) -> None:
        """Initialize the polling interval number."""
        super().__init__(coordinator)
        self._attr_name = "Polling Interval"
        self._attr_unique_id = f"{entry_id}_polling_interval"
        current_minutes = coordinator.update_interval.total_seconds() / 60
        self._attr_native_value = current_minutes

    async def async_added_to_hass(self) -> None:
        """Handle entity which will be added."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_number_data()
        if last_state and last_state.native_value is not None:
            self._attr_native_value = last_state.native_value
            self.coordinator.update_interval = timedelta(minutes=last_state.native_value)

    async def async_set_native_value(self, value: float) -> None:
        """Set new polling interval."""
        self._attr_native_value = value
        self.coordinator.update_interval = timedelta(minutes=value)
        _LOGGER.info("Polling interval changed to %d minute(s)", int(value))
        self.async_write_ha_state()


class ZeekrConfigNumber(CoordinatorEntity, RestoreNumber):
    """Zeekr Configuration Number class."""

    _attr_has_entity_name = True
    _attr_native_min_value = 0
    _attr_native_max_value = 15
    _attr_native_step = 1
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES
    _attr_icon = "mdi:timer-outline"

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        entry_id: str,
        key: str,
        name: str,
        coordinator_attr: str,
    ) -> None:
        """Initialize the number entity."""
        super().__init__(coordinator)
        self._coordinator_attr = coordinator_attr
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_{key}"
        # Set initial value from coordinator default
        self._attr_native_value = getattr(coordinator, coordinator_attr, 15)

    async def async_added_to_hass(self) -> None:
        """Handle entity which will be added."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_number_data()
        if last_state and last_state.native_value is not None:
            self._attr_native_value = last_state.native_value
            # Update coordinator with restored value
            setattr(self.coordinator, self._coordinator_attr, int(last_state.native_value))

    async def async_set_native_value(self, value: float) -> None:
        """Set new value."""
        self._attr_native_value = value
        setattr(self.coordinator, self._coordinator_attr, int(value))
        self.async_write_ha_state()


class ZeekrChargingNeededThreshold(ZeekrEntity, RestoreNumber):
    """Threshold for the charging_needed binary sensor (per vehicle)."""

    _attr_has_entity_name = True
    _attr_native_min_value = 5
    _attr_native_max_value = 95
    _attr_native_step = 5
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_icon = "mdi:battery-alert"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the threshold number."""
        super().__init__(coordinator, vin)
        self._attr_name = "Charging Needed Threshold"
        self._attr_unique_id = f"{vin}_charging_needed_threshold"
        self._attr_native_value = float(
            coordinator.get_config(vin).charging_needed_threshold
        )

    async def async_added_to_hass(self) -> None:
        """Handle entity which will be added."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_number_data()
        if last_state and last_state.native_value is not None:
            self._attr_native_value = float(last_state.native_value)
            self.coordinator.get_config(self.vin).charging_needed_threshold = (
                float(last_state.native_value)
            )

    async def async_set_native_value(self, value: float) -> None:
        """Set new threshold."""
        self._attr_native_value = value
        self.coordinator.get_config(self.vin).charging_needed_threshold = float(value)
        self.async_write_ha_state()
        # Trigger refresh so binary_sensor recomputes
        self.coordinator.async_update_listeners()


class ZeekrChargingLimitNumber(ZeekrEntity, RestoreNumber):
    """Zeekr Charging Limit Number class."""

    _attr_has_entity_name = True
    _attr_native_min_value = 50
    _attr_native_max_value = 100
    _attr_native_step = 5
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_icon = "mdi:battery-charging-high"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the charging limit number."""
        super().__init__(coordinator, vin)
        self._attr_name = "Charging Limit"
        self._attr_unique_id = f"{vin}_charging_limit"
        self._attr_native_value: float | None = None

    @property
    def native_value(self) -> float | None:
        """Return the value reported by the coordinator."""
        try:
            val = (
                self.coordinator.data.get(self.vin, {})
                .get("chargingLimit", {})
                .get("soc")
            )
            if val is not None:
                # API returns value * 10 (e.g. 800 -> 80.0)
                return float(val) / 10.0
        except (ValueError, TypeError, AttributeError):
            pass
        return self._attr_native_value

    async def async_added_to_hass(self) -> None:
        """Handle entity which will be added."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_number_data()
        if last_state and last_state.native_value is not None:
            self._attr_native_value = last_state.native_value

    async def async_set_native_value(self, value: float) -> None:
        """Set new value."""
        vehicle = self.coordinator.get_vehicle_by_vin(self.vin)
        if not vehicle:
            return

        command = "start"
        service_id = "RCS"
        # API expects value * 10 (e.g. 80.2% -> 802)
        # We handle full integers, so 80% -> 800
        soc_value = int(value * 10)

        setting = {
            "serviceParameters": [
                {
                    "key": "soc",
                    "value": str(soc_value)
                },
                {
                    "key": "rcs.setting",
                    "value": "1"
                },
                {
                    "key": "altCurrent",
                    "value": "1"
                }
            ]
        }

        await self.coordinator.async_inc_invoke()
        success = await self.hass.async_add_executor_job(
            vehicle.do_remote_control, command, service_id, setting
        )
        if not success:
            _LOGGER.warning("Charging limit set command failed for %s", self.vin)
            await herold_notify(
                self.hass,
                topic="zeekr/remote/fehlgeschlagen",
                titel=f"Zeekr {self.vin[-4:] if self.vin else ''}: Ladelimit",
                message="Ladelimit-Kommando wurde nicht bestätigt.",
                severity="warnung",
            )
            return
        self._attr_native_value = value
        self.async_write_ha_state()


class _VorbereitungNumberBase(ZeekrEntity, RestoreNumber):
    """Base for vorbereitung config numbers backed by coordinator state."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        unique_suffix: str,
        name: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = name
        self._attr_unique_id = f"{vin}_{unique_suffix}"
        self._attr_native_min_value = min_v
        self._attr_native_max_value = max_v
        self._attr_native_step = step
        if unit is not None:
            self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon

    def _read(self) -> float:
        raise NotImplementedError

    def _write(self, value: float) -> None:
        raise NotImplementedError

    @property
    def native_value(self) -> float:
        return float(self._read())

    async def async_set_native_value(self, value: float) -> None:
        self._write(value)
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_number_data()
        if last and last.native_value is not None:
            self._write(float(last.native_value))


class ZeekrSlotNumber(_VorbereitungNumberBase):
    """Numeric setting for a recurring slot."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        slot_idx: int,
        field: str,
        label: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator, vin,
            unique_suffix=f"vorbereitung_slot{slot_idx + 1}_{field}",
            name=f"Vorklimatisieren Slot {slot_idx + 1} {label}",
            min_v=min_v, max_v=max_v, step=step, unit=unit, icon=icon,
        )
        self._slot_idx = slot_idx
        self._field = field

    def _read(self) -> float:
        return getattr(
            self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx],
            self._field,
        )

    def _write(self, value: float) -> None:
        slot = self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx]
        # Cast to int for integer fields
        if self._field in ("dauer", "sitz_fahrer", "sitz_beifahrer", "sitz_hl", "sitz_hr"):
            setattr(slot, self._field, int(value))
        else:
            setattr(slot, self._field, float(value))


class ZeekrEinmaligNumber(_VorbereitungNumberBase):
    """Numeric setting for the one-shot Vorbereitung."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        label: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator, vin,
            unique_suffix=f"vorbereitung_einmalig_{field}",
            name=f"Vorklimatisieren Einmalig {label}",
            min_v=min_v, max_v=max_v, step=step, unit=unit, icon=icon,
        )
        self._field = field

    def _read(self) -> float:
        return getattr(self.coordinator.get_vorbereitung(self.vin).einmalig, self._field)

    def _write(self, value: float) -> None:
        einmalig = self.coordinator.get_vorbereitung(self.vin).einmalig
        if self._field in ("dauer", "sitz_fahrer", "sitz_beifahrer", "sitz_hl", "sitz_hr"):
            setattr(einmalig, self._field, int(value))
        else:
            setattr(einmalig, self._field, float(value))


class ZeekrSofortNumber(_VorbereitungNumberBase):
    """Numeric default for the sofort script."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        label: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator, vin,
            unique_suffix=f"vorbereitung_sofort_{field}",
            name=f"Vorklimatisieren Sofort {label}",
            min_v=min_v, max_v=max_v, step=step, unit=unit, icon=icon,
        )
        self._field = field

    def _read(self) -> float:
        return getattr(self.coordinator.get_vorbereitung(self.vin).sofort, self._field)

    def _write(self, value: float) -> None:
        sofort = self.coordinator.get_vorbereitung(self.vin).sofort
        if self._field in ("dauer", "sitz_fahrer", "sitz_beifahrer", "sitz_hl", "sitz_hr"):
            setattr(sofort, self._field, int(value))
        else:
            setattr(sofort, self._field, float(value))


class ZeekrSettingsNumber(ZeekrEntity, RestoreNumber):
    """Per-vehicle user configuration number, backed by ZeekrConfigState."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        name: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(coordinator, vin)
        self._field = field
        self._attr_name = name
        self._attr_unique_id = f"{vin}_{field}"
        self._attr_native_min_value = min_v
        self._attr_native_max_value = max_v
        self._attr_native_step = step
        if unit is not None:
            self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon

    @property
    def native_value(self) -> float:
        return float(getattr(self.coordinator.get_config(self.vin), self._field))

    async def async_set_native_value(self, value: float) -> None:
        setattr(self.coordinator.get_config(self.vin), self._field, float(value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_number_data()
        if last and last.native_value is not None:
            setattr(
                self.coordinator.get_config(self.vin),
                self._field,
                float(last.native_value),
            )


class ZeekrGlobalNumber(_VorbereitungNumberBase):
    """Numeric global setting (vorlaufzeit, wetter schwelle, wetter extra)."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        name: str,
        min_v: float,
        max_v: float,
        step: float,
        unit: str | None,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator, vin,
            unique_suffix=f"vorbereitung_global_{field}",
            name=name,
            min_v=min_v, max_v=max_v, step=step, unit=unit, icon=icon,
        )
        self._field = field

    def _read(self) -> float:
        return getattr(self.coordinator.get_vorbereitung(self.vin).globals, self._field)

    def _write(self, value: float) -> None:
        globals_cfg = self.coordinator.get_vorbereitung(self.vin).globals
        if self._field in ("vorlaufzeit", "wetter_extra_min"):
            setattr(globals_cfg, self._field, int(value))
        else:
            setattr(globals_cfg, self._field, float(value))
