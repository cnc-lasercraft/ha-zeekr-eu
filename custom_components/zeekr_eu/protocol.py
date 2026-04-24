"""Zeekr cloud protocol constants.

Centralizes the short 3-letter Service-IDs and serviceParameter keys
used in remote-control requests. Names mirror the decompiled Zeekr
Android app (EnvRegulationRequestParams, *CommandCreator classes).
"""

from __future__ import annotations

# --- Service IDs (sent as top-level "serviceId") -------------------------

SERVICE_ZAF = "ZAF"   # EnvRegulation: AC / Defrost / Rapid Warming / Rapid Cooling / seats / steering wheel
SERVICE_ZAD = "ZAD"   # Storage lockers
SERVICE_ZAE = "ZAE"   # Fridge
SERVICE_RCS = "RCS"   # Charging start/stop, charge limit
SERVICE_RDL = "RDL"   # Remote Door Lock
SERVICE_RDU = "RDU"   # Remote Door Unlock
SERVICE_RDO = "RDO"   # Charge lid open/close
SERVICE_RSM = "RSM"   # Sentry mode
SERVICE_RHL = "RHL"   # Hazard lights (flash blinkers)
SERVICE_RWS = "RWS"   # Windows / sunshade

# --- EnvRegulation serviceParameter keys ---------------------------------

# Exclusive climate subsystems — exactly one may be "true" per ZAF request
KEY_AC = "AC"                 # Standard air conditioning (temp target)
KEY_DF = "DF"                 # Defrost
KEY_RW = "RW"                 # Rapid Warming (Heizen Max)
KEY_RC = "RC"                 # Rapid Cooling (Cooling Max)

# Orthogonal climate subsystems — run alongside any climate mode
KEY_SW = "SW"                 # Steering wheel heat
SEAT_HEAT_FRONT_LEFT = "SH.11"
SEAT_HEAT_FRONT_RIGHT = "SH.19"
SEAT_HEAT_REAR_LEFT = "SH.21"
SEAT_HEAT_REAR_RIGHT = "SH.29"
SEAT_VENT_FRONT_LEFT = "SV.11"
SEAT_VENT_FRONT_RIGHT = "SV.19"
SEAT_VENT_REAR_LEFT = "SV.21"
SEAT_VENT_REAR_RIGHT = "SV.29"

SEAT_SERVICE_CODES = {
    "seat_driver": SEAT_HEAT_FRONT_LEFT,
    "seat_passenger": SEAT_HEAT_FRONT_RIGHT,
    "seat_rear_left": SEAT_HEAT_REAR_LEFT,
    "seat_rear_right": SEAT_HEAT_REAR_RIGHT,
}

# Required operation code for ZAF EnvRegulation-Start. Without this the
# car silently drops most subsystems and only applies SW (observed
# 2026-04-20). See session_last.md for the investigation.
KEY_OPERATION = "operation"
OP_ENV_REGULATION_START = "4"

# --- Other commonly-used parameter keys ---------------------------------

KEY_TARGET = "target"         # RDO, RWS_2: target of the action (charge lid, window, ...)
KEY_DOOR = "door"             # RDL/RDU: which doors
KEY_RSM = "rsm"               # RSM: sentry level
KEY_RHL = "rhl"               # RHL: blink pattern

# --- Common serviceParameter values -------------------------------------

VALUE_TRUE = "true"
VALUE_FALSE = "false"
