"""Custom integration to integrate Zeekr EU with Home Assistant."""

import logging

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.typing import ConfigType
import homeassistant.helpers.config_validation as cv

from .api import ZeekrClient
from .const import (
    CONF_HMAC_ACCESS_KEY,
    CONF_HMAC_SECRET_KEY,
    CONF_PASSWORD,
    CONF_PASSWORD_PUBLIC_KEY,
    CONF_PROD_SECRET,
    CONF_USERNAME,
    CONF_VIN_IV,
    CONF_VIN_KEY,
    CONF_COUNTRY_CODE,
    DOMAIN,
    PLATFORMS,
    STARTUP_MESSAGE,
)
from .coordinator import ZeekrCoordinator
from .herold import async_notify as herold_notify, async_register_topics
from .request_stats import ZeekrRequestStats

SERVICE_PRECONDITIONING_START = "preconditioning_start"

PRECONDITIONING_SCHEMA = vol.Schema(
    {
        vol.Required("vin"): cv.string,
        vol.Optional("ac_temp", default=21): vol.All(
            vol.Coerce(float), vol.Range(min=0, max=30)
        ),
        vol.Optional("duration_min", default=15): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=60)
        ),
        vol.Optional("defrost", default=False): cv.boolean,
        vol.Optional("steering_wheel", default=False): cv.boolean,
        vol.Optional("seat_driver", default=0): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=3)
        ),
        vol.Optional("seat_passenger", default=0): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=3)
        ),
        vol.Optional("seat_rear_left", default=0): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=3)
        ),
        vol.Optional("seat_rear_right", default=0): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=3)
        ),
    }
)

# Seat heat service code by position (matches select.py)
SEAT_SERVICE_CODES = {
    "seat_driver": "SH.11",
    "seat_passenger": "SH.19",
    "seat_rear_left": "SH.21",
    "seat_rear_right": "SH.29",
}

_LOGGER: logging.Logger = logging.getLogger(__package__)


