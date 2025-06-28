# homebridge-dyson-pure-cool

## IMPORTANT: Breaking Changes in version 2.0.0

Dyson has introduced two factor authentication for Dyson accounts. Due to the complexity of the authentication flow, you **MUST** configure credentials for each device in the config.
To obtain the credentials, please follow the instructions below.

**IMPORTANT:** special characters in email addresses (like a plus sign) are not supported by Dyson and cause issues with this plugin and in the Dyson app.

## Supported Devices and Features

This project is a homebridge plugin for the Dyson air purifiers. Supported devices are:

- Dyson Pure Humidify+Cool (PH01)
- Dyson Pure Humidify+Cool Cryptomic (PH02)
- Dyson Pure Humidify+Cool (PH03)
- Dyson Pure Humidify+Cool Formaldehyde (PH04)
- Dyson Pure Cool Tower (TP04, TP07, TP09, TP11)
- Dyson Pure Cool Tower Cryptomic (TP06)
- Dyson Pure Cool Desk (DP04)
- Dyson Pure Hot+Cool (HP04)
- Dyson Pure Hot+Cool Cryptomic (HP06)
- Dyson Pure Hot+Cool Formaldehyde (HP07)
- Dyson Pure Hot+Cool Formaldehyde (HP09)
- Dyson Pure Cool Link Tower (TP02)
- Dyson Pure Cool Link Desk (DP01)
- Dyson Pure Hot+Cool Link (HP02)
- Dyson Purifier Big+Quiet Formaldehyde (BP02, BP03, BP04, BP06)

All your devices are exposed as air purifiers in HomeKit, with support (also in Apple Home app) for:
- On/off
- Auto/manual
- Fan speed
- Oscillation on/off (for supported devices)
- Relative humidity (for supported devices)
- Current temperature (for supported devices; in Apple Home app only supported as separate sensor)
- Air quality (incl. PM2.5, PM10, VOC and NO2 data for supported devices)

For heating devices, a thermostat is also exposes to HomeKit with support for:
- On/Off
- Target temperature

For humidifier devices, a humidifier is also exposes to HomeKit with support for:
- On/Off
- Auto/manual
- Target relative humidity

Optionally, the following switches are exposed:
- Night mode (on/off)
- Auto mode (on/off)
- Jet Focus (on/off; only for supported devices)
- Continuous Monitoring (on/off)

The plugin is optimized for usage of the Home app in iOS 13, e.g. the night mode and jet focus switches are combined in a separate settings accessory. This can be changed in the config.

## Installation

