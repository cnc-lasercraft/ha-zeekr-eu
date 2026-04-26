"""Button platform for Zeekr EU Integration."""

from __future__ import annotations

import json
import logging
import os

from datetime import datetime
from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import ZeekrCoordinator
from .entity import ZeekrEntity
from .herold import async_notify as herold_notify
from .protocol import KEY_RHL, SERVICE_RHL

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Zeekr button entities."""
    coordinator: ZeekrCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities: list[ButtonEntity] = []
    for vehicle in coordinator.vehicles:
        entities.append(ZeekrForceUpdateButton(coordinator, vehicle.vin))
        entities.append(ZeekrFlashBlinkersButton(coordinator, vehicle.vin))
        entities.append(ZeekrDumpApiButton(coordinator, vehicle.vin))
        entities.append(ZeekrVorbereitungSofortButton(coordinator, vehicle.vin))
        entities.append(ZeekrVorbereitungStopButton(coordinator, vehicle.vin))
        entities.append(ZeekrCloudTravelPlanSetzenButton(coordinator, vehicle.vin))
        entities.append(ZeekrCloudTravelPlanAbsagenButton(coordinator, vehicle.vin))

    async_add_entities(entities)


class ZeekrCloudTravelPlanSetzenButton(ZeekrEntity, ButtonEntity):
    """Push the cloud travel plan to Zeekr's servers using the configured datetime/AC/SW."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:cloud-upload"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Cloud Setzen"
        self._attr_unique_id = f"{vin}_cloud_travel_plan_setzen"

    async def async_press(self) -> None:
        cfg = self.coordinator.get_config(self.vin)
        if cfg.cloud_travel_plan_zeit is None:
            await herold_notify(
                self.hass,
                topic="zeekr/remote/fehlgeschlagen",
                titel=f"Zeekr {self.vin[-4:] if self.vin else ''}: Cloud-Plan",
                message="Keine Abfahrtszeit gesetzt — bitte 'Vorklimatisieren Cloud Zeit' wählen.",
                severity="warnung",
            )
            return

        await self.hass.services.async_call(
            "zeekr_eu",
            "schedule_preconditioning",
            {
                "vin": self.vin,
                "scheduled_time": cfg.cloud_travel_plan_zeit,
                "ac": cfg.cloud_travel_plan_ac,
                "steering_wheel": cfg.cloud_travel_plan_lenkrad,
            },
            blocking=False,
        )


class ZeekrCloudTravelPlanAbsagenButton(ZeekrEntity, ButtonEntity):
    """Cancel the cloud-side travel plan."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:cloud-off-outline"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Cloud Absagen"
        self._attr_unique_id = f"{vin}_cloud_travel_plan_absagen"

    async def async_press(self) -> None:
        await self.hass.services.async_call(
            "zeekr_eu",
            "cancel_scheduled_preconditioning",
            {"vin": self.vin},
            blocking=False,
        )


class ZeekrVorbereitungSofortButton(ZeekrEntity, ButtonEntity):
    """Trigger preconditioning right now using the sofort defaults."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:car-electric"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Jetzt"
        self._attr_unique_id = f"{vin}_vorbereitung_sofort"

    async def async_press(self) -> None:
        from .vorbereitung import (
            apply_weather_override,
            sofort_to_service_data,
        )

        state = self.coordinator.get_vorbereitung(self.vin)
        settings = sofort_to_service_data(state.sofort)

        # Weather override (uses scheduler's sensor read helper if available)
        scheduler = self.coordinator.vorbereitung_scheduler
        aussentemp = scheduler._read_outside_temp() if scheduler is not None else None
        apply_weather_override(settings, aussentemp, state.globals)

        _LOGGER.info("Vorbereitung Sofort button pressed for %s: %s", self.vin, settings)
        await self.hass.services.async_call(
            "zeekr_eu",
            "preconditioning_start",
            {"vin": self.vin, **settings},
            blocking=False,
        )


class ZeekrVorbereitungStopButton(ZeekrEntity, ButtonEntity):
    """Stop every active preconditioning subsystem (AC/DF/SW/SH/RC/RW)."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:stop-circle"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        super().__init__(coordinator, vin)
        self._attr_name = "Vorklimatisieren Stop"
        self._attr_unique_id = f"{vin}_vorbereitung_stop"

    async def async_press(self) -> None:
        _LOGGER.info("Vorbereitung Stop button pressed for %s", self.vin)
        await self.hass.services.async_call(
            "zeekr_eu",
            "preconditioning_stop",
            {"vin": self.vin},
            blocking=False,
        )


class ZeekrFlashBlinkersButton(ZeekrEntity, ButtonEntity):
    """Button to Flash Blinkers."""

    _attr_icon = "mdi:car-light-alert"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the button."""
        super().__init__(coordinator, vin)
        self._attr_name = "Flash Blinkers"
        self._attr_unique_id = f"{vin}_flash_blinkers"

    async def async_press(self) -> None:
        """Handle the button press."""
        vehicle = self.coordinator.get_vehicle_by_vin(self.vin)
        if not vehicle:
            return

        command = "start"
        service_id = SERVICE_RHL
        setting = {
            "serviceParameters": [
                {"key": KEY_RHL, "value": "light-flash"}
            ]
        }

        await self.coordinator.async_inc_invoke()
        success = await self.hass.async_add_executor_job(
            vehicle.do_remote_control, command, service_id, setting
        )
        if not success:
            _LOGGER.warning("Flash blinkers command failed for %s", self.vin)
            await herold_notify(
                self.hass,
                topic="zeekr/remote/fehlgeschlagen",
                titel=f"Zeekr {self.vin[-4:] if self.vin else ''}: Blinker",
                message="Flash-Blinkers-Kommando wurde nicht bestätigt.",
                severity="warnung",
            )
            return
        _LOGGER.info("Flash blinkers requested for vehicle %s", self.vin)


