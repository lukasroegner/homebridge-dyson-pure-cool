# homebridge-dyson-pure-cool

This project is a homebridge plugin for the Dyson air purifiers. Supported devices are:

- Dyson Pure Humidify+Cool (PH01)
- 2018 Dyson Pure Cool Tower (TP04)
- 2018 Dyson Pure Cool Desk (DP04)
- 2018 Dyson Pure Hot+Cool (HP04)
- Dyson Pure Cool Link Tower (TP02)
- Dyson Pure Cool Link Desk (DP01)
- Dyson Pure Hot+Cool Link (HP02)

The device information is downloaded from your Dyson account. You just have to provide the IP addresses of the devices in the local network.

All your devices are exposed as air purifiers in HomeKit, with support (also in Apple Home app) for:
- On/off
- Auto/manual
- Fan speed
- Oscillation on/off
- Relative humidity
- Current temperature (in Apple Home app only supported as separate sensor)
- Air quality (incl. PM2.5, PM10, VOC and NO2 data for 2018 devices)

For heating devices, a thermostat is also exposes to HomeKit with support for:
- On/Off
- Target temperature

For humidifier devices, a humidifier is also exposes to HomeKit with support for:
- On/Off
- Auto/manual
- Target relative humidity

Optionally, the following switches are exposed:
- Night mode (on/off)
- Jet Focus (on/off for 2018 devices)
- Continuous Monitoring (on/off)

The plugin is optimized for usage of the Home app in iOS 13, e.g. the night mode and jet focus switches are combined in a separate settings accessory. This can be changed in the config.

## Installation

Option 1: Install the plugin via [config-ui-x](https://github.com/oznu/homebridge-config-ui-x):
- Search for Dyson on config-ui-x plugin screen
- Click Install on homebridge Dyson Pure Cool plugin
- Once installed you will be prompted to set the config
- Restart homebridge service and plugin should be loaded with accessories

Option 2: Install the plugin via npm:

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
                    "credentials": null,
                    "enableAutoModeWhenActivating": false,
                    "enableOscillationWhenActivating": false,
                    "isNightModeEnabled": false,
                    "isJetFocusEnabled": false,
                    "isContinuousMonitoringEnabled": false,
                    "isTemperatureSensorEnabled": false,
                    "isHumiditySensorEnabled": false,
                    "isAirQualitySensorEnabled": false,
                    "isSingleAccessoryModeEnabled": false,
                    "isFullRangeHumidity": false
                }
            ],
            "updateInterval": 60000,
            "retrySignInInterval": 0
        }
    ]
}
```

**username**: Your email address of the Dyson account you used to register the device with in the Dyson app.

**password**: Your password of the Dyson account you used to register the device with in the Dyson app.

**countryCode**: Two-letter ISO code of your country, e.g. US, DE, GB...

**devices**: Array of all your Dyson devices.

**ipAddress**: Local IP address of the device.

**serialNumber**: Serial number of the device.

**credentials** (optional): By default, the Dyson API is contacted to retrieve required information of the devices. However, you can also store credentials of each device in this property. If you do that for ALL of the devices, the Dyson API is no longer used, the connection can be directly established with the credentials. To retrieve the credentials, run the plugin without credentials. The credentials will then be printed out in the logs for each device.

**enableAutoModeWhenActivating**: If set to `true`, the Auto mode is enabled when you activate the device in the Home app. Defaults to `false`.

**enableOscillationWhenActivating**: If set to `true`, oscillation is enabled when you active the device. Defaults to `false`.

**isNightModeEnabled**: If set to `true`, a switch is exposed for the night mode. Defaults to `false`.

**isJetFocusEnabled**: If set to `true`, a switch is exposed for the jet focus. Only used for 2018 devices. Defaults to `false`.

**isContinuousMonitoringEnabled**: If set to `true`, a switch is exposed for the continuous monitoring. Defaults to `false`.

**isTemperatureSensorEnabled**: If set to `true`, a separate temperature sensor is exposed. Only used for non-heating devices. If set to `false`, the temperature is added as characteristic to the air purifier (does not show up in the Apple Home app). Defaults to `false`.

**isHumiditySensorEnabled**: If set to `true`, a separate humidity sensor is exposed. Only used for non-humidifier devices. If set to `false`, the humidity is added as characteristic to the air purifier (supported in the Apple Home app). Defaults to `false`.

**isAirQualitySensorEnabled**: If set to `true`, a separate air quality sensor is exposed. If set to `false`, the air quality is added as characteristic to the air purifier (supported in the Apple Home app). Defaults to `false`.

**isSingleSensorAccessoryModeEnabled**: If set to `true`, all sensors are exposed to HomeKit in a single accessory instead of multiple accessories. Only has an effect if the previous settings for enabling sensors are set to `true`. Defaults to `false`.

**isSingleAccessoryModeEnabled**: If set to `true`, all services are exposed to HomeKit in a single accessory instead of multiple accessories. If set to `true`, the single sensor accessory mode has no effect. Use this mode if you are using a third-party HomeKit app and want all services grouped into a single accessory. Defaults to `false`.

**isFullRangeHumidity**: Only for PH01. If set to `true`, the range of the target humidity control will be from 0% to 100% instead of translating it to the allowed range (30% to 70%) of the Dyson. Defaults to `false`.

**updateInterval** (optional): The interval (in milliseconds) at which updates of the sensors are requested from the Dyson devices. Defaults to 60 seconds.

**retrySignInInterval** (optional): The interval (in milliseconds) at which the plugin tries to communicate with the Dyson API at plugin startup. Set the value to `5000` (5 seconds) or more if you have internet connectivity issue. Defaults to `0`, which means retry is disabled.
