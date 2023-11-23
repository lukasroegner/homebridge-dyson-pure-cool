# Change Log
All notable changes to this project will be documented in this file.

## [2.7.7] - 2023-11-23
### Changes
- Support for new revisions of PH03, PH04, TP07, TP09
- Support for BP02, BP03, BP04, BP06

## [2.7.6] - 2023-11-10
### Changes
- Fix for the credentials generator (thanks to matthewdavidlloyd for the PR)

## [2.7.5] - 2022-10-27
### Changes
- Added support for HP07 527K (thanks to iml885203 for the PR)

## [2.7.4] - 2022-08-19
### Changes
- Fixed the default name of the nightmode switch (thanks to merik-chen for the PR)

## [2.7.3] - 2022-03-13
### Changes
- Added a configuration option for the heating safety behavior introduced in `2.7.2`

## [2.7.2] - 2022-03-07
### Changes
- Due to safety concerns, heating is now switch off when devices are switched on, which is the same behavior as in the Dyson app 

## [2.7.1] - 2022-02-20
### Changes
- Fixed the sign in via mobile phone

## [2.7.0] - 2022-02-19
### Changes
- An additional humidity sensor can be exposed if the device is a humidifier

## [2.6.0] - 2022-02-19
### Changes
- Added options to prevent temperature, humidity and air quality from being exposed to HomeKit

## [2.5.1] - 2022-02-19
### Changes
- Fixed a bug where changing the device to automatic mode would not work with Siri

## [2.5.0] - 2022-02-19
### Changes
- Support for signing in via mobile phone (Mainland China)

## [2.4.4] - 2022-02-19
### Changes
- Enhanced air quality calculation and sensor readings (thanks to WLBQE for the PR)

## [2.4.3] - 2022-02-19
### Changes
- Corrected the temperature display unit when using Fahrenheit (thanks to WLBQE for the PR)
- Thermostat is now shown as off if the device is switched off (thanks to WLBQE for the PR)

## [2.4.2] - 2022-02-17
### Changes
- Added support for the TP09

## [2.4.1] - 2022-02-12
### Changes
- Added support for the PH03

## [2.4.0] - 2022-02-12
### Changes
- Added support for the HP07

## [2.3.5] - 2022-02-12
### Changes
- Added a new log output for the product type of a device, which makes it easier to add new products in the future

## [2.3.4] - 2022-02-12
### Changes
- Enhanced the handling for air quality data to prevent warnings in the logs (NaN)

## [2.3.2] - 2022-02-12
### Changes
- Enhanced the credentials generator, so that it gets clearer to enter a country code in the first step

## [2.3.1] - 2022-02-12
### Changes
- Fixed an issue with the config schema for the humidity offset

## [2.3.0] - 2022-02-12
### Changes
- Support for temperature and humidity offsets (thanks to Kentzo for the PR)

## [2.2.0] - 2022-02-12
### Changes
- Better support for Fahrenheit (thanks to mpiotrowski for the PR)
- Support for enabling the device in night mode (thanks to Kentzo for the PR)

## [2.1.0] - 2021-11-14
### Changes
- Added support for the PH04 (thanks to crzcrz for the PR)

## [2.0.3] - 2021-05-25
### Changes
- Fixed a bug in the credentials generator that occurred for users that also own Lightcycle devices

## [2.0.2] - 2021-05-24
### Changes
- Added debug output when using the credentials generator website

## [2.0.1] - 2021-05-19
### Changes
- If continuous monitoring is disabled, the plugin will no longer add warnings to the logs (due to invalid data)

## [2.0.0] - 2021-05-14
### Changes
- Breaking Change: the authentication flow (i.e. retrieving credentials from the Dyson API) is now a separate process on a website (that is hosted on the homebridge host)
- Breaking Change: the plugin won't communicate with the Dyson API automatically anymore. Credentials have to be retrieved via the credentials generator website

## [1.8.8] - 2021-05-14
### Changes
- Increased the maximum temperature for heating devices to 38°C due to a bug when setting the temperature in Fahrenheit (thanks to wawoodwa for the PR)
- Added support for the TP07 (thanks to coraxx for the PR)
- Added support for the HP09 (thanks to clarenceji for the PR)

## [1.8.7] - 2021-02-13
### Changes
- Fixed a bug due to Dyson changing their API (thanks to KibosJ for pointing at the solution)

## [1.8.6] - 2021-01-29
### Changes
- Fixed a bug due to Dyson changing their API (special thanks to jasonrig for the solution)

## [1.8.5] - 2021-01-20
### Changes
- Enhanced the wording of error messages

## [1.8.4] - 2021-01-20
### Changes
- Added an option to hide heating controls on HP02/HP04/HP06

## [1.8.3] - 2021-01-20
### Changes
- Added the PH02, HP06 and TP06 to the list of supported devices (has already been supported)

## [1.8.2] - 2021-01-14
### Changes
- Fixed a bug due to Dyson changing their API (special thanks to brian-su for the solution)

## [1.8.1] - 2020-10-21
### Changes
- Fixed a bug that occurred when using credentials with devices that have non-ASCII characters in the name

## [1.8.0] - 2020-09-27
### Changes
- Added a new option to enable oscillation when the device is activated

## [1.7.12] - 2020-08-15
### Changes
- Fixed the sample country code for GB

## [1.7.11] - 2020-07-14
### Changes
- Changed the default names for Jet Focus, Night Mode and Continuous Monitoring (added the device name)

## [1.7.10] - 2020-07-04
### Changes
- Added a new option to expose a switch for continous monitoring

## [1.7.9] - 2020-07-01
### Changes
- Added a new option to expose the full humidity range to HomeKit instead of the allowed range (PH01)

## [1.7.8] - 2020-05-16
### Changes
- Fixed a bug that prevented turning on the humidifier (PH01)

## [1.7.7] - 2020-05-15
### Changes
- Added a single sensor accessory mode

## [1.7.6] - 2020-05-15
### Changes
- Fixed a bug that occurred when enableAutoModeWhenActivating was set to true and rotation speed changed in the Home app

## [1.7.5] - 2020-05-10
### Changes
- Added a single accessory mode

## [1.7.4] - 2020-05-03
### Changes
- Enhanced checks for issues in the stored credentials when multiple devices are configured

## [1.7.3] - 2020-05-03
### Changes
- Finished implementtion for support of the Pure Cool+Humidify (PH01)

## [1.7.2] - 2020-05-01
### Changes
- Initial support for Pure Cool+Humidify (PH01)

## [1.7.1] - 2020-04-24
### Changes
- Added debug code for the Pure Cool+Humidify (PH01)

## [1.6.5] - 2020-04-25
### Changes
- Changed the temperature step to integers for HP02 and HP04

## [1.6.4] - 2020-04-24
### Changes
- Added Jet Focus support for HP02
- Enhanced error handling if the device is not named in the Dyson app

## [1.6.3] - 2020-04-24
### Changes
- Added a change log to the project
