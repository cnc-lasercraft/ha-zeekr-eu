"""Per-vehicle user configuration state for Zeekr EU Integration.

Owns the "settings" that used to live as HA input_select/input_number helpers,
now native to the integration so it ships as a self-contained CC.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time as dtime


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

REIFENSAISON_OPTIONS = ["Sommer", "Winter"]


@dataclass
class ZeekrConfigState:
    """Per-vehicle user-settable configuration."""

    # Basic vehicle info
    farbe: str = "Moonlight White"
    modell: str = "Zeekr 7X"

    # PV-Überschuss-Ceiling: bei Idle-angesteckt nach erreichter Deadline
    # weiterladen bis hierhin (schont NMC-Akku vs. 100%).
    pv_ceiling_soc: float = 90.0

    # Auto-Notladung (Default-Deadline fallback)
    auto_notladung_trigger_soc: float = 15.0
    auto_notladung_ziel_soc: float = 40.0
    auto_notladung_stunden: float = 10.0

    # Deadline (nächste Ladung fertig bis) — Ziel für scheduler-card
    deadline_zeit: dtime = field(default_factory=lambda: dtime(7, 30))
    deadline_soc: float = 80.0
    deadline_aktiv: bool = False

    # Tires
    reifensaison: str = "Sommer"
    reifendruck_vorne_sommer: float = 2.5
    reifendruck_hinten_sommer: float = 2.5
    reifendruck_vorne_winter: float = 2.7
    reifendruck_hinten_winter: float = 2.7
