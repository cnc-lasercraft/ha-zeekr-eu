"""Per-vehicle user configuration state for Zeekr EU Integration.

Owns the "settings" that used to live as HA input_select/input_number helpers,
now native to the integration so it ships as a self-contained CC.
"""

from __future__ import annotations

from dataclasses import dataclass


FARBE_OPTIONS = [
    "Moonlight White",
    "Starry Grey",
    "Twilight Bronze",
    "Galaxy Silver",
    "Aurora Green",
    "Forest Green",
    "Cosmos Black",
]

MODELL_OPTIONS = ["Zeekr 7X", "Zeekr 001", "Zeekr 009", "Zeekr X"]

LADEMODUS_OPTIONS = ["Sofort", "Tariff Saver", "Manuell"]

REIFENSAISON_OPTIONS = ["Sommer", "Winter"]


@dataclass
class ZeekrConfigState:
    """Per-vehicle user-settable configuration."""

    # Basic vehicle info
    farbe: str = "Moonlight White"
    modell: str = "Zeekr 7X"

    # Charge management
    lademodus: str = "Sofort"
    laden_max_soc: float = 80.0
    laden_min_soc: float = 70.0
    notladung_start: float = 10.0
    notladung_stop: float = 20.0

    # Tires
    reifensaison: str = "Sommer"
    reifendruck_vorne_sommer: float = 2.5
    reifendruck_hinten_sommer: float = 2.5
    reifendruck_vorne_winter: float = 2.7
    reifendruck_hinten_winter: float = 2.7

    # Runtime-only: hysteresis state for the notladung binary sensor
    _notladung_notig_state: bool = False
