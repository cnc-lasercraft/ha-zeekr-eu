# Zeekr EU Integration for Home Assistant

Custom Component for Home Assistant to integrate Zeekr vehicles (EU region) with your smart home.

## Features

- **Sensors**: Battery level, range, odometer, interior temperature, tire pressures, charging status, trip data
- **Binary Sensors**: Charging state, plug status, door/trunk/hood open, tire warnings
- **Climate**: Remote AC control with temperature setting
- **Locks**: Central locking, individual doors, trunk, charge lid
- **Covers**: Windows (all + individual), sunshade
- **Switches**: Defrost, charging start/stop, steering wheel heat, sentry mode
- **Selects**: Seat heating/ventilation per seat with level control
- **Numbers**: Charging limit, operation durations (AC, seat, steering wheel)
- **Device Tracker**: GPS location
- **Buttons**: Flash blinkers, force poll
- **API Stats**: Request/invoke counters (daily + total)

## Installation

### HACS (recommended)

1. Add this repository as a custom repository in HACS
2. Install "Zeekr EU Integration"
3. Restart Home Assistant
4. Go to Settings > Devices & Services > Add Integration > "Zeekr EU"

### Manual

1. Copy `custom_components/zeekr_eu/` to your Home Assistant `custom_components/` directory
2. Restart Home Assistant
3. Go to Settings > Devices & Services > Add Integration > "Zeekr EU"

## Vehicle Card (optional)

A Lovelace card showing a top-down view of the car with live door, window and
tyre state, plus charging and climate status.

**Install:** copy `www/zeekr-vehicle-card.js` into your Home Assistant
`config/www/` directory, then register it under
*Settings > Dashboards > Resources* as a **JavaScript module**:

```
/local/zeekr-vehicle-card.js
```

**Use:** add the card to a dashboard. No configuration is required — it finds
its entities through the integration's own registry entries, so it works
regardless of how your entity IDs happen to be named:

```yaml
type: custom:zeekr-vehicle-card
```

Optional settings:

| Option | Description |
|--------|-------------|
| `device_id` | Which vehicle to show. Only needed if you have more than one; the editor offers a picker. |
| `wallbox_power_entity` | A power sensor from your wallbox. The Zeekr cloud often reports 0 kW during AC charging even while the car is drawing current; if this sensor reads above 1 kW the card uses it instead. |
| `entities` | Pin individual entities by hand, e.g. `entities: {battery_level: sensor.my_own}`. Overrides automatic detection. |
| `tire_season`, `tire_front_summer`, `tire_rear_summer`, `tire_front_winter`, `tire_rear_winter` | Target tyre pressures used to colour the readings. Also editable in the card's visual editor. |

## Configuration

You will need the following credentials (obtained via reverse engineering of the Zeekr app):

| Parameter | Description |
|-----------|-------------|
| Username | Your Zeekr account email |
| Password | Your Zeekr account password |
| Country Code | Your country (e.g. CH, DE, AT) |
| HMAC Access Key | Region-specific API key |
| HMAC Secret Key | Region-specific API secret |
| Password Public Key | RSA public key for password encryption |
| Prod Secret | Production secret for request signing |
| VIN Key | AES key for VIN encryption |
| VIN IV | AES IV for VIN encryption |

## Supported Regions

EU, UAE, SEA, LA — with region-specific API endpoints and keys.

## Credits

API client based on [zeekr_ev_api](https://github.com/Fryyyyy/zeekr_homeassistant) by @Fryyyyy (MIT License).

## License

MIT
