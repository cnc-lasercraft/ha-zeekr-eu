"""Optional Herold notification-broker integration.

If the Herold custom component is installed, we register our topics at
startup and route notifications through `herold.senden` instead of a
hard-coded `notify.mobile_app_*`. If Herold isn't present we silently skip.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

HEROLD_DOMAIN = "herold"
HEROLD_QUELLE = "custom_components.zeekr_eu"

# severity: info | warnung | kritisch
# rollen: erwachsener | techn_support (project-specific)
TOPICS: dict[str, dict[str, Any]] = {
    "zeekr/akku/niedrig": {
        "name": "Zeekr Akku niedrig",
        "beschreibung": "SoC unter Schwellwert und nicht am Ladekabel.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/ladung/fertig": {
        "name": "Zeekr Ladung fertig",
        "beschreibung": "Ziel-SoC erreicht und Ladevorgang beendet.",
        "default_severity": "info",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/ladung/fehler": {
        "name": "Zeekr Ladung Fehler",
        "beschreibung": "Ladevorgang unerwartet abgebrochen oder Chargerstate im Fehlerbereich.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener", "techn_support"],
    },
    "zeekr/ladung/nicht_eingesteckt": {
        "name": "Zeekr nicht eingesteckt",
        "beschreibung": "Deadline aktiv, Auto jedoch nicht am Kabel.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/deadline/verpasst": {
        "name": "Zeekr Deadline verpasst",
        "beschreibung": "Ziel-SoC zur Deadline-Zeit nicht erreicht.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/tuer/offen": {
        "name": "Zeekr Tür offen",
        "beschreibung": "Eine Tür steht länger als die Schwelle offen.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/fenster/offen": {
        "name": "Zeekr Fenster offen",
        "beschreibung": "Fenster oder Schiebedach länger offen.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/unverriegelt": {
        "name": "Zeekr nicht verriegelt",
        "beschreibung": "Auto ist parkiert und seit längerem nicht abgeschlossen.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/vorheizen/fertig": {
        "name": "Zeekr Vorheizen fertig",
        "beschreibung": "Preconditioning-Lauf wurde ausgelöst.",
        "default_severity": "info",
        "default_rollen": ["erwachsener"],
    },
    "zeekr/api/fehler": {
        "name": "Zeekr API Fehler",
        "beschreibung": "Login schlägt fehl oder Token/Session ungültig.",
        "default_severity": "warnung",
        "default_rollen": ["techn_support"],
    },
    "zeekr/remote/fehlgeschlagen": {
        "name": "Zeekr Remote-Befehl fehlgeschlagen",
        "beschreibung": "Ein Remote-Kommando (Lock/Climate/Cover/Charging) wurde nicht bestätigt.",
        "default_severity": "warnung",
        "default_rollen": ["erwachsener"],
    },
}


def is_available(hass: HomeAssistant) -> bool:
    """Return True if the Herold integration is loaded."""
    return HEROLD_DOMAIN in hass.data


async def async_register_topics(hass: HomeAssistant) -> None:
    """Register all Zeekr topics with Herold. No-op if Herold isn't loaded."""
    if not is_available(hass):
        return
    for topic_id, meta in TOPICS.items():
        try:
            await hass.services.async_call(
                HEROLD_DOMAIN,
                "topic_registrieren",
                {"topic": topic_id, "quelle": HEROLD_QUELLE, **meta},
                blocking=False,
            )
        except Exception as exc:  # noqa: BLE001
            _LOGGER.debug("Herold topic_registrieren failed for %s: %s", topic_id, exc)


async def async_notify(
    hass: HomeAssistant,
    topic: str,
    titel: str,
    message: str,
    severity: str | None = None,
    actions: list[dict[str, Any]] | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    """Send a notification through Herold. No-op if Herold isn't loaded."""
    if not is_available(hass):
        return
    data: dict[str, Any] = {"topic": topic, "titel": titel, "message": message}
    if severity:
        data["severity"] = severity
    if actions:
        data["actions"] = actions
    if payload:
        data["payload"] = payload
    try:
        await hass.services.async_call(HEROLD_DOMAIN, "senden", data, blocking=False)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("Herold senden failed for topic %s: %s", topic, exc)