class ZeekrDumpApiButton(ZeekrEntity, ButtonEntity):
    """Button to dump all API responses to JSON files."""

    _attr_icon = "mdi:database-export"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the button."""
        super().__init__(coordinator, vin)
        self._attr_name = "Dump API Data"
        self._attr_unique_id = f"{vin}_dump_api_data"
        self._dump_count = 0

    @property
    def extra_state_attributes(self):
        """Return extra state attributes."""
        return {
            "dump_count": self._dump_count,
            "dump_dir": self._get_dump_dir(),
        }

    def _get_dump_dir(self) -> str:
        """Get the dump directory path."""
        return self.hass.config.path("zeekr_eu_dumps")

    async def async_press(self) -> None:
        """Handle the button press - dump all API responses."""
        vehicle = self.coordinator.get_vehicle_by_vin(self.vin)
        if not vehicle:
            _LOGGER.error("Vehicle not found for VIN %s", self.vin)
            return

        _LOGGER.info("Starting API data dump for vehicle %s", self.vin)

        # Fetch all raw responses
        try:
            raw_responses = await self.hass.async_add_executor_job(
                self.coordinator.client.dump_all_raw_responses, self.vin
            )
        except Exception as e:
            _LOGGER.error("Failed to fetch API data: %s", e)
            return

        # Also include the current coordinator data
        coordinator_data = self.coordinator.data or {}
        vehicle_coordinator_data = coordinator_data.get(self.vin, {})

        # Create dump directory
        dump_dir = self._get_dump_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_dir = os.path.join(dump_dir, f"{timestamp}_{self.vin[-4:]}")

        await self.hass.async_add_executor_job(
            self._write_dump_files, session_dir, raw_responses, vehicle_coordinator_data, timestamp
        )

        self._dump_count += 1
        _LOGGER.info(
            "API data dump #%d completed: %s (%d endpoints)",
            self._dump_count,
            session_dir,
            len(raw_responses),
        )

    def _write_dump_files(
        self,
        session_dir: str,
        raw_responses: dict,
        coordinator_data: dict,
        timestamp: str,
    ) -> None:
        """Write dump files to disk (runs in executor)."""
        os.makedirs(session_dir, exist_ok=True)

        # Write each endpoint response as separate file
        for endpoint_name, response_data in raw_responses.items():
            file_path = os.path.join(session_dir, f"{endpoint_name}.json")
            with open(file_path, "w") as f:
                json.dump(response_data, f, indent=2, default=str)

        # Write the merged coordinator data
        coord_path = os.path.join(session_dir, "coordinator_merged.json")
        with open(coord_path, "w") as f:
            json.dump(coordinator_data, f, indent=2, default=str)

        # Write a summary/index file
        summary = {
            "timestamp": timestamp,
            "vin": self.vin,
            "endpoints_fetched": list(raw_responses.keys()),
            "success_count": sum(
                1 for r in raw_responses.values()
                if isinstance(r, dict) and r.get("success", False)
            ),
            "error_count": sum(
                1 for r in raw_responses.values()
                if isinstance(r, dict) and "error" in r
            ),
        }
        summary_path = os.path.join(session_dir, "_summary.json")
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)


class ZeekrForceUpdateButton(ZeekrEntity, ButtonEntity):
    """Button to Poll vehicle data."""

    _attr_icon = "mdi:refresh"

    def __init__(self, coordinator: ZeekrCoordinator, vin: str) -> None:
        """Initialize the button."""
        super().__init__(coordinator, vin)
        self._attr_name = "Poll Vehicle Data"
        self._attr_unique_id = f"{vin}_poll_vehicle_data"

    @property
    def state(self):
        """Return the latest poll time/date as the button state."""
        return self.coordinator.latest_poll_time

    async def async_press(self) -> None:
        """Handle the button press."""
        _LOGGER.info("Poll vehicle data requested for vehicle %s", self.vin)
        self.coordinator.latest_poll_time = datetime.now().isoformat()
        await self.coordinator.async_request_refresh()
