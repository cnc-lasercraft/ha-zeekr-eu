"""Per-vehicle sensor entity definitions for the Zeekr EU integration.

Factored out of sensor.py to keep the platform module readable.
Public entry point: build_vehicle_sensors(coordinator, vin, data).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.const import (
    PERCENTAGE,
    UnitOfElectricCurrent,
    UnitOfElectricPotential,
    UnitOfLength,
    UnitOfPower,
    UnitOfPressure,
    UnitOfSpeed,
    UnitOfTemperature,
    UnitOfTime,
)

if TYPE_CHECKING:
    from .coordinator import ZeekrCoordinator
    from .sensor import ZeekrSensor as _ZeekrSensor


def build_vehicle_sensors(
    coordinator: "ZeekrCoordinator",
    vin: str,
    data: dict[str, Any],
    sensor_cls: type["_ZeekrSensor"],
    charger_state_cls: type[SensorEntity],
) -> list[SensorEntity]:
    """Return all per-vehicle sensor entities for one VIN."""
    entities: list[SensorEntity] = []
    entities.extend(_energy_sensors(coordinator, vin, data, sensor_cls))
    entities.extend(_climate_and_trip_sensors(coordinator, vin, sensor_cls))
    entities.extend(_tire_sensors(coordinator, vin, sensor_cls))
    entities.extend(_maintenance_sensors(coordinator, vin, sensor_cls))
    entities.extend(_body_sensors(coordinator, vin, sensor_cls))
    entities.extend(_position_sensors(coordinator, vin, sensor_cls))
    entities.extend(_remote_mode_sensors(coordinator, vin, sensor_cls))
    entities.extend(_misc_sensors(coordinator, vin, sensor_cls))
    entities.append(charger_state_cls(coordinator, vin))
    return entities


# ---------------------------------------------------------------------------
# Energy / charging
# ---------------------------------------------------------------------------
def _energy_sensors(coordinator, vin, data, S):
    out: list[SensorEntity] = [
        S(
            coordinator, vin, "battery_level", "Battery Level",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("chargeLevel"),
            PERCENTAGE, SensorDeviceClass.BATTERY, SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "range", "Range",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("distanceToEmptyOnBatteryOnly"),
            UnitOfLength.KILOMETERS, SensorDeviceClass.DISTANCE,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "time_to_fully_charged", "Time To Fully Charged",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("timeToFullyCharged"),
            UnitOfTime.MINUTES, SensorDeviceClass.DURATION,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "range_at_20_soc", "Range At 20% SoC",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("distanceToEmptyOnBattery20Soc"),
            UnitOfLength.KILOMETERS, SensorDeviceClass.DISTANCE,
            SensorStateClass.MEASUREMENT,
        ),
    ]

    # Charging-session-only sensors — chargingStatus block is only present
    # when the car is actually charging.
    if data.get("chargingStatus"):
        out.extend([
            S(
                coordinator, vin, "charge_voltage", "Charge Voltage",
                lambda d: d.get("chargingStatus", {}).get("chargeVoltage"),
                UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE,
                SensorStateClass.MEASUREMENT,
            ),
            S(
                coordinator, vin, "charge_current", "Charge Current",
                lambda d: d.get("chargingStatus", {}).get("chargeCurrent"),
                UnitOfElectricCurrent.AMPERE, SensorDeviceClass.CURRENT,
                SensorStateClass.MEASUREMENT,
            ),
            S(
                coordinator, vin, "charge_power", "Charge Power",
                lambda d: d.get("chargingStatus", {}).get("chargePower"),
                UnitOfPower.KILO_WATT, SensorDeviceClass.POWER,
                SensorStateClass.MEASUREMENT,
            ),
            S(
                coordinator, vin, "charge_speed", "Charge Speed",
                lambda d: d.get("chargingStatus", {}).get("chargeSpeed"),
                "km/h", None, SensorStateClass.MEASUREMENT,
            ),
        ])
    return out


# ---------------------------------------------------------------------------
# Climate and trip counters
# ---------------------------------------------------------------------------
def _climate_and_trip_sensors(coordinator, vin, S):
    return [
        S(
            coordinator, vin, "interior_temp", "Interior Temperature",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("climateStatus", {})
            .get("interiorTemp"),
            UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "trip_2_distance", "Trip 2 Distance",
            lambda d: (
                float(d.get("additionalVehicleStatus", {})
                      .get("runningStatus", {})
                      .get("tripMeter2")) / 10
                if d.get("additionalVehicleStatus", {})
                .get("runningStatus", {})
                .get("tripMeter2") is not None
                else None
            ),
            UnitOfLength.KILOMETERS, SensorDeviceClass.DISTANCE,
            SensorStateClass.TOTAL_INCREASING,
        ),
        S(
            coordinator, vin, "trip_2_avg_speed", "Trip 2 Average Speed",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("runningStatus", {})
            .get("avgSpeed"),
            UnitOfSpeed.KILOMETERS_PER_HOUR, SensorDeviceClass.SPEED,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "trip_2_avg_consumption", "Trip 2 Average Consumption",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("averPowerConsumption"),
            "kWh/100km", None, SensorStateClass.MEASUREMENT,
        ),
    ]


# ---------------------------------------------------------------------------
# Tires (pressure + temperature per corner)
# ---------------------------------------------------------------------------
def _tire_sensors(coordinator, vin, S):
    out: list[SensorEntity] = []
    for tire in ["Driver", "Passenger", "DriverRear", "PassengerRear"]:
        out.append(S(
            coordinator, vin,
            f"tire_pressure_{tire.lower()}", f"Tire Pressure {tire}",
            lambda d, t=tire: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get(f"tyreStatus{t}"),
            UnitOfPressure.KPA, SensorDeviceClass.PRESSURE,
            SensorStateClass.MEASUREMENT,
        ))
        out.append(S(
            coordinator, vin,
            f"tire_temperature_{tire.lower()}", f"Tire Temperature {tire}",
            lambda d, t=tire: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get(f"tyreTemp{t}"),
            UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE,
            SensorStateClass.MEASUREMENT,
        ))
    return out


# ---------------------------------------------------------------------------
# Maintenance / aux battery / service intervals
# ---------------------------------------------------------------------------
def _maintenance_sensors(coordinator, vin, S):
    return [
        S(
            coordinator, vin, "odometer", "Odometer",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("odometer"),
            UnitOfLength.KILOMETERS, SensorDeviceClass.DISTANCE,
            SensorStateClass.TOTAL_INCREASING,
        ),
        S(
            coordinator, vin, "distance_to_service", "Distance To Service",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("distanceToService"),
            UnitOfLength.KILOMETERS, SensorDeviceClass.DISTANCE, None,
        ),
        S(
            coordinator, vin, "days_to_service", "Days To Service",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("daysToService"),
            "d", None, None,
        ),
        S(
            coordinator, vin, "aux_battery_voltage", "Aux Battery Voltage",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("mainBatteryStatus", {})
            .get("voltage"),
            UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "aux_battery_health", "Aux Battery Health",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("mainBatteryStatus", {})
            .get("stateOfHealth"),
            None, None, None,
        ),
        S(
            coordinator, vin, "brake_fluid_level", "Brake Fluid Level",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("maintenanceStatus", {})
            .get("brakeFluidLevelStatus"),
            None, None, None,
        ),
    ]


# ---------------------------------------------------------------------------
# Body state (sunroof, sun curtain, charge lids)
# ---------------------------------------------------------------------------
def _body_sensors(coordinator, vin, S):
    return [
        S(
            coordinator, vin, "sunroof_position", "Sunroof Position",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("climateStatus", {})
            .get("sunroofPos"),
            PERCENTAGE, None, None,
        ),
        S(
            coordinator, vin, "sun_curtain_rear_position", "Sun Curtain Rear Position",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("climateStatus", {})
            .get("sunCurtainRearPos"),
            PERCENTAGE, None, None,
        ),
        S(
            coordinator, vin, "charge_lid_ac", "Charge Lid AC",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("chargeLidAcStatus"),
            None, None, None,
        ),
        S(
            coordinator, vin, "charge_lid_dc", "Charge Lid DC",
            lambda d: d.get("additionalVehicleStatus", {})
            .get("electricVehicleStatus", {})
            .get("chargeLidDcAcStatus"),
            None, None, None,
        ),
    ]


# ---------------------------------------------------------------------------
# Position (speed, altitude, heading)
# ---------------------------------------------------------------------------
def _position_sensors(coordinator, vin, S):
    return [
        S(
            coordinator, vin, "vehicle_speed", "Speed",
            lambda d: d.get("basicVehicleStatus", {}).get("speed"),
            UnitOfSpeed.KILOMETERS_PER_HOUR, SensorDeviceClass.SPEED,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "altitude", "Altitude",
            lambda d: d.get("basicVehicleStatus", {})
            .get("position", {})
            .get("altitude"),
            UnitOfLength.METERS, SensorDeviceClass.DISTANCE,
            SensorStateClass.MEASUREMENT,
        ),
        S(
            coordinator, vin, "heading", "Heading",
            lambda d: d.get("basicVehicleStatus", {})
            .get("position", {})
            .get("direction"),
            "°", None, None,
        ),
    ]


# ---------------------------------------------------------------------------
# Remote-control modes (raw enum codes from remoteControlState)
# ---------------------------------------------------------------------------
_REMOTE_MODES = [
    ("camping_mode", "Camping Mode", "campingModeState"),
    ("parking_comfort_mode", "Parking Comfort Mode", "parkingComfortState"),
    ("wash_car_mode", "Wash Car Mode", "washCarModeState"),
    ("visitor_mode", "Visitor Mode", "visitorModeState"),
    ("privacy_mode", "Privacy Mode", "privacyMode"),
    ("overheat_state", "Overheat State", "overheatState"),
    ("live_detection_state", "Live Detection State", "liveDetectionState"),
]


def _remote_mode_sensors(coordinator, vin, S):
    out: list[SensorEntity] = []
    for mode_key, mode_name, mode_field in _REMOTE_MODES:
        out.append(S(
            coordinator, vin, mode_key, mode_name,
            lambda d, f=mode_field: d.get("additionalVehicleStatus", {})
            .get("remoteControlState", {})
            .get(f),
            None, None, None,
        ))
    return out


# ---------------------------------------------------------------------------
# Misc (fragrance, etc.)
# ---------------------------------------------------------------------------
def _misc_sensors(coordinator, vin, S):
    return [
        S(
            coordinator, vin, "fragrance_active_count", "Fragrance Active Count",
            lambda d: (
                frag.get("activated")
                if isinstance(
                    (frag := d.get("additionalVehicleStatus", {})
                     .get("climateStatus", {})
                     .get("fragStrs")),
                    dict,
                )
                else None
            ),
            None, None, None,
        ),
    ]
