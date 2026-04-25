"""DataUpdateCoordinator for Zeekr EU Integration."""

from __future__ import annotations

import json
import os
from datetime import timedelta, datetime
import logging
from typing import TYPE_CHECKING, Any, Optional

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
import homeassistant.helpers.event as event


from .config_state import ZeekrConfigState
from .const import CONF_POLLING_INTERVAL, DEFAULT_POLLING_INTERVAL, DOMAIN
from .herold import async_notify as herold_notify
from .request_stats import ZeekrRequestStats
from .vorbereitung import VorbereitungScheduler, VorbereitungState

if TYPE_CHECKING:
    from .api.client import Vehicle, ZeekrClient

_LOGGER = logging.getLogger(__name__)

# chargerState values: 0 disconnected, 1/2/15 charging, 25/26 stopped
CHARGER_STATE_CHARGING = {"1", "2", "15"}
CHARGER_STATE_STOPPED = {"25", "26"}
# Hysterese: wie weit SoC über die Warn-Schwelle steigen muss, bevor erneut gewarnt wird
LOW_SOC_HYSTERESIS = 2.0

DOOR_FIELDS = {
    "doorOpenStatusDriver": "Fahrertür",
    "doorOpenStatusPassenger": "Beifahrertür",
    "doorOpenStatusDriverRear": "Tür hinten links",
    "doorOpenStatusPassengerRear": "Tür hinten rechts",
    "trunkOpenStatus": "Heckklappe",
    "engineHoodOpenStatus": "Motorhaube",
}
WINDOW_FIELDS = {
    "winStatusDriver": "Fenster Fahrer",
    "winStatusPassenger": "Fenster Beifahrer",
    "winStatusDriverRear": "Fenster hinten links",
    "winStatusPassengerRear": "Fenster hinten rechts",
}


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
        # Per-vehicle preconditioning state (populated after first refresh)
        self.vorbereitung: dict[str, VorbereitungState] = {}
        self.vorbereitung_scheduler: VorbereitungScheduler | None = None
        # Per-vehicle user configuration (replaces legacy HA input_* helpers)
        self.zeekr_config: dict[str, ZeekrConfigState] = {}
        # Per-vehicle tracking state for Herold notifications
        self._notify_state: dict[str, dict[str, Any]] = {}
        # Per-vehicle throttle for the journey-log poll. Trips don't change
        # often; refresh every 30 min instead of on every status poll.
        self._journey_log_last_poll: dict[str, datetime] = {}
        self._journey_log_cache: dict[str, dict[str, Any]] = {}
        self._JOURNEY_LOG_INTERVAL = timedelta(minutes=30)
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

    def get_vorbereitung(self, vin: str) -> VorbereitungState:
        """Return the preconditioning state for a VIN, creating it on demand."""
        if vin not in self.vorbereitung:
            self.vorbereitung[vin] = VorbereitungState()
        return self.vorbereitung[vin]

    def get_config(self, vin: str) -> ZeekrConfigState:
        """Return the user configuration for a VIN, creating it on demand."""
        if vin not in self.zeekr_config:
            self.zeekr_config[vin] = ZeekrConfigState()
        return self.zeekr_config[vin]

    def start_vorbereitung_scheduler(self) -> None:
        """Start the per-coordinator preconditioning scheduler."""
        if self.vorbereitung_scheduler is not None:
            return
        # Ensure state exists for every known vehicle
        for vehicle in self.vehicles:
            self.get_vorbereitung(vehicle.vin)
        self.vorbereitung_scheduler = VorbereitungScheduler(self.hass, self)
        self.vorbereitung_scheduler.start()

    def stop_vorbereitung_scheduler(self) -> None:
        """Stop the preconditioning scheduler."""
        if self.vorbereitung_scheduler is not None:
            self.vorbereitung_scheduler.stop()
            self.vorbereitung_scheduler = None

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

                # Journey log — throttled to once per 30 min per vehicle.
                journey = await self._maybe_fetch_journey_log(vehicle)
                if journey is not None:
                    vehicle_data["journeyLog"] = journey

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
            # Fire Herold notifications for state transitions (never blocks polling)
            try:
                await self._process_notifications(data)
            except Exception as exc:  # noqa: BLE001
                _LOGGER.debug("Notification processing failed: %s", exc)
            return data

    async def _maybe_fetch_journey_log(self, vehicle) -> dict[str, Any] | None:
        """Throttled journey-log fetch. Returns cached value when not due."""
        vin = vehicle.vin
        now = datetime.now()
        last = self._journey_log_last_poll.get(vin)
        if last is not None and now - last < self._JOURNEY_LOG_INTERVAL:
            return self._journey_log_cache.get(vin)
        try:
            await self.request_stats.async_inc_request()
            log = await self.hass.async_add_executor_job(
                vehicle.get_journey_log, 30, 1, -1, 30  # page_size, page, last_id, days
            )
        except Exception as exc:  # noqa: BLE001
            _LOGGER.debug("Error fetching journey log for %s: %s", vin, exc)
            return self._journey_log_cache.get(vin)
        if not log:
            return self._journey_log_cache.get(vin)
        self._journey_log_last_poll[vin] = now
        self._journey_log_cache[vin] = log
        return log

    def _get_notify_state(self, vin: str) -> dict[str, Any]:
        """Return per-vehicle notification tracking state, lazily created."""
        state = self._notify_state.get(vin)
        if state is None:
            state = {
                "low_soc_active": False,
                "charger_state_prev": None,
                "door_open_since": {},
                "door_notified": set(),
                "window_open_since": {},
                "window_notified": set(),
                "unlocked_since": None,
                "unlocked_notified": False,
                "deadline_notplugged_date": None,
                "deadline_verpasst_date": None,
                "tire_warn_active": False,
                "service_warn_date": None,
            }
            self._notify_state[vin] = state
        return state

    async def _process_notifications(self, data: dict[str, dict]) -> None:
        """Fire Herold notifications based on transitions in the new poll data."""
        now_local = dt_util.now()
        for vin, vdata in data.items():
            state = self._get_notify_state(vin)
            cfg = self.get_config(vin)
            add = vdata.get("additionalVehicleStatus", {}) or {}
            ev = add.get("electricVehicleStatus", {}) or {}
            safety = add.get("drivingSafetyStatus", {}) or {}
            climate = add.get("climateStatus", {}) or {}
            short_vin = vin[-4:]

            maintenance = add.get("maintenanceStatus", {}) or {}

            await self._check_low_soc(vin, short_vin, ev, state, cfg)
            await self._check_charging_transition(vin, short_vin, ev, state)
            await self._check_open_durations(vin, short_vin, safety, climate, state, cfg, now_local)
            await self._check_unlocked(vin, short_vin, safety, state, cfg, now_local)
            await self._check_deadline(vin, short_vin, ev, state, cfg, now_local)
            await self._check_tire_warning(vin, short_vin, maintenance, state)
            await self._check_service_due(vin, short_vin, maintenance, state, cfg, now_local)

    def _is_at_home(self, short_vin: str) -> bool | None:
        """True if the device tracker reports the car is in zone home.

        Returns None when we cannot tell (entity missing / state unavailable),
        so callers can fall back to "warn anyway" instead of suppressing
        notifications for users without a configured home zone.
        """
        if short_vin is None:
            return None
        tracker_id = f"device_tracker.zeekr_{short_vin.lower()}_location"
        s = self.hass.states.get(tracker_id)
        if s is None:
            return None
        if s.state in (None, "", "unknown", "unavailable"):
            return None
        return s.state == "home"

    async def _check_low_soc(
        self,
        vin: str,
        short_vin: str,
        ev: dict,
        state: dict[str, Any],
        cfg: ZeekrConfigState,
    ) -> None:
        try:
            soc = float(ev.get("chargeLevel"))
        except (TypeError, ValueError):
            return
        plugged = str(ev.get("statusOfChargerConnection", "")) == "1"
        threshold = float(cfg.warnung_akku_soc)
        at_home = self._is_at_home(short_vin)
        # Skip the reminder while driving: only fire when the car is at home
        # (where it could actually be plugged in). When the home-zone state
        # is unknown we keep the old "warn anyway" behavior so users without
        # a configured home zone still get the alert.
        suppress_away = at_home is False
        if soc <= threshold and not plugged and not suppress_away:
            if not state["low_soc_active"]:
                state["low_soc_active"] = True
                await herold_notify(
                    self.hass,
                    topic="zeekr/akku/niedrig",
                    titel=f"Zeekr {short_vin}: Akku niedrig",
                    message=f"SoC bei {soc:.0f}% und nicht am Ladekabel.",
                    severity="warnung",
                )
        elif soc > threshold + LOW_SOC_HYSTERESIS or plugged:
            # Hysterese: erst zurücksetzen sobald SoC spürbar wieder steigt
            # oder das Auto angesteckt ist.
            state["low_soc_active"] = False

    async def _check_charging_transition(
        self, vin: str, short_vin: str, ev: dict, state: dict[str, Any]
    ) -> None:
        curr = ev.get("chargerState")
        if curr is None:
            return
        curr = str(curr)
        prev = state["charger_state_prev"]
        state["charger_state_prev"] = curr
        if prev is None or prev == curr:
            return
        # Was charging, now stopped → fertig oder fehler je nach SoC
        if prev in CHARGER_STATE_CHARGING and curr in CHARGER_STATE_STOPPED:
            try:
                soc = float(ev.get("chargeLevel"))
            except (TypeError, ValueError):
                soc = None
            if soc is not None and soc >= 50:
                await herold_notify(
                    self.hass,
                    topic="zeekr/ladung/fertig",
                    titel=f"Zeekr {short_vin}: Ladung fertig",
                    message=f"Ladung abgeschlossen bei {soc:.0f}%.",
                    severity="info",
                )
            else:
                soc_txt = f"{soc:.0f}%" if soc is not None else "unbekannt"
                await herold_notify(
                    self.hass,
                    topic="zeekr/ladung/fehler",
                    titel=f"Zeekr {short_vin}: Ladung abgebrochen",
                    message=f"Laden unerwartet beendet bei SoC {soc_txt}.",
                    severity="warnung",
                )
        # Charging was active, now disconnected without first going through stopped
        elif prev in CHARGER_STATE_CHARGING and curr == "0":
            await herold_notify(
                self.hass,
                topic="zeekr/ladung/fehler",
                titel=f"Zeekr {short_vin}: Kabel gezogen?",
                message="Verbindung zum Charger während des Ladens verloren.",
                severity="warnung",
            )

    async def _check_open_durations(
        self,
        vin: str,
        short_vin: str,
        safety: dict,
        climate: dict,
        state: dict[str, Any],
        cfg: ZeekrConfigState,
        now: datetime,
    ) -> None:
        threshold_min = int(cfg.warnung_offen_min)
        threshold = timedelta(minutes=threshold_min)
        # Doors
        for field, label in DOOR_FIELDS.items():
            is_open = str(safety.get(field, "")) == "1"
            if is_open:
                first = state["door_open_since"].get(field)
                if first is None:
                    state["door_open_since"][field] = now
                elif (
                    field not in state["door_notified"]
                    and (now - first) >= threshold
                ):
                    state["door_notified"].add(field)
                    await herold_notify(
                        self.hass,
                        topic="zeekr/tuer/offen",
                        titel=f"Zeekr {short_vin}: {label} offen",
                        message=f"{label} ist seit über {threshold_min} Min offen.",
                        severity="warnung",
                    )
            else:
                state["door_open_since"].pop(field, None)
                state["door_notified"].discard(field)

        # Windows ("1" = open, "2" = closed)
        for field, label in WINDOW_FIELDS.items():
            val = climate.get(field)
            if val is None:
                continue
            is_open = str(val) == "1"
            if is_open:
                first = state["window_open_since"].get(field)
                if first is None:
                    state["window_open_since"][field] = now
                elif (
                    field not in state["window_notified"]
                    and (now - first) >= threshold
                ):
                    state["window_notified"].add(field)
                    await herold_notify(
                        self.hass,
                        topic="zeekr/fenster/offen",
                        titel=f"Zeekr {short_vin}: {label} offen",
                        message=f"{label} ist seit über {threshold_min} Min offen.",
                        severity="warnung",
                    )
            else:
                state["window_open_since"].pop(field, None)
                state["window_notified"].discard(field)

    async def _check_unlocked(
        self,
        vin: str,
        short_vin: str,
        safety: dict,
        state: dict[str, Any],
        cfg: ZeekrConfigState,
        now: datetime,
    ) -> None:
        val = safety.get("centralLockingStatus")
        if val is None:
            return
        is_locked = str(val) == "1"
        if is_locked:
            state["unlocked_since"] = None
            state["unlocked_notified"] = False
            return
        first = state["unlocked_since"]
        if first is None:
            state["unlocked_since"] = now
            return
        threshold_min = int(cfg.warnung_unverriegelt_min)
        if (
            not state["unlocked_notified"]
            and (now - first) >= timedelta(minutes=threshold_min)
        ):
            state["unlocked_notified"] = True
            await herold_notify(
                self.hass,
                topic="zeekr/unverriegelt",
                titel=f"Zeekr {short_vin}: nicht verriegelt",
                message=f"Auto ist seit über {threshold_min} Min nicht abgeschlossen.",
                severity="warnung",
            )

    async def _check_deadline(
        self,
        vin: str,
        short_vin: str,
        ev: dict,
        state: dict[str, Any],
        cfg: ZeekrConfigState,
        now: datetime,
    ) -> None:
        if not cfg.deadline_aktiv:
            return
        today = now.date()

        # Combine today's deadline-time with today's date in local tz
        deadline_dt = now.replace(
            hour=cfg.deadline_zeit.hour,
            minute=cfg.deadline_zeit.minute,
            second=0,
            microsecond=0,
        )
        try:
            soc = float(ev.get("chargeLevel"))
        except (TypeError, ValueError):
            soc = None
        plugged = str(ev.get("statusOfChargerConnection", "")) == "1"

        # 1) Not plugged in, lead window before deadline
        lead_min = int(cfg.warnung_deadline_vorlauf_min)
        lead_from = deadline_dt - timedelta(minutes=lead_min)
        if (
            state["deadline_notplugged_date"] != today
            and lead_from <= now < deadline_dt
            and not plugged
        ):
            state["deadline_notplugged_date"] = today
            await herold_notify(
                self.hass,
                topic="zeekr/ladung/nicht_eingesteckt",
                titel=f"Zeekr {short_vin}: nicht eingesteckt",
                message=(
                    f"Deadline {cfg.deadline_zeit.strftime('%H:%M')} — Auto ist nicht am Kabel."
                ),
                severity="warnung",
            )

        # 2) Deadline reached, SoC below target
        if (
            state["deadline_verpasst_date"] != today
            and now >= deadline_dt
            and soc is not None
            and soc < cfg.deadline_soc
        ):
            state["deadline_verpasst_date"] = today
            await herold_notify(
                self.hass,
                topic="zeekr/deadline/verpasst",
                titel=f"Zeekr {short_vin}: Deadline verpasst",
                message=(
                    f"Zum Ziel {cfg.deadline_zeit.strftime('%H:%M')}: SoC {soc:.0f}%, "
                    f"Ziel {cfg.deadline_soc:.0f}%."
                ),
                severity="warnung",
            )

    async def _check_tire_warning(
        self,
        vin: str,
        short_vin: str,
        maintenance: dict,
        state: dict[str, Any],
    ) -> None:
        """Auto-internal tire pre-warning across the four corners."""
        TIRE_FIELDS = {
            "tyrePreWarningDriver": "Fahrer",
            "tyrePreWarningPassenger": "Beifahrer",
            "tyrePreWarningDriverRear": "Hinten links",
            "tyrePreWarningPassengerRear": "Hinten rechts",
        }
        warned = []
        for field, label in TIRE_FIELDS.items():
            val = maintenance.get(field)
            if val is None:
                continue
            try:
                if int(val) != 0:
                    warned.append(label)
            except (TypeError, ValueError):
                continue
        if warned:
            if not state["tire_warn_active"]:
                state["tire_warn_active"] = True
                await herold_notify(
                    self.hass,
                    topic="zeekr/reifen/druckverlust",
                    titel=f"Zeekr {short_vin}: Reifen-Warnung",
                    message=f"Auto meldet Reifenproblem: {', '.join(warned)}.",
                    severity="warnung",
                )
        else:
            state["tire_warn_active"] = False

    async def _check_service_due(
        self,
        vin: str,
        short_vin: str,
        maintenance: dict,
        state: dict[str, Any],
        cfg: ZeekrConfigState,
        now: datetime,
    ) -> None:
        try:
            distance = int(maintenance.get("distanceToService"))
        except (TypeError, ValueError):
            return
        threshold = int(cfg.warnung_service_km)
        today = now.date()
        if distance <= threshold and state["service_warn_date"] != today:
            state["service_warn_date"] = today
            await herold_notify(
                self.hass,
                topic="zeekr/wartung/erinnerung",
                titel=f"Zeekr {short_vin}: Service in {distance} km",
                message=(
                    f"distanceToService = {distance} km (Schwelle {threshold} km). "
                    "Termin vereinbaren."
                ),
                severity="info",
            )

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
