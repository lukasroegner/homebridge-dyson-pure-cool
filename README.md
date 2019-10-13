# homebridge-dyson-pure-cool

This project is a homebridge plugin for the Dyson air purifiers. Supported devices are:

- 2018 Dyson Pure Cool Tower (TP04)
- 2018 Dyson Pure Cool Desk (DP04)
- Dyson Pure Cool Link Tower (TP02)

If your device is not supported, please open an issue, I'll try to add support for it.

The device information is downloaded from your Dyson account. You just have to provide the IP addresses of the devices in the local network.

All your devices are exposed as air purifiers in HomeKit, with support (also in Apple Home app) for:
- On/off
- Auto/manual
- Fan speed
- Oscillation on/off
- Relative humidity
- Current temperature (in Apple Home app only supported as separate sensor)
- Air quality (incl. PM2.5, PM10, VOC and NO2 data for 2018 devices)

Optionally, the following switches are exposed:
- Night mode (on/off)
- Jet Focus (on/off for 2018 devices)

The plugin is optimized for usage of the Home app in iOS 13, e.g. the night mode and jet focus switches are combined in a separate settings accessory.

## Installation

Install the plugin via npm:

```bash
npm install homebridge-dyson-pure-cool -g
```

## Configuration

```json
{
    "platforms": [
        {
            "platform": "DysonPureCoolPlatform",
            "username": "<YOUR-EMAIL-ADDRESS>",
            "password": "<YOUR-PASSWORD>",
            "countryCode": "<COUNTRY-CODE>",
            "devices": [
                {
                    "ipAddress": "XXX.XXX.XXX.XXX",
                    "serialNumber": "XXX-EU-XXXXXXXX",
                    "enableAutoModeWhenActivating": false,
                    "isNightModeEnabled": false,
                    "isJetFocusEnabled": false,
                    "isTemperatureSensorEnabled": false,
                    "isHumiditySensorEnabled": false,
                    "isAirQualitySensorEnabled": false
                }
            ]
        }
    ]
}
```

**username**: Your email address of the Dyson account you used to register the device with in the Dyson app.

**password**: Your password of the Dyson account you used to register the device with in the Dyson app.

**countryCode**: Two-letter ISO code of your country, e.g. US, DE, EN...

**devices**: Array of all your Dyson devices.

**ipAddress**: Local IP address of the device.

**serialNumber**: Serial number of the device.

**enableAutoModeWhenActivating**: If set to true, the Auto mode is enabled when you activate the device in the Home app.

**isNightModeEnabled**: If set to true, a switch is exposed for the night mode.

**isJetFocusEnabled**: If set to true, a switch is exposed for the jet focus. Only used for 2018 devices.

**isTemperatureSensorEnabled**: If set to true, a separate temperature sensor is exposed. If set to false, the temperature is added as characteristic to the air purifier (does not show up in the Apple Home app).

**isHumiditySensorEnabled**: If set to true, a separate humidity sensor is exposed. If set to false, the humidity is added as characteristic to the air purifier (supported in the Apple Home app).

**isAirQualitySensorEnabled**: If set to true, a separate air quality sensor is exposed. If set to false, the air quality is added as characteristic to the air purifier (supported in the Apple Home app).