async def async_setup(hass: HomeAssistant, config: ConfigType):
    """Set up this integration using YAML is not supported."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up this integration using UI."""
    if hass.data.get(DOMAIN) is None:
        hass.data.setdefault(DOMAIN, {})
        _LOGGER.info(STARTUP_MESSAGE)

    username = entry.data.get(CONF_USERNAME)
    password = entry.data.get(CONF_PASSWORD)
    country_code = entry.data.get(CONF_COUNTRY_CODE, "")
    hmac_access_key = entry.data.get(CONF_HMAC_ACCESS_KEY, "")
    hmac_secret_key = entry.data.get(CONF_HMAC_SECRET_KEY, "")
    password_public_key = entry.data.get(CONF_PASSWORD_PUBLIC_KEY, "")
    prod_secret = entry.data.get(CONF_PROD_SECRET, "")
    vin_key = entry.data.get(CONF_VIN_KEY, "")
    vin_iv = entry.data.get(CONF_VIN_IV, "")

    if not username or not password:
        _LOGGER.warning("No username or password")
        return False

    # Try to reuse client from config flow to avoid duplicate login
    client = hass.data.get(DOMAIN, {}).pop("_temp_client", None)

    if client is None or not client.logged_in:
        client = ZeekrClient(
            username=username,
            password=password,
            country_code=country_code,
            hmac_access_key=hmac_access_key,
            hmac_secret_key=hmac_secret_key,
            password_public_key=password_public_key,
            prod_secret=prod_secret,
            vin_key=vin_key,
            vin_iv=vin_iv,
            logger=_LOGGER,
        )
        try:
            # Count the login request
            stats = ZeekrRequestStats(hass)
            await stats.async_load()
            await stats.async_inc_request()
            await hass.async_add_executor_job(client.login)
        except Exception as ex:
            _LOGGER.error("Could not log in to Zeekr API: %s", ex)
            await herold_notify(
                hass,
                topic="zeekr/api/fehler",
                titel="Zeekr API Login fehlgeschlagen",
                message=f"Anmeldung an die Zeekr API ist fehlgeschlagen: {ex}",
                severity="warnung",
            )
            raise ConfigEntryNotReady from ex

    coordinator = ZeekrCoordinator(hass, client=client, entry=entry)
    await coordinator.async_init_stats()
    await coordinator.async_config_entry_first_refresh()

    if coordinator.vehicles:
        _LOGGER.info(
            "Found %d vehicle(s): %s",
            len(coordinator.vehicles),
            ", ".join(v.vin for v in coordinator.vehicles),
        )
    else:
        _LOGGER.warning("No vehicles found in account")

    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Start the preconditioning scheduler now that we have vehicles
    coordinator.start_vorbereitung_scheduler()

    # Register Herold topics (idempotent, skipped if Herold isn't installed)
    await async_register_topics(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register the preconditioning service (idempotent across reloads)
    if not hass.services.has_service(DOMAIN, SERVICE_PRECONDITIONING_START):
        async def _handle_preconditioning_start(call: ServiceCall) -> None:
            vin = call.data["vin"]
            duration = call.data["duration_min"]

            # Locate the coordinator that owns this VIN
            target_coordinator: ZeekrCoordinator | None = None
            for coord in hass.data[DOMAIN].values():
                if not isinstance(coord, ZeekrCoordinator):
                    continue
                if coord.get_vehicle_by_vin(vin):
                    target_coordinator = coord
                    break

            if target_coordinator is None:
                raise HomeAssistantError(f"No vehicle with VIN {vin} found")

            vehicle = target_coordinator.get_vehicle_by_vin(vin)

            params: list[dict[str, str]] = []

            # AC: only include if temp > 0
            ac_temp = call.data["ac_temp"]
            if ac_temp > 0:
                params.append({"key": "AC", "value": "true"})
                params.append({"key": "AC.temp", "value": str(ac_temp)})
                params.append({"key": "AC.duration", "value": str(duration)})

            # Defrost
            if call.data["defrost"]:
                params.append({"key": "DF", "value": "true"})
                params.append({"key": "DF.level", "value": "2"})

            # Steering wheel heating
            if call.data["steering_wheel"]:
                params.append({"key": "SW", "value": "true"})
                params.append({"key": "SW.level", "value": "3"})
                params.append({"key": "SW.duration", "value": str(duration)})

            # Seat heat (4 seats)
            for seat_field, service_code in SEAT_SERVICE_CODES.items():
                level = call.data[seat_field]
                if level > 0:
                    params.append({"key": service_code, "value": "true"})
                    params.append({"key": f"{service_code}.level", "value": str(level)})
                    params.append({"key": f"{service_code}.duration", "value": str(duration)})

            if not params:
                raise HomeAssistantError(
                    "preconditioning_start called with no active components"
                )

            # Append operation=4 — required by Zeekr cloud for ZAF (EnvRegulation)
            # preconditioning-start. Without it the car silently drops most
            # subsystems (observed 2026-04-20: only SW/steering-wheel was applied).
            params.append({"key": "operation", "value": "4"})

            setting = {"serviceParameters": params}

            _LOGGER.info(
                "preconditioning_start for %s with %d params: %s",
                vin, len(params), params,
            )

            await target_coordinator.async_inc_invoke()
            success = await hass.async_add_executor_job(
                vehicle.do_remote_control, "start", "ZAF", setting
            )
            await target_coordinator.async_request_refresh()

            # The car takes ~60-90s to report preClimateActive=true after ZAF.
            # Trigger an extra refresh around that window so the UI updates
            # faster than the next scheduled poll.
            async def _delayed_refresh(_now) -> None:
                await target_coordinator.async_request_refresh()
            async_call_later(hass, 75, _delayed_refresh)

            short_vin = vin[-4:] if vin else ""
            if not success:
                await herold_notify(
                    hass,
                    topic="zeekr/remote/fehlgeschlagen",
                    titel=f"Zeekr {short_vin}: Vorheizen",
                    message="Preconditioning-Kommando wurde von der Zeekr-Cloud abgelehnt.",
                    severity="warnung",
                )
                return

            await herold_notify(
                hass,
                topic="zeekr/vorheizen/fertig",
                titel=f"Zeekr {short_vin}: Vorheizen gestartet",
                message=f"Preconditioning laeuft fuer {duration} Min ({ac_temp} °C).",
                severity="info",
            )

            if duration > 0:
                async def _notify_done(_now) -> None:
                    await herold_notify(
                        hass,
                        topic="zeekr/vorheizen/fertig",
                        titel=f"Zeekr {short_vin}: Vorheizen fertig",
                        message=f"Preconditioning-Lauf ({duration} Min) abgeschlossen.",
                        severity="info",
                    )
                async_call_later(hass, duration * 60, _notify_done)

        hass.services.async_register(
            DOMAIN,
            SERVICE_PRECONDITIONING_START,
            _handle_preconditioning_start,
            schema=PRECONDITIONING_SCHEMA,
        )

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Handle removal of an entry."""
    coordinator = hass.data[DOMAIN].get(entry.entry_id)
    if coordinator:
        coordinator.stop_vorbereitung_scheduler()
        await coordinator.request_stats.async_shutdown()

    if unloaded := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)
    return unloaded


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload config entry."""
    await async_unload_entry(hass, entry)
    await async_setup_entry(hass, entry)
