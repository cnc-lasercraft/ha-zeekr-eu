"""DataUpdateCoordinator for Zeekr EU Integration."""

from __future__ import annotations

import json
import os
from datetime import timedelta, datetime
import logging
from typing import TYPE_CHECKING, Optional

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
import homeassistant.helpers.event as event


from .const import CONF_POLLING_INTERVAL, DEFAULT_POLLING_INTERVAL, DOMAIN
from .request_stats import ZeekrRequestStats

if TYPE_CHECKING:
    from .api.client import Vehicle, ZeekrClient

_LOGGER = logging.getLogger(__name__)


class ZeekrCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Zeekr data."""

    def __init__(
        self,
        hass: HomeAssistant,
        client: ZeekrClient,
        entry: ConfigEntry,
    ) -> None:
        """Initialize."""
        self.client = client
        self.entry = entry
        self.vehicles: list[Vehicle] = []
        # Shared settings for command durations
        self.seat_duration = 15
        self.ac_duration = 15
        self.steering_wheel_duration = 15
        self.request_stats = ZeekrRequestStats(hass)
        self.latest_poll_time: Optional[str] = None  # Track latest poll time
        self.auto_archive: bool = False  # Enable to save every poll to disk
        polling_interval = entry.data.get(CONF_POLLING_INTERVAL, DEFAULT_POLLING_INTERVAL)
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=polling_interval),
            config_entry=entry,
        )

        # Schedule daily reset at midnight
        self._unsub_reset = None
        self._setup_daily_reset()

    def _setup_daily_reset(self):
        if self._unsub_reset:
            self._unsub_reset()
        self._unsub_reset = event.async_track_time_change(
            self.hass, self._handle_daily_reset, hour=0, minute=0, second=0
        )

    async def async_init_stats(self):
        """Initialize stats (load from storage)."""
        await self.request_stats.async_load()

    async def _handle_daily_reset(self, now):
        await self.request_stats.async_reset_today()

    def get_vehicle_by_vin(self, vin: str) -> Vehicle | None:
        """Get a vehicle by VIN."""
        for vehicle in self.vehicles:
            if vehicle.vin == vin:
                return vehicle
        return None

    async def _async_update_data(self) -> dict[str, dict]:
        """Fetch data from API endpoint."""
        try:
            # Refresh vehicle list if empty (first run)
            if not self.vehicles:
                await self.request_stats.async_inc_request()
                self.vehicles = await self.hass.async_add_executor_job(
                    self.client.get_vehicle_list
                )

            data = {}
            for vehicle in self.vehicles:
                try:
                    await self.request_stats.async_inc_request()
                    vehicle_data = await self.hass.async_add_executor_job(
                        vehicle.get_status
                    )
                except Exception as charge_err:
                    _LOGGER.error("Error fetching remote control status for %s: %s", vehicle.vin, charge_err)
                    # Skip this entire vehicle on error
                    continue

                # Fetch remote control status
                try:
                    await self.request_stats.async_inc_request()
                    vehicle_remote_state = await self.hass.async_add_executor_job(
                        vehicle.get_remote_control_state
                    )

                    if vehicle_remote_state:
                        vehicle_data.setdefault("additionalVehicleStatus", {})[
                            "remoteControlState"
                        ] = vehicle_remote_state
                except Exception as charge_err:
                    _LOGGER.debug("Error fetching remote control status for %s: %s", vehicle.vin, charge_err)

                # Fetch charging status
                try:
                    await self.request_stats.async_inc_request()
                    charging_status = await self.hass.async_add_executor_job(
                        vehicle.get_charging_status
                    )
                    if charging_status:
                        vehicle_data.setdefault("chargingStatus", {}).update(charging_status)
                except Exception as charge_err:
                    _LOGGER.debug("Error fetching charging status for %s: %s", vehicle.vin, charge_err)

                # Fetch charging limit
                try:
                    await self.request_stats.async_inc_request()
                    charging_limit = await self.hass.async_add_executor_job(
                        vehicle.get_charging_limit
                    )
                    if charging_limit:
                        vehicle_data["chargingLimit"] = charging_limit
                except Exception as limit_err:
                    _LOGGER.debug("Error fetching charging limit for %s: %s", vehicle.vin, limit_err)

                data[vehicle.vin] = vehicle_data

            # Update latest poll time on every automatic poll
            self.latest_poll_time = datetime.now().isoformat()

            # Auto-archive poll data if enabled
            if self.auto_archive and data:
                await self.hass.async_add_executor_job(
                    self._write_poll_archive, data
                )

        except Exception as err:
            raise UpdateFailed(f"Error communicating with API: {err}") from err
        else:
            return data

    def _write_poll_archive(self, data: dict) -> None:
        """Write poll data to archive file (runs in executor)."""
        try:
            archive_dir = self.hass.config.path("zeekr_eu_dumps", "auto_archive")
            os.makedirs(archive_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(archive_dir, f"poll_{timestamp}.json")
            with open(file_path, "w") as f:
                json.dump(data, f, indent=2, default=str)
            _LOGGER.debug("Auto-archived poll data to %s", file_path)
        except Exception as e:
            _LOGGER.error("Failed to archive poll data: %s", e)

    async def async_inc_invoke(self):
        await self.request_stats.async_inc_invoke()
