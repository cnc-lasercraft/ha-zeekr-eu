"""Switch platform for Zeekr EU Integration."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity
from .vorbereitung import NUM_SLOTS

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the switch platform."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[ZeekrSwitch] = []

    for vin in coordinator.data:
        entities.append(ZeekrAutoArchiveSwitch(coordinator, vin))
        entities.append(ZeekrSwitch(coordinator, vin, "defrost", "Defroster"))
        entities.append(ZeekrSwitch(coordinator, vin, "charging", "Charging"))
        entities.append(
            ZeekrSwitch(
                coordinator,
                vin,
                "steering_wheel_heat",
                "Steering Wheel Heat",
                status_key="steerWhlHeatingSts",
            )
        )
        entities.append(
            ZeekrSwitch(
                coordinator,
                vin,
                "sentry_mode",
                "Sentry Mode",
                status_key="vstdModeState",
                status_group="remoteControlState",
            )
        )

        # Vorbereitung config switches (per-slot, einmalig, sofort)
        for slot_idx in range(NUM_SLOTS):
            for field, label, icon in (
                ("aktiv", "Aktiv", "mdi:calendar-check"),
                ("lenkrad", "Lenkradheizung", "mdi:steering"),
                ("defrost", "Defrost", "mdi:car-defrost-front"),
            ):
                entities.append(
                    ZeekrSlotBoolSwitch(coordinator, vin, slot_idx, field, label, icon)
                )

        for field, label, icon in (
            ("aktiv", "Aktiv", "mdi:calendar-clock"),
            ("lenkrad", "Lenkradheizung", "mdi:steering"),
            ("defrost", "Defrost", "mdi:car-defrost-front"),
        ):
            entities.append(
                ZeekrEinmaligBoolSwitch(coordinator, vin, field, label, icon)
            )

        for field, label, icon in (
            ("lenkrad", "Lenkradheizung", "mdi:steering"),
            ("defrost", "Defrost", "mdi:car-defrost-front"),
        ):
            entities.append(
                ZeekrSofortBoolSwitch(coordinator, vin, field, label, icon)
            )

    async_add_entities(entities)


class _VorbereitungBoolSwitchBase(ZeekrEntity, RestoreEntity, SwitchEntity):
    """Base class for boolean switches that delegate to coordinator vorbereitung state."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        unique_suffix: str,
        name: str,
        icon: str,
    ) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = name
        self._attr_unique_id = f"{vin}_{unique_suffix}"
        self._attr_icon = icon

    # Subclasses must implement these
    def _read(self) -> bool:
        raise NotImplementedError

    def _write(self, value: bool) -> None:
        raise NotImplementedError

    @property
    def is_on(self) -> bool | None:
        return bool(self._read())

    async def async_turn_on(self, **kwargs: Any) -> None:
        self._write(True)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._write(False)
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last and last.state in ("on", "off"):
            self._write(last.state == "on")


class ZeekrSlotBoolSwitch(_VorbereitungBoolSwitchBase):
    """Boolean switch for a recurring slot field."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        slot_idx: int,
        field: str,
        label: str,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator,
            vin,
            unique_suffix=f"vorbereitung_slot{slot_idx + 1}_{field}",
            name=f"Vorbereitung Slot {slot_idx + 1} {label}",
            icon=icon,
        )
        self._slot_idx = slot_idx
        self._field = field

    def _read(self) -> bool:
        slot = self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx]
        return getattr(slot, self._field)

    def _write(self, value: bool) -> None:
        slot = self.coordinator.get_vorbereitung(self.vin).slots[self._slot_idx]
        setattr(slot, self._field, value)


class ZeekrEinmaligBoolSwitch(_VorbereitungBoolSwitchBase):
    """Boolean switch for the one-shot Vorbereitung."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        label: str,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator,
            vin,
            unique_suffix=f"vorbereitung_einmalig_{field}",
            name=f"Vorbereitung Einmalig {label}",
            icon=icon,
        )
        self._field = field

    def _read(self) -> bool:
        return getattr(self.coordinator.get_vorbereitung(self.vin).einmalig, self._field)

    def _write(self, value: bool) -> None:
        setattr(self.coordinator.get_vorbereitung(self.vin).einmalig, self._field, value)


class ZeekrSofortBoolSwitch(_VorbereitungBoolSwitchBase):
    """Boolean switch for sofort defaults."""

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        label: str,
        icon: str,
    ) -> None:
        super().__init__(
            coordinator,
            vin,
            unique_suffix=f"vorbereitung_sofort_{field}",
            name=f"Vorbereitung Sofort {label}",
            icon=icon,
        )
        self._field = field

    def _read(self) -> bool:
        return getattr(self.coordinator.get_vorbereitung(self.vin).sofort, self._field)

    def _write(self, value: bool) -> None:
        setattr(self.coordinator.get_vorbereitung(self.vin).sofort, self._field, value)


