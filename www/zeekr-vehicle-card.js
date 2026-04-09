/**
 * Zeekr Vehicle Card - Custom Lovelace Card for Home Assistant
 * Pure vanilla JS + Shadow DOM (no Lit, no imports, no external dependencies)
 *
 * Usage:
 *   type: custom:zeekr-vehicle-card
 *   entity_prefix: zeekr_5278
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CARD_VERSION = "2.0.0";
const CARD_NAME = "zeekr-vehicle-card";

const SENSOR_MAP = {
  battery_level: "sensor.{prefix}_battery_level",
  range: "sensor.{prefix}_range",
  odometer: "sensor.{prefix}_odometer",
  interior_temp: "sensor.{prefix}_interior_temperature",
  charge_power: "sensor.{prefix}_charge_power",
  charge_current: "sensor.{prefix}_charge_current",
  charge_voltage: "sensor.{prefix}_charge_voltage",
  charge_speed: "sensor.{prefix}_charge_speed",
  charger_state: "sensor.{prefix}_charger_state",
  tire_fl: "sensor.{prefix}_tire_pressure_driver",
  tire_fr: "sensor.{prefix}_tire_pressure_passenger",
  tire_rl: "sensor.{prefix}_tire_pressure_driverrear",
  tire_rr: "sensor.{prefix}_tire_pressure_passengerrear",
  tire_temp_fl: "sensor.{prefix}_tire_temperature_driver",
  tire_temp_fr: "sensor.{prefix}_tire_temperature_passenger",
  tire_temp_rl: "sensor.{prefix}_tire_temperature_driverrear",
  tire_temp_rr: "sensor.{prefix}_tire_temperature_passengerrear",
  consumption: "sensor.{prefix}_trip_2_average_consumption",
};

const BINARY_MAP = {
  charging: "binary_sensor.{prefix}_charging_status",
  plugged_in: "binary_sensor.{prefix}_plugged_in",
  door_fl: "binary_sensor.{prefix}_driver_door_open",
  door_fr: "binary_sensor.{prefix}_passenger_door_open",
  door_rl: "binary_sensor.{prefix}_driver_rear_door_open",
  door_rr: "binary_sensor.{prefix}_passenger_rear_door_open",
  trunk: "binary_sensor.{prefix}_trunk_open",
  hood: "binary_sensor.{prefix}_hood_open",
};

const LOCK_ENTITY = "lock.{prefix}_central_locking";
const SWITCH_DEFROSTER = "switch.{prefix}_defroster";
const SWITCH_SENTRY = "switch.{prefix}_sentry_mode";
const SWITCH_STEERING_HEAT = "switch.{prefix}_steering_wheel_heat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eid(template, prefix) {
  return template.replace("{prefix}", prefix);
}

function stateVal(hass, entityId) {
  var s = hass.states[entityId];
  return s ? s.state : undefined;
}

function stateNum(hass, entityId) {
  var v = stateVal(hass, entityId);
  return v !== undefined && v !== "unavailable" && v !== "unknown" ? parseFloat(v) : null;
}

function isOn(hass, entityId) {
  return stateVal(hass, entityId) === "on";
}

function findVinEntity(hass, domain, suffix) {
  var keys = Object.keys(hass.states);
  return keys.find(function (k) {
    return k.startsWith(domain + ".") && k.endsWith(suffix) && k.includes("l6t");
  });
}

function kpaToBars(kpa) {
  if (kpa === null || kpa === undefined) return "--";
  return (kpa / 100).toFixed(1) + ' bar';
}

function fmt(val, decimals) {
  if (val === null || val === undefined) return "--";
  return decimals !== undefined ? val.toFixed(decimals) : String(val);
}

function tirePressureColor(kpa, targetBar) {
  if (kpa === null || kpa === undefined || !targetBar) return "";
  var actual = kpa / 100;
  var diff = Math.abs(actual - targetBar);
  if (diff > 0.3) return "color:#e53935;";     // rot: >0.3 bar daneben
  if (diff > 0.15) return "color:#ff9800;";     // orange: >0.15 bar
  return "color:#2e7d32;";                       // grün: OK (dunkel)
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
var CARD_STYLES = `
  :host {
    display: block;
  }

  ha-card {
    padding: 16px 16px 32px;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: visible;
    container-type: inline-size;
    container-name: zeekr-card;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 4px;
  }

  .lock-icon {
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .lock-icon:hover {
    background: rgba(128, 128, 128, 0.15);
  }

  .main-layout {
    display: flex;
    gap: 12px;
    align-items: center;
    overflow: visible;
  }

  .vehicle-container {
    position: relative;
    flex: 0 0 50%;
    min-width: 0;
    padding: 36px 0 40px;
    overflow: visible;
  }

  .info-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @container zeekr-card (max-width: 500px) {
    .main-layout {
      flex-direction: column;
    }
    .vehicle-container {
      flex: none;
      width: 100%;
    }
    .info-column {
      width: 100%;
    }
    .top-row {
      flex-wrap: wrap;
      justify-content: center;
    }
    .battery-section {
      flex: 0 0 100%;
    }
    .info-row {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px 16px;
      justify-content: center;
    }
  }


  .vehicle-bg {
    width: 75%;
    height: auto;
    display: block;
    margin: 0 auto;
    filter: brightness(0.85) contrast(1.1);
    opacity: 0.85;
  }

  .bubble {
    position: absolute;
    width: clamp(8px, 3cqi, 21px);
    height: clamp(8px, 3cqi, 21px);
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    transition: background 0.3s;
  }

  .bubble.closed { background: #4caf50; }
  .bubble.open { background: #e53935; animation: pulse-bubble 1.5s infinite; }

  @keyframes pulse-bubble {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }

  .bubble-door-fl { top: 78%; left: 47%; }
  .bubble-door-fr { top: 15%; left: 47%; }
  .bubble-door-rl { top: 78%; left: 63.5%; }
  .bubble-door-rr { top: 15%; left: 63.5%; }
  .bubble-hood    { top: 50%; left: 14.75%; transform: translateY(-50%); }
  .bubble-trunk   { top: 50%; right: 13%; transform: translateY(-50%); }
  .bubble-hood.open { transform: translateY(-50%) scale(1); }


  .tire-label {
    position: absolute;
    font-size: clamp(10px, 2.5cqi, 18px);
    font-weight: 600;
    color: var(--primary-text-color);
    opacity: 0.85;
    background: none;
    padding: 0;
    text-align: center;
    line-height: 1.3;
  }

  .tire-temp {
    font-size: clamp(9px, 2.3cqi, 18px);
    font-weight: 600;
    display: block;
  }

  .tire-fl { bottom: -6px; left: 26%; transform: translateX(-50%); }
  .tire-fr { top: -6px; left: 26%; transform: translateX(-50%); }
  .tire-rl { bottom: -6px; left: 71%; transform: translateX(-50%); }
  .tire-rr { top: -6px; left: 71%; transform: translateX(-50%); }

  .plug-icon {
    position: absolute;
    bottom: 4%;
    left: 76%;
  }

  .plug-icon ha-icon {
    --mdc-icon-size: clamp(16px, 5cqi, 38px) !important;
  }

  .legend {
    display: block;
    text-align: center;
    font-size: 13px;
    opacity: 0.65;
    margin-top: 8px;
  }

  .legend .legend-item {
    display: inline-flex;
    margin: 0 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .legend-dot.green { background: #4caf50; }
  .legend-dot.red { background: #e53935; }
  .legend-dot.orange { background: #ff9800; }

  .battery-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    flex: 1;
  }

  .battery-gauge {
    position: relative;
    width: 150px;
    height: 90px;
    overflow: hidden;
  }

  .battery-gauge svg {
    width: 150px;
    height: 150px;
  }

  .battery-gauge-bg {
    fill: none;
    stroke: rgba(128, 128, 128, 0.2);
    stroke-width: 8;
    stroke-linecap: round;
  }

  .battery-gauge-fill {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.8s ease, stroke 0.5s ease;
  }

  .battery-gauge-fill.charging {
    animation: pulse-charge 2s ease-in-out infinite;
  }

  .gauge-value {
    position: absolute;
    bottom: 4px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 30px;
    font-weight: 700;
    color: var(--primary-text-color);
    line-height: 1;
  }

  .gauge-range {
    text-align: center;
    font-size: 17px;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  @keyframes pulse-charge {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  .charge-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: #ff9800;
    margin: 0;
    font-weight: 500;
  }

  .charge-info span {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .charge-info ha-icon {
    color: #ff9800;
  }

  .top-row {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  .info-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 19px;
    color: var(--secondary-text-color);
    margin: 0;
    flex: 1;
  }

  .info-row span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-row ha-icon {
    color: var(--secondary-text-color);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: rgba(128, 128, 128, 0.1);
    color: var(--primary-text-color);
    transition: background 0.2s, transform 0.1s;
  }

  .action-btn .btn-label {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.2;
  }

  .action-btn:hover {
    background: rgba(128, 128, 128, 0.2);
  }

  .action-btn:active {
    transform: scale(0.93);
  }

  .action-btn.active {
    background: var(--primary-color);
    color: #fff;
  }

  .action-btn.active ha-icon {
    color: #fff;
  }

  .action-btn ha-icon {
    color: var(--primary-text-color);
  }

  .preheat-btn.active {
    background: #ff5722;
  }
`;

// ---------------------------------------------------------------------------
// SVG builder
// ---------------------------------------------------------------------------
function buildVehicleSvg(doors, hood, trunk) {
  var dc = function (open) { return open ? "#e53935" : "transparent"; };
  var dOp = function (open) { return open ? "0.5" : "0"; };
  var hoodColor = hood ? "#e53935" : "transparent";
  var hoodOp = hood ? "0.4" : "0";
  var trunkColor = trunk ? "#e53935" : "transparent";
  var trunkOp = trunk ? "0.4" : "0";

  // Overlay-only SVG matching the rotated background image (610x267 rotated = 267x610)
  return '<svg viewBox="0 0 267 610" xmlns="http://www.w3.org/2000/svg" class="vehicle-svg">'
    + '<defs>'
    + '<linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="var(--primary-text-color)" stop-opacity="0.08" />'
    + '<stop offset="100%" stop-color="var(--primary-text-color)" stop-opacity="0.03" />'
    + '</linearGradient>'
    + '<linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#81d4fa" stop-opacity="0.35" />'
    + '<stop offset="100%" stop-color="#4fc3f7" stop-opacity="0.18" />'
    + '</linearGradient>'
    + '</defs>'

    // Body shell - Zeekr 7X: rounded, flowing, muscular rear shoulders, pinched waist
    + '<path d="'
    + 'M 72,42 '
    + 'C 68,36 68,28 80,22 L 140,22 C 152,28 152,36 148,42 '  // Front nose, rounded
    + 'L 152,70 '                                                  // Front fender widens
    + 'C 156,85 158,95 158,110 '                                   // Front wheel arch
    + 'L 158,140 '
    + 'C 156,160 154,170 152,180 '                                 // Pinched waist
    + 'L 152,220 '
    + 'C 154,240 156,250 158,260 '                                 // Widens to rear
    + 'L 160,300 '                                                  // Rear wheel arch - wider
    + 'C 160,320 158,340 156,360 '
    + 'L 152,390 '
    + 'C 150,400 146,408 136,412 L 84,412 C 74,408 70,400 68,390 '  // Rear end
    + 'L 64,360 '
    + 'C 62,340 60,320 60,300 '
    + 'L 62,260 '                                                   // Rear wheel arch left
    + 'C 64,250 66,240 68,220 '
    + 'L 68,180 '
    + 'C 66,170 64,160 62,140 '                                    // Pinched waist left
    + 'L 62,110 '
    + 'C 62,95 64,85 68,70 '                                       // Front wheel arch left
    + 'Z'
    + '" fill="url(#bodyGrad)" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.3" />'

    // Windshield - wide, swept back
    + '<path d="M 78,68 C 78,58 86,52 96,50 L 124,50 C 134,52 142,58 142,68 L 144,110 C 144,116 140,120 134,122 L 86,122 C 80,120 76,116 76,110 Z" fill="url(#glassGrad)" stroke="var(--primary-text-color)" stroke-width="0.8" stroke-opacity="0.2" />'

    // A-pillar lines
    + '<line x1="78" y1="68" x2="76" y2="110" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.15" />'
    + '<line x1="142" y1="68" x2="144" y2="110" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.15" />'

    // Panorama glass roof
    + '<path d="M 80,132 C 80,128 84,126 90,126 L 130,126 C 136,126 140,128 140,132 L 140,270 C 140,274 136,276 130,276 L 90,276 C 84,276 80,274 80,270 Z" fill="url(#glassGrad)" fill-opacity="0.5" stroke="var(--primary-text-color)" stroke-width="0.5" stroke-opacity="0.12" />'

    // Rear window - smaller, more angled
    + '<path d="M 82,310 C 80,306 82,300 88,296 L 132,296 C 138,300 140,306 138,310 L 136,335 C 136,340 132,342 126,342 L 94,342 C 88,342 84,340 84,335 Z" fill="url(#glassGrad)" stroke="var(--primary-text-color)" stroke-width="0.8" stroke-opacity="0.2" />'

    // Hood
    + '<path d="M 80,28 C 80,24 88,22 96,22 L 124,22 C 132,22 140,24 140,28 L 142,48 L 78,48 Z" fill="' + hoodColor + '" fill-opacity="' + (hood ? '0.4' : '0.1') + '" stroke="' + hoodColor + '" stroke-width="0.8" stroke-opacity="0.4" />'

    // Trunk / tailgate
    + '<path d="M 76,365 L 144,365 L 142,395 C 140,404 136,410 126,412 L 94,412 C 84,410 80,404 78,395 Z" fill="' + trunkColor + '" fill-opacity="' + (trunk ? '0.4' : '0.1') + '" stroke="' + trunkColor + '" stroke-width="0.8" stroke-opacity="0.4" />'

    // Door FL (driver front left)
    + '<path d="M 62,118 L 76,118 L 76,195 L 66,195 C 62,193 60,188 60,182 L 60,130 C 60,124 61,120 62,118 Z" fill="' + dc(doors.fl) + '" fill-opacity="' + dOp(doors.fl) + '" stroke="' + dc(doors.fl) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door FR (passenger front right)
    + '<path d="M 144,118 L 158,118 C 159,120 160,124 160,130 L 160,182 C 160,188 158,193 154,195 L 144,195 Z" fill="' + dc(doors.fr) + '" fill-opacity="' + dOp(doors.fr) + '" stroke="' + dc(doors.fr) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door RL (driver rear left)
    + '<path d="M 66,205 L 76,205 L 76,290 L 64,290 C 62,288 60,284 60,278 L 60,218 C 60,212 62,208 66,205 Z" fill="' + dc(doors.rl) + '" fill-opacity="' + dOp(doors.rl) + '" stroke="' + dc(doors.rl) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door RR (passenger rear right)
    + '<path d="M 144,205 L 154,205 C 158,208 160,212 160,218 L 160,278 C 160,284 158,288 156,290 L 144,290 Z" fill="' + dc(doors.rr) + '" fill-opacity="' + dOp(doors.rr) + '" stroke="' + dc(doors.rr) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Side windows front (left & right)
    + '<path d="M 64,124 L 74,124 L 74,190 L 68,190 C 64,188 62,184 62,178 L 62,134 C 62,128 63,125 64,124 Z" fill="url(#glassGrad)" opacity="0.5" />'
    + '<path d="M 146,124 L 156,124 C 157,125 158,128 158,134 L 158,178 C 158,184 156,188 152,190 L 146,190 Z" fill="url(#glassGrad)" opacity="0.5" />'

    // Side windows rear (left & right)
    + '<path d="M 68,210 L 74,210 L 74,284 L 66,284 C 64,282 62,278 62,272 L 62,224 C 62,216 64,212 68,210 Z" fill="url(#glassGrad)" opacity="0.5" />'
    + '<path d="M 146,210 L 152,210 C 156,212 158,216 158,224 L 158,272 C 158,278 156,282 154,284 L 146,284 Z" fill="url(#glassGrad)" opacity="0.5" />'

    // Wheels - rounded rects
    + '<rect x="44" y="92" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="160" y="92" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="44" y="296" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="160" y="296" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'

    // Headlight bar - thin, spanning full width (Zeekr signature)
    + '<rect x="74" y="30" width="72" height="2.5" rx="1.2" fill="#fff9c4" fill-opacity="0.6" />'

    // Tail light bar - thin, spanning full width (Zeekr signature)
    + '<rect x="78" y="395" width="64" height="2.5" rx="1.2" fill="#ef9a9a" fill-opacity="0.6" />'

    // Side mirrors
    + '<ellipse cx="56" cy="105" rx="5" ry="3" fill="var(--primary-text-color)" fill-opacity="0.15" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.25" />'
    + '<ellipse cx="164" cy="105" rx="5" ry="3" fill="var(--primary-text-color)" fill-opacity="0.15" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.25" />'

    // Roof rail accent lines
    + '<line x1="82" y1="130" x2="82" y2="275" stroke="var(--primary-text-color)" stroke-width="0.4" stroke-opacity="0.1" />'
    + '<line x1="138" y1="130" x2="138" y2="275" stroke="var(--primary-text-color)" stroke-width="0.4" stroke-opacity="0.1" />'

    + '</svg>';
}

// ---------------------------------------------------------------------------
// Card class
// ---------------------------------------------------------------------------
class ZeekrVehicleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._prefix = null;
    this._entities = {};
    this._lockEntity = null;
    this._defrosterEntity = null;
    this._sentryEntity = null;
    this._climateEntity = null;
    this._flashEntity = null;
    this._vinResolved = false;
    this._prevStates = {};
  }

  setConfig(config) {
    if (!config.entity_prefix) {
      throw new Error("Please define entity_prefix");
    }
    this._config = Object.assign({}, config);
    this._prefix = config.entity_prefix;

    // Pre-resolve entity IDs
    this._entities = {};
    var key, tpl;
    for (key in SENSOR_MAP) {
      tpl = SENSOR_MAP[key];
      this._entities[key] = eid(tpl, this._prefix);
    }
    for (key in BINARY_MAP) {
      tpl = BINARY_MAP[key];
      this._entities[key] = eid(tpl, this._prefix);
    }
    this._lockEntity = eid(LOCK_ENTITY, this._prefix);
    this._defrosterEntity = eid(SWITCH_DEFROSTER, this._prefix);
    this._sentryEntity = eid(SWITCH_SENTRY, this._prefix);
    this._steeringHeatEntity = eid(SWITCH_STEERING_HEAT, this._prefix);

    this._vinResolved = false;
    this._climateEntity = null;
    this._flashEntity = null;
    this._seatHeatEntities = null;
  }

  set hass(value) {
    var old = this._hass;
    this._hass = value;

    // Resolve VIN entities once
    if (!this._vinResolved && value && value.states) {
      this._climateEntity = findVinEntity(value, "climate", "_climate");
      this._flashEntity = findVinEntity(value, "button", "_flash_blinkers");
      // Find seat heat selects (VIN-based entity IDs)
      var states = Object.keys(value.states);
      var findSeat = function(suffix) {
        return states.find(function(k) { return k.startsWith("select.zeekr_") && k.endsWith(suffix); }) || null;
      };
      this._seatHeatEntities = {
        driver: findSeat("_driver_seat_heat"),
        passenger: findSeat("_passenger_seat_heat"),
        rear_left: findSeat("_rear_left_seat_heat"),
        rear_right: findSeat("_rear_right_seat_heat"),
      };
      console.log("[ZEEKR] Seat heat entities:", JSON.stringify(this._seatHeatEntities));
      this._vinResolved = true;
    }

    // State diffing: only re-render when watched entities change
    if (old && value) {
      var watchList = Object.values(this._entities).concat([
        this._lockEntity,
        this._defrosterEntity,
        this._sentryEntity,
        this._climateEntity,
        "input_select.zeekr_reifensaison",
        "input_number.zeekr_reifendruck_vorne_sommer",
        "input_number.zeekr_reifendruck_hinten_sommer",
        "input_number.zeekr_reifendruck_vorne_winter",
        "input_number.zeekr_reifendruck_hinten_winter",
        "input_select.zeekr_lademodus",
        "input_number.zeekr_laden_min_soc",
        "input_number.zeekr_laden_max_soc",
        "input_number.zeekr_notladung_start",
        "input_number.zeekr_notladung_stop",
        "switch.zeekr_5278_charging",
        "select.zeekr_l6tza1s4xsn095278_driver_seat_vent",
        "select.zeekr_l6tza1s4xsn095278_passenger_seat_vent",
        "binary_sensor.zeekr_5278_tire_pre_warning_driver",
        "binary_sensor.zeekr_5278_tire_pre_warning_passenger",
        "binary_sensor.zeekr_5278_tire_pre_warning_driverrear",
        "binary_sensor.zeekr_5278_tire_pre_warning_passengerrear",
        "binary_sensor.zeekr_5278_tire_temp_warning_driver",
        "binary_sensor.zeekr_5278_tire_temp_warning_passenger",
        "binary_sensor.zeekr_5278_tire_temp_warning_driverrear",
        "binary_sensor.zeekr_5278_tire_temp_warning_passengerrear",
      ]).filter(Boolean);

      var changed = false;
      for (var i = 0; i < watchList.length; i++) {
        var id = watchList[i];
        if (old.states[id] !== value.states[id]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
    }

    this._render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement("zeekr-vehicle-card-editor");
  }

  static getStubConfig() {
    return {
      entity_prefix: "zeekr_5278",
      tire_season: "summer",
      tire_front_summer: 2.5,
      tire_rear_summer: 2.5,
      tire_front_winter: 2.7,
      tire_rear_winter: 2.7,
    };
  }

  // --- Render ---
  _render() {
    if (!this._hass || !this._config) return;
    var h = this._hass;
    var e = this._entities;

    // Gather values
    var soc = stateNum(h, e.battery_level);
    var range = stateNum(h, e.range);
    var odometer = stateNum(h, e.odometer);
    var interiorTemp = stateNum(h, e.interior_temp);
    var consumption = stateNum(h, e.consumption);

    var isCharging = isOn(h, e.charging);
    var isPlugged = isOn(h, e.plugged_in);
    var chargePower = stateNum(h, e.charge_power);
    var chargeCurrent = stateNum(h, e.charge_current);
    var chargeVoltage = stateNum(h, e.charge_voltage);
    var chargeSpeed = stateNum(h, e.charge_speed);

    var doors = {
      fl: isOn(h, e.door_fl),
      fr: isOn(h, e.door_fr),
      rl: isOn(h, e.door_rl),
      rr: isOn(h, e.door_rr),
    };
    var hoodOpen = isOn(h, e.hood);
    var trunkOpen = isOn(h, e.trunk);

    var tireFL = stateNum(h, e.tire_fl);
    var tireFR = stateNum(h, e.tire_fr);
    var tireRL = stateNum(h, e.tire_rl);
    var tireRR = stateNum(h, e.tire_rr);
    var tireTempFL = stateNum(h, e.tire_temp_fl);
    var tireTempFR = stateNum(h, e.tire_temp_fr);
    var tireTempRL = stateNum(h, e.tire_temp_rl);
    var tireTempRR = stateNum(h, e.tire_temp_rr);

    // Tire pressure targets from HA helpers
    var season = stateVal(h, "input_select.zeekr_reifensaison");
    var isWinter = season === "Winter";
    var targetF = stateNum(h, isWinter
      ? "input_number.zeekr_reifendruck_vorne_winter"
      : "input_number.zeekr_reifendruck_vorne_sommer") || (isWinter ? 2.7 : 2.5);
    var targetR = stateNum(h, isWinter
      ? "input_number.zeekr_reifendruck_hinten_winter"
      : "input_number.zeekr_reifendruck_hinten_sommer") || (isWinter ? 2.7 : 2.5);

    var locked = stateVal(h, this._lockEntity) === "locked";
    var lockColor = locked ? "#4caf50" : "#e53935";
    var lockIcon = locked ? "mdi:lock" : "mdi:lock-open-variant";

    var climateState = this._climateEntity ? stateVal(h, this._climateEntity) : null;
    var climateOn = climateState && climateState !== "off" && climateState !== "unavailable";

    var defrosterOn = isOn(h, this._defrosterEntity);
    var sentryOn = isOn(h, this._sentryEntity);
    var steeringHeatOn = isOn(h, this._steeringHeatEntity);

    // Preheat active = climate on + steering heat + any seat heat
    var preheatActive = climateOn && steeringHeatOn;

    // Battery bar color
    var battColor = "#4caf50";
    if (isCharging) battColor = "#ff9800";
    else if (soc !== null && soc <= 20) battColor = "#e53935";
    else if (soc !== null && soc <= 50) battColor = "#ffc107";

    // Build HTML
    var html = '<style>' + CARD_STYLES + '</style>'
      + '<ha-card>'

      // Header
      + '<div class="header">'
      + '<div class="lock-icon" id="header-lock">'
      + '<ha-icon icon="' + lockIcon + '" style="color: ' + lockColor + '; --mdc-icon-size: 22px;"></ha-icon>'
      + '</div>'
      + '</div>'

      // Main 2-column layout
      + '<div class="main-layout">'

      // Vehicle image with status bubbles
      + '<div class="vehicle-container">'
      + '<img src="/local/zeekr-7x-top.svg?v=28" class="vehicle-bg" alt="" />'
      + '<div class="bubble bubble-door-fl ' + (doors.fl ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-fr ' + (doors.fr ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-rl ' + (doors.rl ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-rr ' + (doors.rr ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-hood ' + (hoodOpen ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-trunk ' + (trunkOpen ? 'open' : 'closed') + '"></div>'
      + '<div class="tire-label tire-fl" style="' + tirePressureColor(tireFL, targetF) + '">' + kpaToBars(tireFL) + '<span class="tire-temp">' + (tireTempFL !== null ? tireTempFL.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-fr" style="' + tirePressureColor(tireFR, targetF) + '">' + kpaToBars(tireFR) + '<span class="tire-temp">' + (tireTempFR !== null ? tireTempFR.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-rl" style="' + tirePressureColor(tireRL, targetR) + '">' + kpaToBars(tireRL) + '<span class="tire-temp">' + (tireTempRL !== null ? tireTempRL.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-rr" style="' + tirePressureColor(tireRR, targetR) + '">' + kpaToBars(tireRR) + '<span class="tire-temp">' + (tireTempRR !== null ? tireTempRR.toFixed(0) + '°C' : '') + '</span></div>'
      + (isPlugged
        ? '<div class="plug-icon"><ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size: 38px; color: #ff9800;"></ha-icon></div>'
        : '')
      + '<div style="position:absolute;bottom:-12px;left:0;right:0;text-align:center;font-size:13px;opacity:0.65;">'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4caf50;vertical-align:middle;"></span> Zu</span>'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e53935;vertical-align:middle;"></span> Offen</span>'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff9800;vertical-align:middle;"></span> Kabel</span>'
      + '</div>'
      + '</div>'

      // Right info column
      + '<div class="info-column">'

      // Top row: gauge left, info right
      + '<div class="top-row">'

      // Battery gauge
      + (function() {
          var r = 48;
          var circ = Math.PI * r;
          var offset = circ - (soc !== null ? soc : 0) / 100 * circ;
          return '<div class="battery-section">'
            + '<div class="battery-gauge">'
            + '<svg viewBox="0 0 120 120">'
            + '<path class="battery-gauge-bg" d="M 12,60 A 48,48 0 0,1 108,60" />'
            + '<path class="battery-gauge-fill' + (isCharging ? ' charging' : '') + '" d="M 12,60 A 48,48 0 0,1 108,60" stroke="' + battColor + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" />'
            + '</svg>'
            + '<div class="gauge-value">' + (soc !== null ? soc.toFixed(0) : "--") + '%</div>'
            + '</div>'
            + '<div class="gauge-range">' + (range !== null ? range.toFixed(0) : "--") + ' km</div>'
            + (function() {
                var cs = stateVal(h, e.charger_state);
                var csMap = {'0': 'Getrennt', '1': 'Verbunden', '2': 'Laden', '3': 'Pausiert', '4': 'Fertig'};
                var csText = csMap[cs] || cs || '';
                var csColor = cs === '2' ? '#ff9800' : 'var(--secondary-text-color)';
                var lademodus = stateVal(h, 'input_select.zeekr_lademodus') || 'Sofort';
                var notStart = stateNum(h, 'input_number.zeekr_notladung_start');
                var notStop = stateNum(h, 'input_number.zeekr_notladung_stop');
                var komfort = stateNum(h, 'input_number.zeekr_laden_min_soc');
                var maxSoc = stateNum(h, 'input_number.zeekr_laden_max_soc');
                var modeIcon = lademodus === 'Tariff Saver' ? 'mdi:currency-usd' : lademodus === 'Manuell' ? 'mdi:hand-back-right' : 'mdi:flash';
                var statusLine = csText ? '<ha-icon icon="mdi:ev-station" style="--mdc-icon-size:16px;color:' + csColor + ';"></ha-icon> ' + csText : '';
                var modeLine = '<ha-icon icon="' + modeIcon + '" style="--mdc-icon-size:16px;"></ha-icon> ' + lademodus;
                var socLine = (maxSoc !== null) ? '<span style="opacity:0.6;"> → ' + maxSoc.toFixed(0) + '%</span>' : '';
                return '<div style="text-align:center;font-size:13px;font-weight:500;color:' + csColor + ';margin-top:2px;line-height:1.6;">'
                  + statusLine + (statusLine && modeLine ? '<br>' : '') + modeLine + socLine
                  + '</div>';
              })()
            + '</div>';
        })()

      // Info column right of gauge
      + '<div class="info-row">'
      + (interiorTemp !== null
        ? '<span><ha-icon icon="mdi:thermometer" style="--mdc-icon-size: 22px;"></ha-icon> ' + interiorTemp.toFixed(1) + '&deg;C</span>'
        : '')
      + (odometer !== null
        ? '<span><ha-icon icon="mdi:counter" style="--mdc-icon-size: 22px;"></ha-icon> ' + odometer.toLocaleString() + ' km</span>'
        : '')
      + (consumption !== null
        ? '<span><ha-icon icon="mdi:leaf" style="--mdc-icon-size: 22px;"></ha-icon> ' + consumption.toFixed(1) + ' kWh</span>'
        : '')
      + '</div>'

      // Charge details (3rd column)
      + '<div class="info-row">'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:flash" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargePower, 1) + ' kW</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:current-ac" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargeCurrent, 1) + ' A</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:sine-wave" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargeVoltage, 0) + ' V</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:speedometer" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> +' + fmt(chargeSpeed, 0) + ' km/h</span>'
      + '</div>'

      + '</div>' // top-row

      // Action buttons
      + '<div class="actions">'
      + '<button class="action-btn preheat-btn' + (preheatActive ? ' active' : '') + '" id="btn-preheat">'
      + '<ha-icon icon="mdi:car-seat-heater" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Vorheizen ' + (preheatActive ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (locked ? ' active' : '') + '" id="btn-lock">'
      + '<ha-icon icon="' + lockIcon + '" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">' + (locked ? 'Verriegelt' : 'Entriegelt') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (climateOn ? ' active' : '') + '" id="btn-climate">'
      + '<ha-icon icon="mdi:air-conditioner" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Klima ' + (climateOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn" id="btn-flash">'
      + '<ha-icon icon="mdi:car-light-alert" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Blinken</span>'
      + '</button>'
      + '<button class="action-btn' + (defrosterOn ? ' active' : '') + '" id="btn-defrost">'
      + '<ha-icon icon="mdi:car-defrost-front" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Defrost ' + (defrosterOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (sentryOn ? ' active' : '') + '" id="btn-sentry">'
      + '<ha-icon icon="mdi:shield-car" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Überwachung ' + (sentryOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '</div>'

      + (function(seatHeatEntities) {
          var items = [];
          if (isCharging) items.push('<ha-icon icon="mdi:battery-charging" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Laden aktiv');
          if (isPlugged && !isCharging) items.push('<ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Kabel eingesteckt');
          if (climateOn) items.push('<ha-icon icon="mdi:air-conditioner" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Klima');
          if (defrosterOn) items.push('<ha-icon icon="mdi:car-defrost-front" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Defrost');
          if (steeringHeatOn) items.push('<ha-icon icon="mdi:steering" style="--mdc-icon-size:16px;color:#ff5722;"></ha-icon> Lenkradheizung');
          if (seatHeatEntities) {
            var seatNames = {driver: 'Fahrer', passenger: 'Beifahrer', rear_left: 'Hinten L', rear_right: 'Hinten R'};
            for (var sk in seatHeatEntities) {
              var se = seatHeatEntities[sk];
              if (se) {
                var sv = stateVal(h, se);
                if (sv && sv !== 'off' && sv !== 'unavailable' && sv !== 'unknown') {
                  items.push('<ha-icon icon="mdi:car-seat-heater" style="--mdc-icon-size:16px;color:#ff5722;"></ha-icon> ' + seatNames[sk] + ' ' + sv);
                }
              }
            }
          }
          var chargingSw = stateVal(h, 'switch.zeekr_5278_charging');
          if (chargingSw === 'on') items.push('<ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Lade-Switch Ein');
          var driverVent = stateVal(h, 'select.zeekr_l6tza1s4xsn095278_driver_seat_vent');
          if (driverVent && driverVent !== 'Off' && driverVent !== 'off' && driverVent !== 'unavailable') items.push('<ha-icon icon="mdi:fan" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Belüftung Fahrer ' + driverVent);
          var passVent = stateVal(h, 'select.zeekr_l6tza1s4xsn095278_passenger_seat_vent');
          if (passVent && passVent !== 'Off' && passVent !== 'off' && passVent !== 'unavailable') items.push('<ha-icon icon="mdi:fan" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Belüftung Beifahrer ' + passVent);
          if (sentryOn) items.push('<ha-icon icon="mdi:shield-car" style="--mdc-icon-size:16px;color:#66bb6a;"></ha-icon> Überwachung');
          if (!locked) items.push('<ha-icon icon="mdi:lock-open-variant" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Entriegelt');
          if (doors.fl || doors.fr || doors.rl || doors.rr) items.push('<ha-icon icon="mdi:car-door" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Tür offen');
          if (hoodOpen) items.push('<ha-icon icon="mdi:car" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Motorhaube offen');
          if (trunkOpen) items.push('<ha-icon icon="mdi:car-back" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Heckklappe offen');
          var tireWarnPos = ['driver', 'passenger', 'driverrear', 'passengerrear'];
          var tireWarnNames = ['VL', 'VR', 'HL', 'HR'];
          for (var tw = 0; tw < 4; tw++) {
            if (isOn(h, 'binary_sensor.zeekr_5278_tire_pre_warning_' + tireWarnPos[tw])) items.push('<ha-icon icon="mdi:tire" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Reifendruck ' + tireWarnNames[tw]);
            if (isOn(h, 'binary_sensor.zeekr_5278_tire_temp_warning_' + tireWarnPos[tw])) items.push('<ha-icon icon="mdi:thermometer-alert" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Reifentemp ' + tireWarnNames[tw]);
          }

          if (items.length === 0) return '';
          return '<div style="margin-top:10px;padding:8px 10px;background:rgba(128,128,128,0.08);border-radius:8px;font-size:13px;line-height:1.8;">'
            + '<div style="font-size:11px;opacity:0.5;margin-bottom:4px;">AKTIV</div>'
            + items.join('<br>')
            + '</div>';
        })(this._seatHeatEntities)

      + '</div>' // info-column
      + '</div>' // main-layout

      + '</ha-card>';

    this.shadowRoot.innerHTML = html;

    // Attach event listeners
    var self = this;
    var headerLock = this.shadowRoot.getElementById("header-lock");
    if (headerLock) headerLock.addEventListener("click", function () { self._toggleLock(); });

    var btnPreheat = this.shadowRoot.getElementById("btn-preheat");
    if (btnPreheat) btnPreheat.addEventListener("click", function () { self._togglePreheat(); });

    var btnLock = this.shadowRoot.getElementById("btn-lock");
    if (btnLock) btnLock.addEventListener("click", function () { self._toggleLock(); });

    var btnClimate = this.shadowRoot.getElementById("btn-climate");
    if (btnClimate) btnClimate.addEventListener("click", function () { self._toggleClimate(); });

    var btnFlash = this.shadowRoot.getElementById("btn-flash");
    if (btnFlash) btnFlash.addEventListener("click", function () { self._flashBlinkers(); });

    var btnDefrost = this.shadowRoot.getElementById("btn-defrost");
    if (btnDefrost) btnDefrost.addEventListener("click", function () { self._toggleSwitch(self._defrosterEntity); });

    var btnSentry = this.shadowRoot.getElementById("btn-sentry");
    if (btnSentry) btnSentry.addEventListener("click", function () { self._toggleSwitch(self._sentryEntity); });
  }

  // --- Actions ---
  _toggleLock() {
    var h = this._hass;
    if (!h) return;
    var locked = stateVal(h, this._lockEntity) === "locked";
    h.callService("lock", locked ? "unlock" : "lock", {
      entity_id: this._lockEntity,
    });
  }

  _togglePreheat() {
    if (!this._hass) return;
    var h = this._hass;
    var climateState = this._climateEntity ? stateVal(h, this._climateEntity) : null;
    var isActive = climateState && climateState !== "off" && climateState !== "unavailable"
      && isOn(h, this._steeringHeatEntity);

    if (isActive) {
      // Turn everything off
      if (this._climateEntity) {
        h.callService("climate", "set_hvac_mode", {
          entity_id: this._climateEntity,
          hvac_mode: "off",
        });
      }
      if (isOn(h, this._steeringHeatEntity)) {
        h.callService("switch", "turn_off", { entity_id: this._steeringHeatEntity });
      }
      // Turn off driver seat heater
      var seats = this._seatHeatEntities;
      if (seats && seats.driver && stateVal(h, seats.driver) !== "Off") {
        h.callService("select", "select_option", {
          entity_id: seats.driver,
          option: "Off",
        });
      }
    } else {
      // Turn everything on: Climate 22°C, steering heat, front seats max
      if (this._climateEntity) {
        h.callService("climate", "set_temperature", {
          entity_id: this._climateEntity,
          temperature: 22,
          hvac_mode: "heat_cool",
        });
      }
      h.callService("switch", "turn_on", { entity_id: this._steeringHeatEntity });
      // Driver seat heater to Level 3
      var seats = this._seatHeatEntities;
      if (seats && seats.driver) {
        h.callService("select", "select_option", {
          entity_id: seats.driver,
          option: "Level 3",
        });
      }
    }
  }

  _toggleClimate() {
    if (!this._climateEntity || !this._hass) return;
    var state = stateVal(this._hass, this._climateEntity);
    var isOff = state === "off";
    this._hass.callService("climate", "set_hvac_mode", {
      entity_id: this._climateEntity,
      hvac_mode: isOff ? "heat_cool" : "off",
    });
  }

  _flashBlinkers() {
    if (!this._flashEntity || !this._hass) return;
    this._hass.callService("button", "press", {
      entity_id: this._flashEntity,
    });
  }

  _toggleSwitch(entityId) {
    if (!entityId || !this._hass) return;
    this._hass.callService("switch", "toggle", {
      entity_id: entityId,
    });
  }
}

// ---------------------------------------------------------------------------
// Card editor (plain HTMLElement)
// ---------------------------------------------------------------------------
class ZeekrVehicleCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(value) {
    // Not needed for editor, but HA sets it
  }

  _render() {
    if (!this._config) return;

    var isSummer = (this._config.tire_season || 'summer') === 'summer';
    var act = 'background:var(--primary-color);color:#fff;border-color:var(--primary-color);';
    var inact = 'background:transparent;color:var(--primary-text-color);border-color:rgba(128,128,128,0.3);';
    var sumStyle = isSummer ? act : inact;
    var winStyle = !isSummer ? act : inact;

    this.shadowRoot.innerHTML = '<style>'
      + '.editor { padding: 16px; display: flex; flex-direction: column; gap: 16px; }'
      + '.section { background: var(--ha-card-background, rgba(128,128,128,0.06)); border-radius: 12px; padding: 16px; }'
      + '.section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }'
      + '.season-toggle { display: flex; gap: 8px; margin-bottom: 16px; }'
      + '.season-btn { flex: 1; padding: 12px; border: 2px solid; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; text-align: center; transition: all 0.2s; }'
      + '.season-btn:hover { opacity: 0.85; }'
      + '.pressure-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }'
      + '.pressure-card { background: var(--card-background-color, rgba(128,128,128,0.08)); border-radius: 10px; padding: 12px; text-align: center; }'
      + '.pressure-card .label { font-size: 12px; opacity: 0.6; margin-bottom: 4px; }'
      + '.pressure-card ha-textfield { width: 100%; }'
      + '.active-hint { text-align: center; font-size: 13px; margin-top: 8px; padding: 8px; border-radius: 8px; }'
      + '</style>'

      + '<div class="editor">'

      // Fahrzeug
      + '<div class="section">'
      + '<div class="section-title"><ha-icon icon="mdi:car" style="--mdc-icon-size:20px;"></ha-icon> Fahrzeug</div>'
      + '<ha-textfield label="Entity Prefix" value="' + (this._config.entity_prefix || '') + '" helper="z.B. zeekr_5278" id="cfg-prefix" style="width:100%;"></ha-textfield>'
      + '</div>'

      // Reifendruck
      + '<div class="section">'
      + '<div class="section-title"><ha-icon icon="mdi:tire" style="--mdc-icon-size:20px;"></ha-icon> Reifendruck</div>'

      // Saison Toggle
      + '<div class="season-toggle">'
      + '<button class="season-btn" id="btn-summer" style="' + sumStyle + '">☀️ Sommerreifen</button>'
      + '<button class="season-btn" id="btn-winter" style="' + winStyle + '">❄️ Winterreifen</button>'
      + '</div>'

      // Aktiver Hinweis
      + '<div class="active-hint" style="background:' + (isSummer ? 'rgba(255,193,7,0.12)' : 'rgba(33,150,243,0.12)') + ';">'
      + (isSummer ? '☀️ Aktiv: Sommerreifen' : '❄️ Aktiv: Winterreifen')
      + ' — Soll: <b>' + (isSummer ? (this._config.tire_front_summer || 2.5) : (this._config.tire_front_winter || 2.7)) + '</b> bar (V) / '
      + '<b>' + (isSummer ? (this._config.tire_rear_summer || 2.5) : (this._config.tire_rear_winter || 2.7)) + '</b> bar (H)'
      + '</div>'

      // Druckwerte Grid
      + '<div style="margin-top: 12px;">'
      + '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; text-align:center; font-size: 12px; opacity: 0.5; margin-bottom: 4px;">'
      + '<span>☀️ Sommer</span><span>❄️ Winter</span>'
      + '</div>'

      + '<div style="font-size: 13px; font-weight: 600; margin: 8px 0 4px; opacity: 0.7;">Vorderachse</div>'
      + '<div class="pressure-grid">'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_front_summer || 2.5) + '" id="cfg-tfs"></ha-textfield>'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_front_winter || 2.7) + '" id="cfg-tfw"></ha-textfield>'
      + '</div>'

      + '<div style="font-size: 13px; font-weight: 600; margin: 8px 0 4px; opacity: 0.7;">Hinterachse</div>'
      + '<div class="pressure-grid">'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_rear_summer || 2.5) + '" id="cfg-trs"></ha-textfield>'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_rear_winter || 2.7) + '" id="cfg-trw"></ha-textfield>'
      + '</div>'
      + '</div>'

      // Farbskala Erklärung
      + '<div style="margin-top: 12px; font-size: 12px; opacity: 0.6; display: flex; gap: 12px; justify-content: center;">'
      + '<span><span style="color:#4caf50;">●</span> ±0.15 OK</span>'
      + '<span><span style="color:#ff9800;">●</span> ±0.3 Achtung</span>'
      + '<span><span style="color:#e53935;">●</span> &gt;0.3 Warnung</span>'
      + '</div>'

      + '</div>' // section

      + '</div>';

    var self = this;

    var prefix = this.shadowRoot.getElementById("cfg-prefix");
    if (prefix) prefix.addEventListener("input", function (ev) { self._valueChanged("entity_prefix", ev.target.value); });

    var btnSummer = this.shadowRoot.getElementById("btn-summer");
    if (btnSummer) btnSummer.addEventListener("click", function () { self._valueChanged("tire_season", "summer"); });

    var btnWinter = this.shadowRoot.getElementById("btn-winter");
    if (btnWinter) btnWinter.addEventListener("click", function () { self._valueChanged("tire_season", "winter"); });

    var cfgTfs = this.shadowRoot.getElementById("cfg-tfs");
    if (cfgTfs) cfgTfs.addEventListener("input", function (ev) { self._valueChanged("tire_front_summer", parseFloat(ev.target.value)); });

    var cfgTfw = this.shadowRoot.getElementById("cfg-tfw");
    if (cfgTfw) cfgTfw.addEventListener("input", function (ev) { self._valueChanged("tire_front_winter", parseFloat(ev.target.value)); });

    var cfgTrs = this.shadowRoot.getElementById("cfg-trs");
    if (cfgTrs) cfgTrs.addEventListener("input", function (ev) { self._valueChanged("tire_rear_summer", parseFloat(ev.target.value)); });

    var cfgTrw = this.shadowRoot.getElementById("cfg-trw");
    if (cfgTrw) cfgTrw.addEventListener("input", function (ev) { self._valueChanged("tire_rear_winter", parseFloat(ev.target.value)); });
  }

  _valueChanged(key, value) {
    if (!this._config) return;
    var newConfig = Object.assign({}, this._config);
    newConfig[key] = value;
    this._config = newConfig;
    var event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
customElements.define(CARD_NAME, ZeekrVehicleCard);
customElements.define(CARD_NAME + "-editor", ZeekrVehicleCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_NAME,
  name: "Zeekr Vehicle Card",
  description: "A custom card for Zeekr 7X vehicle overview",
  preview: true,
  documentationURL: "https://github.com/cnc-lasercraft/ha-zeekr-eu",
});

console.info(
  "%c ZEEKR-VEHICLE-CARD %c v" + CARD_VERSION + " ",
  "color: #fff; background: #1a237e; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #1a237e; background: #e8eaf6; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);
