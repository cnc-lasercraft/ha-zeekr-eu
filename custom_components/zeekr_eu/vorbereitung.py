"""Vorbereitung (preconditioning scheduler) for Zeekr EU Integration."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, time as dtime
import logging
from typing import TYPE_CHECKING, Any, Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from .coordinator import ZeekrCoordinator

_LOGGER = logging.getLogger(__name__)

NUM_SLOTS = 3
DEFAULT_AUSSENTEMP_SENSOR = "sensor.gw2000a_outdoor_temperature"

WEEKDAY_OPTIONS = [
    "täglich", "Mo-Fr", "Sa-So",
    "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So",
]
_WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


@dataclass
class SlotConfig:
    """Settings for one recurring schedule slot."""

    aktiv: bool = False
    zeit: dtime = field(default_factory=lambda: dtime(8, 0))
    tage: str = "Mo-Fr"
    ac_temp: float = 21.0
    dauer: int = 15
    lenkrad: bool = False
    defrost: bool = False
    sitz_fahrer: int = 0
    sitz_beifahrer: int = 0
    sitz_hl: int = 0
    sitz_hr: int = 0


@dataclass
class EinmaligConfig:
    """Settings for the one-shot schedule."""

    aktiv: bool = False
    zeit: datetime | None = None
    ac_temp: float = 21.0
    dauer: int = 15
    lenkrad: bool = False
    defrost: bool = False
    sitz_fahrer: int = 0
    sitz_beifahrer: int = 0
    sitz_hl: int = 0
    sitz_hr: int = 0


@dataclass
class SofortConfig:
    """Default settings for the immediate (sofort) script/button."""

    ac_temp: float = 21.0
    dauer: int = 15
    lenkrad: bool = False
    defrost: bool = False
    sitz_fahrer: int = 0
    sitz_beifahrer: int = 0
    sitz_hl: int = 0
    sitz_hr: int = 0


@dataclass
class GlobalConfig:
    """Global preconditioning settings shared across all triggers."""

    vorlaufzeit: int = 20  # minutes before departure to start
    wetter_schwelle_kalt: float = 0.0  # below this °C → cold-weather override
    wetter_extra_min: int = 5  # extra minutes added to duration when cold


@dataclass
class VorbereitungState:
    """All preconditioning state for one vehicle."""

    slots: list[SlotConfig] = field(
        default_factory=lambda: [SlotConfig() for _ in range(NUM_SLOTS)]
    )
    einmalig: EinmaligConfig = field(default_factory=EinmaligConfig)
    sofort: SofortConfig = field(default_factory=SofortConfig)
    globals: GlobalConfig = field(default_factory=GlobalConfig)


def weekday_matches(pattern: str, weekday: int) -> bool:
    """Return True if the day pattern matches the given weekday (0=Mon..6=Sun)."""
    if pattern == "täglich":
        return True
    if pattern == "Mo-Fr":
        return weekday < 5
    if pattern == "Sa-So":
        return weekday >= 5
    if pattern in _WEEKDAY_NAMES:
        return _WEEKDAY_NAMES[weekday] == pattern
    return False


def slot_to_service_data(slot: SlotConfig) -> dict[str, Any]:
    """Convert a SlotConfig to preconditioning_start service params."""
    return {
        "ac_temp": float(slot.ac_temp),
        "duration_min": int(slot.dauer),
        "defrost": bool(slot.defrost),
        "steering_wheel": bool(slot.lenkrad),
        "seat_driver": int(slot.sitz_fahrer),
        "seat_passenger": int(slot.sitz_beifahrer),
        "seat_rear_left": int(slot.sitz_hl),
        "seat_rear_right": int(slot.sitz_hr),
    }


def einmalig_to_service_data(e: EinmaligConfig) -> dict[str, Any]:
    """Convert an EinmaligConfig to preconditioning_start service params."""
    return {
        "ac_temp": float(e.ac_temp),
        "duration_min": int(e.dauer),
        "defrost": bool(e.defrost),
        "steering_wheel": bool(e.lenkrad),
        "seat_driver": int(e.sitz_fahrer),
        "seat_passenger": int(e.sitz_beifahrer),
        "seat_rear_left": int(e.sitz_hl),
        "seat_rear_right": int(e.sitz_hr),
    }


def sofort_to_service_data(s: SofortConfig) -> dict[str, Any]:
    """Convert a SofortConfig to preconditioning_start service params."""
    return {
        "ac_temp": float(s.ac_temp),
        "duration_min": int(s.dauer),
        "defrost": bool(s.defrost),
        "steering_wheel": bool(s.lenkrad),
        "seat_driver": int(s.sitz_fahrer),
        "seat_passenger": int(s.sitz_beifahrer),
        "seat_rear_left": int(s.sitz_hl),
        "seat_rear_right": int(s.sitz_hr),
    }


def apply_weather_override(
    settings: dict[str, Any],
    aussentemp: float | None,
    globals_cfg: GlobalConfig,
) -> dict[str, Any]:
    """Mutate settings to enable defrost + extra duration if it's cold outside."""
    if aussentemp is None:
        return settings
    if aussentemp >= globals_cfg.wetter_schwelle_kalt:
        return settings
    settings["defrost"] = True
    settings["duration_min"] = int(settings.get("duration_min", 15)) + globals_cfg.wetter_extra_min
    _LOGGER.info(
        "Cold-weather override: aussen=%.1f°C < %.1f°C → defrost ON, duration +%d min",
        aussentemp, globals_cfg.wetter_schwelle_kalt, globals_cfg.wetter_extra_min,
    )
    return settings


