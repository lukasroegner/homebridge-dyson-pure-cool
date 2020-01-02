
const mqtt = require('mqtt');

/**
 * Represents a physical Dyson device.
 * @param platform The DysonPureCoolPlatform instance.
 * @param name The device information provided by the Dyson API.
 * @param serialNumber The device information provided by the Dyson API.
 * @param productType The device information provided by the Dyson API.
 * @param version The device information provided by the Dyson API.
 * @param password The device password used for MQTT connections.
 * @param config The device configuration.
 */
function DysonPureHotCoolDevice(platform, name, serialNumber, productType, version, password, config) {
    const device = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;

    // Stores the information of the device that is used for shutdown
    device.serialNumber = serialNumber;
    device.platform = platform;
    device.mqttClient = null;

    // Creates the device information from the API results
    let model = 'Pure Hot+Cool';
    let hardwareRevision = '';
    let hasJetFocus = false;
    let hasAdvancedAirQualitySensors = false;
    switch (productType) {
        case '527':
            model = 'Dyson Pure Hot+Cool';
            hardwareRevision = 'HP04';
            hasJetFocus = true;
            hasAdvancedAirQualitySensors = true;
            break;
        case '455':
            model = 'Dyson Pure Hot+Cool Link';
            hardwareRevision = 'HP02';
            break;
    }

    // Gets all accessories from the platform that match the serial number
    let unusedDeviceAccessories = platform.accessories.filter(function(a) { return a.context.serialNumber === serialNumber; });
    let newDeviceAccessories = [];
    let deviceAccessories = [];

    // Gets the thermostat accessory
    let thermostatAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'ThermostatAccessory'; });
    if (thermostatAccessory) {
        unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(thermostatAccessory), 1);
    } else {
        platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind ThermostatAccessory.');
        thermostatAccessory = new Accessory(name, UUIDGen.generate(serialNumber + 'ThermostatAccessory'));
        thermostatAccessory.context.serialNumber = serialNumber;
        thermostatAccessory.context.kind = 'ThermostatAccessory';
        newDeviceAccessories.push(thermostatAccessory);
    }
    deviceAccessories.push(thermostatAccessory);

    // Gets the humidity accessory
    let humidityAccessory = null;
    if (config.isHumiditySensorEnabled) {
        humidityAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'HumidityAccessory'; });
        if (humidityAccessory) {
            unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(humidityAccessory), 1);
        } else {
            platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind HumidityAccessory.');
            humidityAccessory = new Accessory(name + ' Humidity', UUIDGen.generate(serialNumber + 'HumidityAccessory'));
            humidityAccessory.context.serialNumber = serialNumber;
            humidityAccessory.context.kind = 'HumidityAccessory';
            newDeviceAccessories.push(humidityAccessory);
        }
        deviceAccessories.push(humidityAccessory);
    }

    // Gets the air quality accessory
    let airQualityAccessory = null;
    if (config.isAirQualitySensorEnabled) {
        airQualityAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'AirQualityAccessory'; });
        if (airQualityAccessory) {
            unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(airQualityAccessory), 1);
        } else {
            platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind AirQualityAccessory.');
            airQualityAccessory = new Accessory(name + ' Air Quality', UUIDGen.generate(serialNumber + 'AirQualityAccessory'));
            airQualityAccessory.context.serialNumber = serialNumber;
            airQualityAccessory.context.kind = 'AirQualityAccessory';
            newDeviceAccessories.push(airQualityAccessory);
        }
        deviceAccessories.push(airQualityAccessory);
    }

    // Gets the switch accessory
    let switchAccessory = null;
    if (config.isNightModeEnabled || (config.isJetFocusEnabled && hasJetFocus)) {
        switchAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'SwitchAccessory'; });
        if (switchAccessory) {
            unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(switchAccessory), 1);
        } else {
            platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind SwitchAccessory.');
            switchAccessory = new Accessory(name + ' Settings', UUIDGen.generate(serialNumber + 'SwitchAccessory'));
            switchAccessory.context.serialNumber = serialNumber;
            switchAccessory.context.kind = 'SwitchAccessory';
            newDeviceAccessories.push(switchAccessory);
        }
        deviceAccessories.push(switchAccessory);
    }

    // Registers the newly created accessories
    platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, newDeviceAccessories);

    // Removes all unused accessories
    for (let i = 0; i < unusedDeviceAccessories.length; i++) {
        const unusedDeviceAccessory = unusedDeviceAccessories[i];
        platform.log.info('Removing unused accessory with serial number ' + serialNumber + ' and kind ' + unusedDeviceAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedDeviceAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedDeviceAccessories);

    // Updates the accessory information
    for (let i = 0; i < deviceAccessories.length; i++) {
        const deviceAccessory = deviceAccessories[i];
        let accessoryInformationService = deviceAccessory.getService(Service.AccessoryInformation);
        if (!accessoryInformationService) {
            accessoryInformationService = deviceAccessory.addService(Service.AccessoryInformation);
        }
        accessoryInformationService
            .setCharacteristic(Characteristic.Manufacturer, 'Dyson')
            .setCharacteristic(Characteristic.Model, model)
            .setCharacteristic(Characteristic.SerialNumber, serialNumber)
            .setCharacteristic(Characteristic.FirmwareRevision, version)
            .setCharacteristic(Characteristic.HardwareRevision, hardwareRevision);
    }

    // Updates the thermostat service
    let thermostatService = thermostatAccessory.getServiceByUUIDAndSubType(Service.Thermostat);
    if (!thermostatService) {
        thermostatService = thermostatAccessory.addService(Service.Thermostat);
    }

    // Sets the target temperature range
    thermostatService.getCharacteristic(Characteristic.TargetTemperature).setProps({
        maxValue: 37,
        minValue: 0,
        minStep: 0.1
    });

    // Updates the filter life level unit
    thermostatService
        .getCharacteristic(Characteristic.FilterLifeLevel)
        .setProps({
            unit: Characteristic.Units.PERCENTAGE
        });

    // Updates the rotation speed steps
    thermostatService
        .getCharacteristic(Characteristic.RotationSpeed)
        .setProps({
            minStep: 10,
            minValue: 0,
            maxValue: 100
        });

    // Updates the humidity sensor
    let humidityService = null;
    if (!humidityAccessory) {
        humidityService = thermostatService;
    } else {
        humidityService = humidityAccessory.getService(Service.HumiditySensor);
        if (!humidityService) {
            humidityService = humidityAccessory.addService(Service.HumiditySensor);
        }
    }

    // Updates the air quality sensor
    let airQualityService = null;
    if (!airQualityAccessory) {
        airQualityService = thermostatService;
    } else {
        airQualityService = airQualityAccessory.getService(Service.AirQualitySensor);
        if (!airQualityService) {
            airQualityService = airQualityAccessory.addService(Service.AirQualitySensor);
        }
    }

    // Updates the night mode
    let nightModeSwitchService = null;
    if (switchAccessory && config.isNightModeEnabled) {
        nightModeSwitchService = switchAccessory.getServiceByUUIDAndSubType(Service.Switch, 'NightMode');
        if (!nightModeSwitchService) {
            nightModeSwitchService = switchAccessory.addService(Service.Switch, 'Night Mode', 'NightMode');
        }
    }

    // Updates the jet focus mode
    let jetFocusSwitchService = null;
    if (switchAccessory && config.isJetFocusEnabled && hasJetFocus) {
        jetFocusSwitchService = switchAccessory.getServiceByUUIDAndSubType(Service.Switch, 'JetFocus');
        if (!jetFocusSwitchService) {
            jetFocusSwitchService = switchAccessory.addService(Service.Switch, 'Jet Focus', 'JetFocus');
        }
    }

    // Initializes the MQTT client for local communication with the device
    device.mqttClient = mqtt.connect('mqtt://' + config.ipAddress, {
        username: serialNumber,
        password: password,
        protocolVersion: 3,
        protocolId: 'MQIsdp'
    });
    platform.log.debug(serialNumber + ' - MQTT connection requested for ' + config.ipAddress + '.');

    // Subscribes for events of the MQTT client
    device.mqttClient.on('connect', function () {
        platform.log.debug(serialNumber + ' - MQTT connection established.');

        // Subscribes to the status topic to receive updates
        device.mqttClient.subscribe(productType + '/' + serialNumber + '/status/current', function () {

            // Sends an initial request for the current state
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'REQUEST-CURRENT-STATE',
                time: new Date().toISOString()
            }));
        });
    });
    device.mqttClient.on('error', function (error) {
        platform.log.debug(serialNumber + ' - MQTT error: ' + error);
    });
    device.mqttClient.on('reconnect', function () {
        platform.log.debug(serialNumber + ' - MQTT reconnecting.');
    });
    device.mqttClient.on('close', function () {
        platform.log.debug(serialNumber + ' - MQTT disconnected.');
    });
    device.mqttClient.on('offline', function () {
        platform.log.debug(serialNumber + ' - MQTT offline.');
    });
    device.mqttClient.on('end', function () {
        platform.log.debug(serialNumber + ' - MQTT ended.');
    });
    device.mqttClient.on('message', function (_, payload) {
        platform.log.debug(serialNumber + ' - MQTT message received: ' + payload.toString());

        // Parses the payload
        const content = JSON.parse(payload);

        // Updates the environmental data
        if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {

            // Sets the sensor data for temperature
            if (content['data']['tact'] !== "OFF") {
                temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, (Number.parseInt(content['data']['tact']) / 10.0) - 273.0);
            }

            // Sets the sensor data for humidity
            if (content['data']['hact'] !== "OFF") {
                humidityService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, Number.parseInt(content['data']['hact']));
            }

            // Parses the air quality sensor data
            let pm25 = 0;
            let pm10 = 0;
            let va10 = 0;
            let noxl = 0;
            let p = 0;
            let v = 0;
            if (hasAdvancedAirQualitySensors) {
                pm25 = Number.parseInt(content['data']['pm25']);
                pm10 = Number.parseInt(content['data']['pm10']);
                va10 = Number.parseInt(content['data']['va10']);
                noxl = Number.parseInt(content['data']['noxl']);
            } else {
                p = Number.parseInt(content['data']['pact']);
                v = Number.parseInt(content['data']['vact']);
            }

            // Maps the values of the sensors to the relative values described in the app (1 - 5 => Good, Medium, Bad, Very Bad, Extremely Bad)
            const pm25Quality = pm25 <= 35 ? 1 : (pm25 <= 53 ? 2 : (pm25 <= 70 ? 3 : (pm25 <= 150 ? 4 : 5)));
            const pm10Quality = pm10 <= 50 ? 1 : (pm10 <= 75 ? 2 : (pm10 <= 100 ? 3 : (pm10 <= 350 ? 4 : 5)));

            // Maps the VOC values to a self-created scale (as described values in the app don't fit)
            const va10Quality = (va10 * 0.125) <= 3 ? 1 : ((va10 * 0.125) <= 6 ? 2 : ((va10 * 0.125) <= 8 ? 3 : 4));

            // NO2 seems to be ignored when calculating the overall air quality in the app
            const noxlQuality = 0;

            // Maps the values of the sensors to the relative values, these operations are copied from the newer devices as the app does not specify the correct values
            const pQuality = p <= 2 ? 1 : (p <= 4 ? 2 : (p <= 7 ? 3 : (p <= 9 ? 4 : 5)));
            const vQuality = (v * 0.125) <= 3 ? 1 : ((v * 0.125) <= 6 ? 2 : ((v * 0.125) <= 8 ? 3 : 4));

            // Sets the sensor data for air quality (the poorest sensor result wins)
            if (hasAdvancedAirQualitySensors) {
                airQualityService.updateCharacteristic(Characteristic.AirQuality, Math.max(pm25Quality, pm10Quality, va10Quality, noxlQuality));
                airQualityService.updateCharacteristic(Characteristic.PM2_5Density, pm25)
                airQualityService.updateCharacteristic(Characteristic.PM10Density, pm10)
                airQualityService.updateCharacteristic(Characteristic.VOCDensity, va10)
                airQualityService.updateCharacteristic(Characteristic.NitrogenDioxideDensity, noxl);
            } else {
                airQualityService.updateCharacteristic(Characteristic.AirQuality, Math.max(pQuality, vQuality));
            }

            return;
        }

        // Updates the state data
        if (content.msg === 'CURRENT-STATE') {

            // TODO: set target heating cooling state

            // Sets the rotation status
            thermostatService.updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);

            // Sets the filter life
            if (content['product-state']['cflr'] && content['product-state']['hflr']) {
                thermostatService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(Number.parseInt(content['product-state']['cflr']), Number.parseInt(content['product-state']['hflr'])) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                thermostatService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(Number.parseInt(content['product-state']['cflr']), Number.parseInt(content['product-state']['hflr'])));
            }
            if (content['product-state']['filf']) {

                // Calculates the filter life, assuming 12 hours a day, 360 days
                const filterLife = Number.parseInt(content['product-state']['filf']) / (360 * 12);
                thermostatService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.ceil(filterLife * 100) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                thermostatService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.ceil(filterLife * 100));
            }

            // Sets the fan speed based on the auto setting
            if (content['product-state']['fnsp'] !== 'AUTO') {
                thermostatService.updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp']) * 10);
            }

            // Sets the state of the night mode switch
            if (nightModeSwitchService) {
                nightModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['nmod'] !== 'OFF');
            }

            // Sets the state of the jet focus switch
            if (jetFocusSwitchService) {
                jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fdir'] !== 'OFF');
            }

            return;
        }

        // Starts a new request as the state should be updated
        if (content.msg === 'STATE-CHANGE') {

            // TODO: set target heating cooling state

            // Sets the rotation status
            thermostatService
                .updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'][1] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);

            // Sets the filter life
            if (content['product-state']['cflr'] && content['product-state']['hflr']) {
                thermostatService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(Number.parseInt(content['product-state']['cflr'][1]), Number.parseInt(content['product-state']['hflr'][1])) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                thermostatService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(Number.parseInt(content['product-state']['cflr'][1]), Number.parseInt(content['product-state']['hflr'][1])));
            }
            if (content['product-state']['filf']) {

                // Calculates the filter life, assuming 12 hours a day, 360 days
                const filterLife = Number.parseInt(content['product-state']['filf'][1]) / (360 * 12);
                thermostatService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.ceil(filterLife * 100) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                thermostatService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.ceil(filterLife * 100));
            }

            // Sets the fan speed based on the auto setting
            if (content['product-state']['fnsp'][1] !== 'AUTO') {
                thermostatService.updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp'][1]) * 10);
            }

            // Sets the state of the night mode switch
            if (nightModeSwitchService) {
                nightModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['nmod'][1] !== 'OFF');
            }

            // Sets the state of the jet focus switch
            if (jetFocusSwitchService) {
                jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fdir'][1] !== 'OFF');
            }

            return;
        }
    });

    // TODO: handle changes of heating cooling state

    // Subscribes for changes of the swing mode characteristic
    thermostatService.getCharacteristic(Characteristic.SwingMode).on('set', function (value, callback) {
        platform.log.info(serialNumber + ' - set SwingMode to ' + value + ': ' + JSON.stringify({ oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }));
        device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            data: { oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }
        }));
        callback(null);
    });

    // Subscribes for changes of the rotation speed characteristic
    thermostatService.getCharacteristic(Characteristic.RotationSpeed).on('set', function (value, callback) {
        platform.log.info(serialNumber + ' - set RotationSpeed to ' + value + ': ' + JSON.stringify({ fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }));
        device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            data: { fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }
        }));
        callback(null);
    });

    // Subscribes for changes of the night mode
    if (nightModeSwitchService) {
        nightModeSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {

            // Gets the active mode based on the configuration
            const activeMode = config.enableAutoModeWhenActivating ? 'AUTO' : 'FAN';

            // Builds the command data, if night mode is set to ON, the device has to be ON
            // If night mode is set to OFF, the device status is not changed
            let commandData = {};
            if (value) {
                if (thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).value) {
                    commandData = { nmod: 'ON' };
                } else {
                    commandData = { fpwr: 'ON', fmod: activeMode, nmod: 'ON' };
                }
            } else {
                commandData = { nmod: 'OFF' };
            }

            // Sends the command
            platform.log.info(serialNumber + ' - set NightMode to ' + value + ': ' + JSON.stringify(commandData));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: commandData
            }));
            callback(null);
        });
    }

    // Subscribes for changes of the jet focus
    if (jetFocusSwitchService) {
        jetFocusSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set JetFocus to ' + value + ': ' + JSON.stringify({ fdir: value ? 'ON' : 'OFF' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { fdir: value ? 'ON' : 'OFF' }
            }));
            callback(null);
        });
    }
}

/**
 * Shuts down the device by ending the MQTT connection.
 */
DysonPureHotCoolDevice.prototype.shutdown = function () {
    const device = this;

    // Ends the MQTT connection
    if (device.mqttClient) {
        device.mqttClient.end(true);
        device.platform.log.debug(device.serialNumber + ' - MQTT connection ended.');
    }
}

/**
 * Defines the export of the file.
 */
module.exports = DysonPureHotCoolDevice;