class ZeekrAutoArchiveSwitch(CoordinatorEntity[ZeekrCoordinator], SwitchEntity):
    """Switch to enable/disable automatic archiving of every poll response."""

    _attr_icon = "mdi:archive-clock"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the switch."""
        super().__init__(coordinator)
        self.vin = vin
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} Auto Archive Polls"
        self._attr_unique_id = f"{vin}_auto_archive"

    @property
    def is_on(self) -> bool:
        """Return true if auto-archive is enabled."""
        return self.coordinator.auto_archive

    @property
    def extra_state_attributes(self):
        """Return extra state attributes."""
        archive_dir = self.hass.config.path("zeekr_eu_dumps", "auto_archive")
        return {"archive_dir": archive_dir}

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Enable auto-archive."""
        self.coordinator.auto_archive = True
        _LOGGER.info("Auto-archive enabled - every poll will be saved to disk")
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Disable auto-archive."""
        self.coordinator.auto_archive = False
        _LOGGER.info("Auto-archive disabled")
        self.async_write_ha_state()

    @property
    def device_info(self):
        """Return device info."""
        return {
            "identifiers": {(DOMAIN, self.vin)},
            "name": f"Zeekr {self.vin}",
            "manufacturer": "Zeekr",
        }


class ZeekrSwitch(CoordinatorEntity[ZeekrCoordinator], SwitchEntity):
    """Zeekr Switch class."""

    _attr_icon = "mdi:toggle-switch"

    def __init__(
        self,
        coordinator: ZeekrCoordinator,
        vin: str,
        field: str,
        label: str,
        status_key: str | None = None,
        status_group: str = "climateStatus",
    ) -> None:
        """Initialize the switch entity."""
        super().__init__(coordinator)
        self.vin = vin
        self.field = field
        self.status_key = status_key or field
        self.status_group = status_group
        self._attr_name = f"Zeekr {vin[-4:] if vin else ''} {label}"
        self._attr_unique_id = f"{vin}_{field}"
        if field == "charging":
            self._attr_icon = "mdi:battery-off"
        elif field == "steering_wheel_heat":
            self._attr_icon = "mdi:steering"
        elif field == "sentry_mode":
            self._attr_icon = "mdi:cctv"

    @property
    def is_on(self) -> bool | None:
        """Return true if the switch is on."""
        try:
            val = None
            if self.field == "charging":
                val = (
                    self.coordinator.data.get(self.vin, {})
                    .get("additionalVehicleStatus", {})
                    .get("electricVehicleStatus", {})
                    .get("chargerState")
                )
                if val is None:
                    return None
                # "2" (AC charging?), "1" (DC charging?), "25" (stopped AC?), "26" (stopped DC?)
                # Treat 1 or 2 as charging, 25 or 26 as stopped
                return str(val) in ("1", "2")
            else:
                val = (
                    self.coordinator.data.get(self.vin, {})
                    .get("additionalVehicleStatus", {})
                    .get(self.status_group, {})
                    .get(self.status_key)
                )
                if val is None:
                    return None
                if self.field == "sentry_mode":
                    # vstdModeState: "1" (on), "0" (off)
                    return str(val) in {"1", "true", "True"}
                # User: "1" (on), "0" (off), "2" (off)
                # For defrost and seats, usually "1" is On.
                return str(val) == "1"
        except (ValueError, TypeError, AttributeError):
            return None

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn the switch on."""

        vehicle = self.coordinator.get_vehicle_by_vin(self.vin)
        if not vehicle:
            return

        setting = None
        service_id = None
        command = "start"

        if self.field == "charging":
            service_id = "RCS"
            setting = {
                "serviceParameters": [
                    {
                        "key": "rcs.restart",
                        "value": "1"
                    }
                ]
            }
        elif self.field == "defrost":
            service_id = "ZAF"
            setting = {
                "serviceParameters": [
                    {
                        "key": "DF",
                        "value": "true"
                    },
                    {
                        "key": "DF.level",
                        "value": "2"
                    }
                ]
            }
        elif self.field == "steering_wheel_heat":
            service_id = "ZAF"
            duration = getattr(self.coordinator, "steering_wheel_duration", 15)
            setting = {
                "serviceParameters": [
                    {
                        "key": "SW",
                        "value": "true"
                    },
                    {
                        "key": "SW.duration",
                        "value": str(duration)
                    },
                    {
                        "key": "SW.level",
                        "value": "3"
                    }
                ]
            }
        elif self.field == "sentry_mode":
            service_id = "RSM"
            setting = {
                "serviceParameters": [
                    {
                        "key": "rsm",
                        "value": "6"
                    }
                ]
            }

        if not service_id:
            _LOGGER.error("Attempted to turn on unsupported switch field: %s", self.field)
            return

        if setting:
            await self.coordinator.async_inc_invoke()
            await self.hass.async_add_executor_job(
                vehicle.do_remote_control, command, service_id, setting
            )

            if self.field == "charging":
                # Wait for backend confirmation for charging
                timeout = 30  # seconds
                poll_interval = 2
                waited = 0
                charging_confirmed = False
                while waited < timeout:
                    try:
                        # Poll all endpoints used by iOS app for confirmation
                        status = await self.hass.async_add_executor_job(vehicle.get_charging_status)
                        await asyncio.sleep(poll_interval)
                        waited += poll_interval
                        charger_state = (
                            status.get("chargerState")
                            if isinstance(status, dict) else None
                        )
                        # iOS trace: chargerState==2 is charging, 25 is stopped
                        if charger_state is not None and str(charger_state) in ("1", "2"):
                            charging_confirmed = True
                            break
                    except Exception as e:
                        _LOGGER.info("Error while polling for charging status confirmation: %s", e)
                        pass
                if charging_confirmed:
                    self._update_local_state_optimistically(is_on=True)
                else:
                    self._update_local_state_optimistically(is_on=False)
                self.async_write_ha_state()
            elif self.field == "sentry_mode":
                self._update_local_state_optimistically(is_on=True)
                self.async_write_ha_state()

                async def delayed_refresh():
                    await asyncio.sleep(10)
                    await self.coordinator.async_request_refresh()

                self.hass.async_create_task(delayed_refresh())
            else:
                self._update_local_state_optimistically(is_on=True)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the switch off."""
        vehicle = self.coordinator.get_vehicle_by_vin(self.vin)
        if not vehicle:
            return

        command = "stop"
        service_id = None
        setting = None

        if self.field == "defrost":
            command = "start"
            service_id = "ZAF"
            setting = {
                "serviceParameters": [
                    {
                        "key": "DF",
                        "value": "false"
                    }
                ]
            }
        elif self.field == "charging":
            service_id = "RCS"
            setting = {
                "serviceParameters": [
                    {
                        "key": "rcs.terminate",
                        "value": "1"
                    }
                ]
            }
        elif self.field == "steering_wheel_heat":
            command = "start"
            service_id = "ZAF"
            setting = {
                "serviceParameters": [
                    {
                        "key": "SW",
                        "value": "false"
                    }
                ]
            }
        elif self.field == "sentry_mode":
            service_id = "RSM"
            setting = {
                "serviceParameters": [
                    {
                        "key": "rsm",
                        "value": "6"
                    }
                ]
            }

        if not service_id:
            _LOGGER.error("Attempted to turn off unsupported switch field: %s", self.field)
            return

        if setting:
            await self.coordinator.async_inc_invoke()
            await self.hass.async_add_executor_job(
                vehicle.do_remote_control, command, service_id, setting
            )
            self._update_local_state_optimistically(is_on=False)
            self.async_write_ha_state()
            if self.field == "sentry_mode":
                async def delayed_refresh():
                    await asyncio.sleep(10)
                    await self.coordinator.async_request_refresh()

                self.hass.async_create_task(delayed_refresh())
            else:
                await self.coordinator.async_request_refresh()

    def _update_local_state_optimistically(self, is_on: bool) -> None:
        """Update the coordinator data to reflect the change immediately."""
        data = self.coordinator.data.get(self.vin)
        if not data:
            return

        if self.field == "charging":
            ev_status = (
                data.setdefault("additionalVehicleStatus", {})
                .setdefault("electricVehicleStatus", {})
            )
            if is_on:
                ev_status["chargerState"] = "2"
            else:
                ev_status["chargerState"] = "25"
        else:
            status_group = (
                data.setdefault("additionalVehicleStatus", {})
                .setdefault(self.status_group, {})
            )

            if self.field == "defrost":
                status_group[self.field] = "1" if is_on else "0"
            elif self.field == "steering_wheel_heat":
                # User says: "steerWhlHeatingSts": "1" when on, "2" when off
                status_group[self.status_key] = "1" if is_on else "2"
            elif self.field == "sentry_mode":
                status_group[self.status_key] = "1" if is_on else "0"

    @property
    def device_info(self):
        """Return device info."""
        return {
            "identifiers": {(DOMAIN, self.vin)},
            "name": f"Zeekr {self.vin}",
            "manufacturer": "Zeekr",
        }