class VorbereitungScheduler:
    """Per-coordinator scheduler that fires preconditioning when slots match."""

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: "ZeekrCoordinator",
        aussentemp_entity_id: str = DEFAULT_AUSSENTEMP_SENSOR,
    ) -> None:
        self.hass = hass
        self.coordinator = coordinator
        self.aussentemp_entity_id = aussentemp_entity_id
        self._unsub: Callable[[], None] | None = None

    def start(self) -> None:
        """Start the periodic scheduler tick."""
        if self._unsub is not None:
            return
        self._unsub = async_track_time_interval(
            self.hass, self._tick, timedelta(minutes=1)
        )
        _LOGGER.info("Vorbereitung scheduler started (1 min tick)")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
            _LOGGER.info("Vorbereitung scheduler stopped")

    async def _tick(self, _now: datetime) -> None:
        """Run every minute - check all slots for all vehicles."""
        for vehicle in self.coordinator.vehicles:
            vin = vehicle.vin
            state = self.coordinator.vorbereitung.get(vin)
            if state is None:
                continue
            try:
                await self._check_vehicle(vin, state)
            except Exception as exc:  # noqa: BLE001
                _LOGGER.exception("Vorbereitung tick error for %s: %s", vin, exc)

    async def _check_vehicle(self, vin: str, state: VorbereitungState) -> None:
        """Check all slots + einmalig for this vehicle."""
        now_local = dt_util.now()  # tz-aware in HA's configured timezone
        vorlauf = state.globals.vorlaufzeit
        target = (now_local + timedelta(minutes=vorlauf)).replace(second=0, microsecond=0)
        target_hm = (target.hour, target.minute)

        # Recurring slots
        for idx, slot in enumerate(state.slots):
            if not slot.aktiv:
                continue
            if not weekday_matches(slot.tage, now_local.weekday()):
                continue
            if (slot.zeit.hour, slot.zeit.minute) != target_hm:
                continue
            _LOGGER.info(
                "Vorbereitung slot %d matched for %s at target %02d:%02d",
                idx + 1, vin, target_hm[0], target_hm[1],
            )
            await self._fire(vin, slot_to_service_data(slot), state.globals)
            return  # only one match per minute

        # One-shot (einmalig.zeit is tz-aware datetime)
        if state.einmalig.aktiv and state.einmalig.zeit is not None:
            einmalig_target = (
                state.einmalig.zeit - timedelta(minutes=vorlauf)
            ).replace(second=0, microsecond=0)
            now_minute = now_local.replace(second=0, microsecond=0)
            if einmalig_target == now_minute:
                _LOGGER.info("Vorbereitung einmalig matched for %s", vin)
                await self._fire(
                    vin, einmalig_to_service_data(state.einmalig), state.globals
                )
                state.einmalig.aktiv = False
                self.coordinator.async_update_listeners()

    async def _fire(
        self, vin: str, settings: dict[str, Any], globals_cfg: GlobalConfig
    ) -> None:
        """Apply weather override and call the preconditioning service."""
        aussentemp = self._read_outside_temp()
        apply_weather_override(settings, aussentemp, globals_cfg)

        try:
            await self.hass.services.async_call(
                "zeekr_eu",
                "preconditioning_start",
                {"vin": vin, **settings},
                blocking=False,
            )
        except Exception as exc:  # noqa: BLE001
            _LOGGER.error("Vorbereitung: failed to call preconditioning_start: %s", exc)

    def _read_outside_temp(self) -> float | None:
        """Read the outside temperature from the configured HA sensor."""
        state = self.hass.states.get(self.aussentemp_entity_id)
        if state is None or state.state in (None, "", "unknown", "unavailable"):
            return None
        try:
            return float(state.state)
        except (ValueError, TypeError):
            return None
