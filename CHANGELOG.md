# Change Log
All notable changes to this project will be documented in this file.

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