**Option 1:** Install the plugin via [config-ui-x](https://github.com/oznu/homebridge-config-ui-x):
- Search for Dyson on config-ui-x plugin screen
- Click Install on homebridge Dyson Pure Cool plugin
- Once installed you will be prompted to set the config
- Restart homebridge service and plugin should be loaded with accessories

**Option 2:** Install the plugin via npm:

```bash
npm install homebridge-dyson-pure-cool -g
```

## Retrieve Credentials

For each Dyson device that you want to use with this plugin, credentials have to be retrieved from the Dyson API.

**Step 1:** Configure the plugin (don't add devices to the devices array if you don't already have the credentials for them). If you're setting up the plugin for the first time, you can simply use the following configuration:

```json
{
    "platforms": [
        {
            "platform": "DysonPureCoolPlatform",
            "devices": [],
            "updateInterval": 60000,
            "credentialsGeneratorPort": 48000
        }
    ]
}
```

**Step 2:** Start homebridge

**Step 3:** Open a browser and navigate to `http://<IP-ADDRESS-OF-HOMEBRIDGE-HOST>:48000/` (where `<IP-ADDRESS-OF-HOMEBRIDGE-HOST>` is the IP address of the host your homebridge instance is running on).

**Step 4:** Follow the steps on the website to retrieve the credentials for all of the devices that are registered in your Dyson account.

**If you get a 401 or 400 error:** Try the following:

- Log out of any mobile apps
- Restart your homebridge server
- Try again

**If you don't get any page at all**:

- Make sure to allow the port in the firewall Rules
- For ufw try:
`sudo ufw allow 48000` (when you have a different port use it instead of 48000)

This method seems to work for most people, see [#196](https://github.com/lukasroegner/homebridge-dyson-pure-cool/issues/196) for instance.

**Step 5:** Now you can add the devices to the configuration (see below) and restart homebridge.

## Configuration

```json
{
    "platforms": [
        {
            "platform": "DysonPureCoolPlatform",
            "devices": [
                {
                    "ipAddress": "XXX.XXX.XXX.XXX",
                    "serialNumber": "XXX-EU-XXXXXXXX",
                    "credentials": "xxx...xxx",
                    "enableAutoModeWhenActivating": false,
                    "enableOscillationWhenActivating": false,
                    "enableNightModeWhenActivating": false,
                    "isNightModeEnabled": false,
                    "isJetFocusEnabled": false,
                    "isContinuousMonitoringEnabled": false,
                    "isTemperatureSensorEnabled": false,
                    "isTemperatureIgnored": false,
                    "temperatureOffset": 0,
                    "isHumiditySensorEnabled": false,
                    "isHumidityIgnored": false,
                    "humidityOffset": 0,
                    "isAirQualitySensorEnabled": false,
                    "isAirQualityIgnored": false,
                    "isSingleAccessoryModeEnabled": false,
                    "isFullRangeHumidity": false,
                    "isHeatingDisabled": false,
                    "isHeatingSafetyIgnored": false,
                    "useFahrenheit": false
                }
            ],
            "updateInterval": 60000,
            "credentialsGeneratorPort": 48000
        }
    ]
}
```

**devices**: Array of all your Dyson devices.

**ipAddress**: Local IP address of the device. Leave out leading zeros (e.g. 192.168.0.1 instead of 192.168.000.001).

**serialNumber**: Serial number of the device.

**credentials**: The credentials for connecting to the device. They can be retrieved via the credentials generator (website), see instructions above.

**enableAutoModeWhenActivating**: If set to `true`, the Auto mode is enabled when you activate the device in the Home app. Defaults to `false`.

**enableOscillationWhenActivating**: If set to `true`, oscillation is enabled when you activate the device. Defaults to `false`.

**enableNightModeWhenActivating**: If set to `true`, night mode is enabled when you activate the device. Defaults to `false`.

**isNightModeEnabled**: If set to `true`, a switch is exposed for the night mode. Defaults to `false`.

**isAutoModeEnabled**: If set to `true`, a switch is exposed for the auto mode. Defaults to `false`.

**isJetFocusEnabled**: If set to `true`, a switch is exposed for the jet focus. Only for supported devices. Defaults to `false`.

**isContinuousMonitoringEnabled**: If set to `true`, a switch is exposed for the continuous monitoring. Defaults to `false`.

**isTemperatureSensorEnabled**: If set to `true`, a separate temperature sensor is exposed. Only used for non-heating, supported devices. If set to `false`, the temperature is added as characteristic to the air purifier (does not show up in the Apple Home app). Defaults to `false`.

**isTemperatureIgnored**: If set to `true`, the temperature measurement is completely ignored and not exposed. Can only used for non-heating devices. Defaults to `false`.

**temperatureOffset**: Negatively or positively offset the value reported by the temperature sensor before exposing it to HomeKit. Provide the value in degree Celsius.

**isHumiditySensorEnabled**: If set to `true`, a separate humidity sensor is exposed. Only used for supported devices. If set to `false`, the humidity is added as characteristic to the air purifier (supported in the Apple Home app). Defaults to `false`.

**isHumidityIgnored**: If set to `true`, the humidity measurement is completely ignored and not exposed. Can only used for non-humidifier devices. Defaults to `false`.

**humidityOffset**: Negatively or positively offset the value reported by the humidity sensor before exposing it to HomeKit. Provide the value in degree Celsius.

**isAirQualitySensorEnabled**: If set to `true`, a separate air quality sensor is exposed. If set to `false`, the air quality is added as characteristic to the air purifier (supported in the Apple Home app). Defaults to `false`.

**isAirQualityIgnored**: If set to `true`, the air quality measurements are completely ignored and not exposed. Defaults to `false`.

**isSingleSensorAccessoryModeEnabled**: If set to `true`, all sensors are exposed to HomeKit in a single accessory instead of multiple accessories. Only has an effect if the previous settings for enabling sensors are set to `true`. Defaults to `false`.

**isSingleAccessoryModeEnabled**: If set to `true`, all services are exposed to HomeKit in a single accessory instead of multiple accessories. If set to `true`, the single sensor accessory mode has no effect. Use this mode if you are using a third-party HomeKit app and want all services grouped into a single accessory. Defaults to `false`.

**isFullRangeHumidity**: Only for humidifiers. If set to `true`, the range of the target humidity control will be from 0% to 100% instead of translating it to the allowed range (30% to 70%) of the Dyson. Defaults to `false`.

**isHeatingDisabled**: Only for heating devices. If set to `true`, the heating controls are not exposed to HomeKit. Defaults to `false`.

**isHeatingSafetyIgnored**: Only for heating devices. If set to `true`, this overrides the default safety feature to allow heat to be turned on along with the fan if the fan was heating when last turned off. By default, the heat is disabled when turning on the fan in the Dyson app.

**useFahrenheit**: If set to `true`, it will use Fahrenheit temperature scale in the Home app. This only affects _changing_ temperature (e.g. for heating devices). Defaults to `false`.

**updateInterval** (optional): The interval (in milliseconds) at which updates of the sensors are requested from the Dyson devices. Defaults to 60 seconds.

**credentialsGeneratorPort** (optional): The port number for the (credentials generator) website. Only change this setting in case of a port collision.

## Using Multiple Devices

When setting up multiple devices, it's very easy to get the serial number, IP address and credentials mismatched. This will result in silent failures and non-responsive devices. You can check if you've got this issue by enabled debug in your homebridge controller and reviewing the logs for authentication failures.

To avoid this situation, take special care to match the serial number of the unit in the Dyson app with the last six digits of the mac address found on the appliance and then double check your IP address matches. It's strongly recommended you setup a reserved IP address for the unit via your DHCP server so you can be certain the serial number matches the IP address.
