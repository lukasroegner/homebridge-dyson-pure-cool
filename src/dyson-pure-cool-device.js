const productTypeInfo = require('./productTypeInfo');
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
function DysonPureCoolDevice(platform, name, serialNumber, productType, version, password, config) {
    const device = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;
    const temperatureStep = config.useFahrenheit ? 0.555 : 1;

    // Stores the information of the device that is used for shutdown
    device.serialNumber = serialNumber;
    device.platform = platform;
    device.mqttClient = null;

    // Logs the product type, so that new devices can be easily added in the future
    platform.log.info('Device with serial number ' + serialNumber + ': product type ' + productType);

    device.info = productTypeInfo(productType);
    device.info.name = name || 'Dyson'; // Makes sure that a name is set

    // Checks if heating is disabled by the configuration
    if (config.isHeatingDisabled) {
        device.info.hasHeating = false;
    }

    // Gets all accessories from the platform that match the serial number
    let unusedDeviceAccessories = platform.accessories.filter(function(a) { return a.context.serialNumber === serialNumber; });
    let newDeviceAccessories = [];
    let deviceAccessories = [];

    // Gets the air purifier accessory
    let airPurifierAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'AirPurifierAccessory'; });
    if (airPurifierAccessory) {
        unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(airPurifierAccessory), 1);
    } else {
        platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind AirPurifierAccessory.');
        airPurifierAccessory = new Accessory(device.info.name, UUIDGen.generate(serialNumber + 'AirPurifierAccessory'));
        airPurifierAccessory.context.serialNumber = serialNumber;
        airPurifierAccessory.context.kind = 'AirPurifierAccessory';
        newDeviceAccessories.push(airPurifierAccessory);
    }
    deviceAccessories.push(airPurifierAccessory);

    // Gets the air quality accessory
    let airQualityAccessory = null;
    if (config.isAirQualitySensorEnabled) {
        if (config.isSingleAccessoryModeEnabled) {
            airQualityAccessory = airPurifierAccessory;
        } else {
            airQualityAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'AirQualityAccessory'; });
            if (airQualityAccessory) {
                unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(airQualityAccessory), 1);
            } else {
                platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind AirQualityAccessory.');
                airQualityAccessory = new Accessory(device.info.name + ' Air Quality', UUIDGen.generate(serialNumber + 'AirQualityAccessory'));
                airQualityAccessory.context.serialNumber = serialNumber;
                airQualityAccessory.context.kind = 'AirQualityAccessory';
                newDeviceAccessories.push(airQualityAccessory);
            }
            deviceAccessories.push(airQualityAccessory);
        }
    }

    // Gets the temperature accessory
    let temperatureAccessory = null;
    if (device.info.hasHeating || config.isTemperatureSensorEnabled) {
        if (config.isSingleAccessoryModeEnabled) {
            temperatureAccessory = airPurifierAccessory;
        } else if (!device.info.hasHeating && config.isAirQualitySensorEnabled && config.isSingleSensorAccessoryModeEnabled) {
            temperatureAccessory = airQualityAccessory;
        } else {
            temperatureAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'TemperatureAccessory'; });
            if (temperatureAccessory) {
                unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(temperatureAccessory), 1);
            } else {
                platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind TemperatureAccessory.');
                temperatureAccessory = new Accessory(device.info.name + ' Temperature', UUIDGen.generate(serialNumber + 'TemperatureAccessory'));
                temperatureAccessory.context.serialNumber = serialNumber;
                temperatureAccessory.context.kind = 'TemperatureAccessory';
                newDeviceAccessories.push(temperatureAccessory);
            }
            deviceAccessories.push(temperatureAccessory);
        }
    }

    // Gets the humidity accessory
    let humidityAccessory = null;
    if (device.info.hasHumidifier || config.isHumiditySensorEnabled) {
        if (config.isSingleAccessoryModeEnabled) {
            humidityAccessory = airPurifierAccessory;
        } else if (!device.info.hasHumidifier && config.isAirQualitySensorEnabled && config.isSingleSensorAccessoryModeEnabled) {
            humidityAccessory = airQualityAccessory;
        } else {
            humidityAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'HumidityAccessory'; });
            if (humidityAccessory) {
                unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(humidityAccessory), 1);
            } else {
                platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind HumidityAccessory.');
                humidityAccessory = new Accessory(device.info.name + ' Humidity', UUIDGen.generate(serialNumber + 'HumidityAccessory'));
                humidityAccessory.context.serialNumber = serialNumber;
                humidityAccessory.context.kind = 'HumidityAccessory';
                newDeviceAccessories.push(humidityAccessory);
            }
            deviceAccessories.push(humidityAccessory);
        }
    }

    // Gets the switch accessory
    let switchAccessory = null;
    if (config.isAutoModeEnabled || config.isNightModeEnabled || config.isContinuousMonitoringEnabled || (config.isJetFocusEnabled && device.info.hasJetFocus)) {
        if (config.isSingleAccessoryModeEnabled) {
            switchAccessory = airPurifierAccessory;
        } else {
            switchAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'SwitchAccessory'; });
            if (switchAccessory) {
                unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(switchAccessory), 1);
            } else {
                platform.log.info('Adding new accessory with serial number ' + serialNumber + ' and kind SwitchAccessory.');
                switchAccessory = new Accessory(device.info.name + ' Settings', UUIDGen.generate(serialNumber + 'SwitchAccessory'));
                switchAccessory.context.serialNumber = serialNumber;
                switchAccessory.context.kind = 'SwitchAccessory';
                newDeviceAccessories.push(switchAccessory);
            }
            deviceAccessories.push(switchAccessory);
        }
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
            .setCharacteristic(Characteristic.Model, device.info.model)
            .setCharacteristic(Characteristic.SerialNumber, serialNumber)
            .setCharacteristic(Characteristic.FirmwareRevision, version)
            .setCharacteristic(Characteristic.HardwareRevision, device.info.hardwareRevision);
    }

    // Updates the air purifier
    let airPurifierService = airPurifierAccessory.getService(Service.AirPurifier);
    if (!airPurifierService) {
        airPurifierService = airPurifierAccessory.addService(Service.AirPurifier);
    }

    // Updates the filter life level unit
    airPurifierService
        .getCharacteristic(Characteristic.FilterLifeLevel)
        .setProps({
            unit: "percentage"
        });

    // Updates the rotation speed steps
    airPurifierService
        .getCharacteristic(Characteristic.RotationSpeed)
        .setProps({
            minStep: 10,
            minValue: 0,
            maxValue: 100
        });

    // Updates the temperature service
    let temperatureService = null;
    if (!temperatureAccessory) {
        if (!config.isTemperatureIgnored) {
            temperatureService = airPurifierService;
        }
    } else {
        if (device.info.hasHeating) {

            // Uses a thermostat service
            temperatureService = temperatureAccessory.getService(Service.Thermostat);
            if (!temperatureService) {
                temperatureService = temperatureAccessory.addService(Service.Thermostat);
            }

            // Disables cooling
            temperatureService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setProps({
                maxValue: 1,
                minValue: 0,
                validValues: [0, 1]
            });
            temperatureService.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({
                maxValue: 1,
                minValue: 0,
                validValues: [0, 1]
            });

            // Updates the target temperature for heating
            temperatureService.getCharacteristic(Characteristic.TargetTemperature).setProps({
                maxValue: 38,
                minValue: 0,
                minStep: temperatureStep,
                unit: 'celsius'
            });

            // Properly set the temperature display unit
            temperatureService.updateCharacteristic(Characteristic.TemperatureDisplayUnits, config.useFahrenheit ? 1 : 0);
        } else {

            // Uses a temperature sensor
            temperatureService = temperatureAccessory.getService(Service.TemperatureSensor);
            if (!temperatureService) {
                temperatureService = temperatureAccessory.addService(Service.TemperatureSensor);
            }
        }
    }

    // Updates the temperature steps
    if (temperatureService) {
        temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -50,
                maxValue: 100,
                unit: 'celsius'
            });
    }

    // Updates the humidity sensor
    let humidifierService = null;
    let humidityService = null;
    if (!humidityAccessory) {
        if (!config.isHumidityIgnored) {
            humidityService = airPurifierService;
        }
    } else {
        if (device.info.hasHumidifier) {

            // Uses a humidifier service
            humidifierService = humidityAccessory.getService(Service.HumidifierDehumidifier);
            if (!humidifierService) {
                humidifierService = humidityAccessory.addService(Service.HumidifierDehumidifier);
            }

            // Disables dehumidifying
            humidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState).setProps({
                maxValue: 2,
                minValue: 0,
                validValues: [0, 1, 2]
            });
            humidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState).setProps({
                maxValue: 1,
                minValue: 0,
                validValues: [0, 1]
            });

            // Updates the humidity threshold
            if (config.isFullRangeHumidity) {
                humidifierService.getCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold).setProps({
                    maxValue: 100,
                    minValue: 0,
                    minStep: 1
                });
            } else {
                humidifierService.getCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold).setProps({
                    maxValue: 70,
                    minValue: 30,
                    minStep: 10
                });
            }

            // Uses a humidify sensor if an additional sensor should be exposed
            if (config.isHumiditySensorEnabled) {
                humidityService = humidityAccessory.getService(Service.HumiditySensor);
                if (!humidityService) {
                    humidityService = humidityAccessory.addService(Service.HumiditySensor);
                }
            }
        } else {

            // Uses a humidify sensor
            humidityService = humidityAccessory.getService(Service.HumiditySensor);
            if (!humidityService) {
                humidityService = humidityAccessory.addService(Service.HumiditySensor);
            }
        }
    }

    // Updates the air quality sensor
    let airQualityService = null;
    if (!airQualityAccessory) {
        if (!config.isAirQualityIgnored) {
            airQualityService = airPurifierService;
        }
    } else {
        airQualityService = airQualityAccessory.getService(Service.AirQualitySensor);
        if (!airQualityService) {
            airQualityService = airQualityAccessory.addService(Service.AirQualitySensor);
        }
    }

    // Updates the night mode
    let nightModeSwitchService = null;
    if (switchAccessory && config.isNightModeEnabled) {
        nightModeSwitchService = switchAccessory.getServiceById(Service.Switch, 'NightMode');
        if (!nightModeSwitchService) {
            nightModeSwitchService = switchAccessory.addService(Service.Switch, device.info.name + ' Night Mode', 'NightMode');
        }
    }

    // Updates the auto mode
    let autoModeSwitchService = null;
    if (switchAccessory && config.isAutoModeEnabled) {
        autoModeSwitchService = switchAccessory.getServiceByUUIDAndSubType(Service.Switch, 'AutoMode');
        if (!autoModeSwitchService) {
            autoModeSwitchService = switchAccessory.addService(Service.Switch, device.info.name + ' Auto Mode', 'AutoMode');
        }
    }

    // Updates the jet focus mode
    let jetFocusSwitchService = null;
    if (switchAccessory && config.isJetFocusEnabled && device.info.hasJetFocus) {
        jetFocusSwitchService = switchAccessory.getServiceById(Service.Switch, 'JetFocus');
        if (!jetFocusSwitchService) {
            jetFocusSwitchService = switchAccessory.addService(Service.Switch, device.info.name + ' Jet Focus', 'JetFocus');
        }
    }

    // Updates the continuous monitoring
    let continuousMonitoringSwitchService = null;
    if (switchAccessory && config.isContinuousMonitoringEnabled) {
        continuousMonitoringSwitchService = switchAccessory.getServiceById(Service.Switch, 'ContinuousMonitoring');
        if (!continuousMonitoringSwitchService) {
            continuousMonitoringSwitchService = switchAccessory.addService(Service.Switch, device.info.name + ' Continuous Monitoring', 'ContinuousMonitoring');
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
    let updateIntervalHandle = null;
    device.mqttClient.on('connect', function () {
        platform.log.debug(serialNumber + ' - MQTT connection established.');

        // Subscribes to the status topic to receive updates
        device.mqttClient.subscribe(productType + '/' + serialNumber + '/status/current', function () {

            // Sends an initial request for the current state
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'REQUEST-CURRENT-STATE',
                time: new Date().toISOString()
            }));

            // Sets the interval for status updates
            updateIntervalHandle = setInterval(function() {
                try {
                    device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                        msg: 'REQUEST-CURRENT-STATE',
                        time: new Date().toISOString()
                    }));
                } catch (error) {
                    platform.log.debug(serialNumber + ' - MQTT interval error: ' + error);
                }
            }, device.platform.config.updateInterval);
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
        if (updateIntervalHandle) {
            clearInterval(updateIntervalHandle);
            updateIntervalHandle = null;
        }
    });
    device.mqttClient.on('offline', function () {
        platform.log.debug(serialNumber + ' - MQTT offline.');
        if (updateIntervalHandle) {
            clearInterval(updateIntervalHandle);
            updateIntervalHandle = null;
        }
    });
    device.mqttClient.on('end', function () {
        platform.log.debug(serialNumber + ' - MQTT ended.');
        if (updateIntervalHandle) {
            clearInterval(updateIntervalHandle);
            updateIntervalHandle = null;
        }
    });
    device.mqttClient.on('message', function (_, payload) {
        platform.log.debug(serialNumber + ' - MQTT message received: ' + payload.toString());

        // Parses the payload
        const content = JSON.parse(payload);

        // Updates the environmental data
        if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {

            // Sets the sensor data for temperature
            if (content['data']['tact'] !== 'OFF' && temperatureService) {
                temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, (Number.parseInt(content['data']['tact']) / 10.0) - 273.0 + (config.temperatureOffset || 0.0));
            }

            // Sets the sensor data for humidity
            if (content['data']['hact'] !== 'OFF' && humidityService) {
                humidityService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, Number.parseInt(content['data']['hact']) + (config.humidityOffset || 0.0));
            }
            if (content['data']['hact'] !== 'OFF' && humidifierService) {
                humidifierService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, Number.parseInt(content['data']['hact']) + (config.humidityOffset || 0.0));
            }

            // Parses the air quality sensor data
            if (airQualityService) {
                let pm25 = 0;
                let pm10 = 0;
                let va10 = 0;
                let noxl = 0;
                let hcho = 0;
                let p = 0;
                let v = 0;
                if (device.info.hasAdvancedAirQualitySensors) {

                    // Checks whether continuous monitoring is disabled
                    if (content['data']['p25r'] === 'OFF') {
                        return;
                    }
                    if (content['data']['p10r'] === 'OFF') {
                        return;
                    }
                    if (content['data']['va10'] === 'OFF') {
                        return;
                    }
                    if (content['data']['noxl'] === 'OFF') {
                        return;
                    }

                    // per issue 292 removed -->     content['data']['p10r'] === 'INIT' ? 0 :     prior to Number.parseInt solved issue
                    pm25 = Number.parseInt(content['data']['p25r']);
                    pm10 = Number.parseInt(content['data']['p10r']);
                    va10 = Number.parseInt(content['data']['va10']);
                    noxl = Number.parseInt(content['data']['noxl']);

                    if (content['data']['hchr']) {
                        hcho = content['data']['hchr'] === 'INIT' ? 0 : Number.parseInt(content['data']['hchr']);
                    }

                    if (isNaN(pm25)) {
                        pm25 = 0;
                    }
                    if (isNaN(pm10)) {
                        pm10 = 0;
                    }
                    if (isNaN(va10)) {
                        va10 = 0;
                    }
                    if (isNaN(noxl)) {
                        noxl = 0;
                    }
                    if (isNaN(hcho)) {
                        hcho = 0;
                    }
                } else {

                    // Checks whether continuous monitoring is disabled
                    if (content['data']['pact'] === 'OFF') {
                        return;
                    }
                    if (content['data']['vact'] === 'OFF') {
                        return;
                    }

                    p = content['data']['pact'] === 'INIT' ? 0 : Number.parseInt(content['data']['pact']);
                    v = content['data']['vact'] === 'INIT' ? 0 : Number.parseInt(content['data']['vact']);

                    if (isNaN(p)) {
                        p = 0;
                    }
                    if (isNaN(v)) {
                        v = 0;
                    }
                }

                // Maps the values of the sensors to the relative values described in the app (1 - 5 => Good, Medium, Bad, Very Bad, Extremely Bad)
                const pm25Quality = pm25 <= 35 ? 1 : (pm25 <= 53 ? 2 : (pm25 <= 70 ? 3 : (pm25 <= 150 ? 4 : 5)));
                const pm10Quality = pm10 <= 50 ? 1 : (pm10 <= 75 ? 2 : (pm10 <= 100 ? 3 : (pm10 <= 350 ? 4 : 5)));

                // Maps the VOC values to a self-created scale (as described values in the app don't fit)
                const va10Quality = (va10 * 0.125) <= 3 ? 1 : ((va10 * 0.125) <= 6 ? 2 : ((va10 * 0.125) <= 8 ? 3 : 4));

                // Maps the NO2 value to a self-created scale
                const noxlQuality = noxl <= 30 ? 1 : (noxl <= 60 ? 2 : (noxl <= 80 ? 3 : (noxl <= 90 ? 4 : 5)));

                // Maps the HCHO value to a self-created scale
                const hchoQuality = hcho <= 99 ? 1 : (hcho <= 299 ? 2 : (hcho <= 499 ? 3 : 4));

                // Maps the values of the sensors to the relative values, these operations are copied from the newer devices as the app does not specify the correct values
                const pQuality = p <= 2 ? 1 : (p <= 4 ? 2 : (p <= 7 ? 3 : (p <= 9 ? 4 : 5)));
                const vQuality = (v * 0.125) <= 3 ? 1 : ((v * 0.125) <= 6 ? 2 : ((v * 0.125) <= 8 ? 3 : 4));

                // Sets the sensor data for air quality (the poorest sensor result wins)
                if (device.info.hasAdvancedAirQualitySensors) {
                    airQualityService.updateCharacteristic(Characteristic.AirQuality, Math.max(pm25Quality, pm10Quality, va10Quality, noxlQuality, hchoQuality));
                    airQualityService.updateCharacteristic(Characteristic.PM2_5Density, pm25)
                    airQualityService.updateCharacteristic(Characteristic.PM10Density, pm10)
                    airQualityService.updateCharacteristic(Characteristic.VOCDensity, va10)
                    airQualityService.updateCharacteristic(Characteristic.NitrogenDioxideDensity, noxl);
                } else {
                    airQualityService.updateCharacteristic(Characteristic.AirQuality, Math.max(pQuality, vQuality));
                }
            }

            return;
        }

        // Updates the state data
        if (content.msg === 'CURRENT-STATE') {

            // Sets the power state
            if (content['product-state']['fpwr']) {
                airPurifierService.updateCharacteristic(Characteristic.Active, content['product-state']['fpwr'] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
            }
            if (content['product-state']['fmod']) {
                airPurifierService.updateCharacteristic(Characteristic.Active, content['product-state']['fmod'] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
            }

            // Sets the heating mode and target temperature
            if (device.info.hasHeating) {
                if (content['product-state']['hmod']) {
                    const poweredOff = airPurifierService.getCharacteristic(Characteristic.Active).value === Characteristic.Active.INACTIVE;
                    temperatureService.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, (poweredOff || content['product-state']['hmod'] === 'OFF') ? Characteristic.CurrentHeatingCoolingState.OFF : Characteristic.CurrentHeatingCoolingState.HEAT);
                    temperatureService.updateCharacteristic(Characteristic.TargetHeatingCoolingState, (poweredOff || content['product-state']['hmod'] === 'OFF') ? Characteristic.TargetHeatingCoolingState.OFF : Characteristic.TargetHeatingCoolingState.HEAT);
                }
                if (content['product-state']['hmax']) {
                    temperatureService.updateCharacteristic(Characteristic.TargetTemperature, (Number.parseInt(content['product-state']['hmax']) / 10.0) - 273.0 + (config.temperatureOffset || 0.0));
                }
            }

            // Sets the humidifier mode and threshold
            if (device.info.hasHumidifier) {
                if (content['product-state']['hume']) {
                    humidifierService.updateCharacteristic(Characteristic.Active, content['product-state']['hume'] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
                }
                if (content['product-state']['hume'] && content['product-state']['msta']) {
                    humidifierService.updateCharacteristic(Characteristic.CurrentHumidifierDehumidifierState, content['product-state']['hume'] === 'OFF' ? Characteristic.CurrentHumidifierDehumidifierState.INACTIVE : (content['product-state']['msta'] === 'OFF' ? Characteristic.CurrentHumidifierDehumidifierState.IDLE : Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING));
                }
                if (content['product-state']['haut']) {
                    humidifierService.updateCharacteristic(Characteristic.TargetHumidifierDehumidifierState, content['product-state']['haut'] === 'OFF' ? Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER : Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER);
                }
                if (content['product-state']['humt']) {
                    humidifierService.updateCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold, Number.parseInt(content['product-state']['humt']) + (config.humidityOffset || 0.0));
                }
            }

            // Sets the operation mode
            if (content['product-state']['fpwr'] && content['product-state']['fnst'] && content['product-state']['auto']) {
                airPurifierService.updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fpwr'] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'] === 'OFF' ? Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR));
                airPurifierService.updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['auto'] === 'OFF' ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO);
            }
            if (content['product-state']['fmod'] && content['product-state']['fnst']) {
                airPurifierService.updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fmod'] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'] === 'OFF' ? Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR));
                airPurifierService.updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['fmod'] === 'AUTO' ? Characteristic.TargetAirPurifierState.AUTO : Characteristic.TargetAirPurifierState.MANUAL);
            }

            // Sets the rotation status
            if (device.info.hasOscillation) {
                airPurifierService.updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
            }

            // Sets the filter life
            if (content['product-state']['cflr'] && content['product-state']['hflr']) {
                const cflr = content['product-state']['cflr'] == "INV" ? 100 : Number.parseInt(content['product-state']['cflr']);
                const hflr = content['product-state']['hflr'] == "INV" ? 100 : Number.parseInt(content['product-state']['hflr']);
                airPurifierService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(cflr, hflr) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                airPurifierService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(cflr,hflr));
            }
            if (content['product-state']['filf']) {

                // Calculates the filter life, assuming 12 hours a day, 360 days
                const filterLife = Number.parseInt(content['product-state']['filf']) / (360 * 12);
                airPurifierService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.ceil(filterLife * 100) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                airPurifierService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.ceil(filterLife * 100));
            }

            // Sets the fan speed based on the auto setting
            if (content['product-state']['fnsp'] !== 'AUTO') {
                airPurifierService.updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp']) * 10);
            }

            // Sets the state of the night mode switch
            if (nightModeSwitchService) {
                nightModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['nmod'] !== 'OFF');
            }

            // Sets the state of the auto mode switch
            if (autoModeSwitchService) {
                if (content['product-state']['fmod']) {
                    autoModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fmod'] === 'AUTO');
                }
            }

            // Sets the state of the jet focus switch
            if (jetFocusSwitchService) {
                if (content['product-state']['fdir']) {
                    jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fdir'] !== 'OFF');
                }
                if (content['product-state']['ffoc']) {
                    jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['ffoc'] !== 'OFF');
                }
            }

            // Sets the state of the continuous monitoring switch
            if (continuousMonitoringSwitchService) {
                continuousMonitoringSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['rhtm'] !== 'OFF');
            }

            return;
        }

        // Starts a new request as the state should be updated
        if (content.msg === 'STATE-CHANGE') {

            // Sets the power state
            if (content['product-state']['fpwr']) {
                airPurifierService.updateCharacteristic(Characteristic.Active, content['product-state']['fpwr'][1] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
            }
            if (content['product-state']['fmod']) {
                airPurifierService.updateCharacteristic(Characteristic.Active, content['product-state']['fmod'][1] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
            }

            // Sets the heating mode and target temperature
            if (device.info.hasHeating) {
                if (content['product-state']['hmod']) {
                    const poweredOff = airPurifierService.getCharacteristic(Characteristic.Active).value === Characteristic.Active.INACTIVE;
                    temperatureService.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, (poweredOff || content['product-state']['hmod'][1] === 'OFF') ? Characteristic.CurrentHeatingCoolingState.OFF : Characteristic.CurrentHeatingCoolingState.HEAT);
                    temperatureService.updateCharacteristic(Characteristic.TargetHeatingCoolingState, (poweredOff || content['product-state']['hmod'][1] === 'OFF') ? Characteristic.TargetHeatingCoolingState.OFF : Characteristic.TargetHeatingCoolingState.HEAT);
                }
                if (content['product-state']['hmax']) {
                    temperatureService.updateCharacteristic(Characteristic.TargetTemperature, (Number.parseInt(content['product-state']['hmax'][1]) / 10.0) - 273.0 + (config.temperatureOffset || 0.0));
                }
            }

            // Sets the humidifier mode and threshold
            if (device.info.hasHumidifier) {
                if (content['product-state']['hume']) {
                    humidifierService.updateCharacteristic(Characteristic.Active, content['product-state']['hume'][1] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
                }
                if (content['product-state']['hume'] && content['product-state']['msta']) {
                    humidifierService.updateCharacteristic(Characteristic.CurrentHumidifierDehumidifierState, content['product-state']['hume'][1] === 'OFF' ? Characteristic.CurrentHumidifierDehumidifierState.INACTIVE : (content['product-state']['msta'][1] === 'OFF' ? Characteristic.CurrentHumidifierDehumidifierState.IDLE : Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING));
                }
                if (content['product-state']['haut']) {
                    humidifierService.updateCharacteristic(Characteristic.TargetHumidifierDehumidifierState, content['product-state']['haut'][1] === 'OFF' ? Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER : Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER);
                }
                if (content['product-state']['humt']) {
                    humidifierService.updateCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold, Number.parseInt(content['product-state']['humt'][1]) + (config.humidityOffset || 0.0));
                }
            }

            // Sets the operation mode
            if (content['product-state']['fpwr'] && content['product-state']['fnst'] && content['product-state']['auto']) {
                airPurifierService.updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fpwr'][1] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'][1] === 'OFF' ? Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR));
                airPurifierService.updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['auto'][1] === 'OFF' ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO);
            }
            if (content['product-state']['fmod'] && content['product-state']['fnst']) {
                airPurifierService.updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fmod'][1] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'][1] === 'OFF' ? Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR));
                airPurifierService.updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['fmod'][1] === 'AUTO' ? Characteristic.TargetAirPurifierState.AUTO : Characteristic.TargetAirPurifierState.MANUAL);
            }

            // Sets the rotation status
            if (device.info.hasOscillation) {
                airPurifierService.updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'][1] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
            }

            // Sets the filter life
            if (content['product-state']['cflr'] && content['product-state']['hflr']) {
                const cflr = content['product-state']['cflr'][1] == "INV" ? 100 : Number.parseInt(content['product-state']['cflr'][1]);
                const hflr = content['product-state']['cflr'][1] == "INV" ? 100 : Number.parseInt(content['product-state']['cflr'][1]);
                airPurifierService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(cflr, hflr) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                airPurifierService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(cflr,hflr));
            }
            if (content['product-state']['filf']) {

                // Calculates the filter life, assuming 12 hours a day, 360 days
                const filterLife = Number.parseInt(content['product-state']['filf'][1]) / (360 * 12);
                airPurifierService.updateCharacteristic(Characteristic.FilterChangeIndication, Math.ceil(filterLife * 100) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER);
                airPurifierService.updateCharacteristic(Characteristic.FilterLifeLevel, Math.ceil(filterLife * 100));
            }

            // Sets the fan speed based on the auto setting
            if (content['product-state']['fnsp'][1] !== 'AUTO') {
                airPurifierService.updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp'][1]) * 10);
            }

            // Sets the state of the night mode switch
            if (nightModeSwitchService) {
                nightModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['nmod'][1] !== 'OFF');
            }

            // Sets the state of the auto mode switch
            if (autoModeSwitchService) {
                if (content['product-state']['fmod']) {
                    autoModeSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fmod'][1] === 'AUTO');
                }
            }

            // Sets the state of the jet focus switch
            if (jetFocusSwitchService) {
                if (content['product-state']['fdir']) {
                    jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['fdir'][1] !== 'OFF');
                }
                if (content['product-state']['ffoc']) {
                    jetFocusSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['ffoc'][1] !== 'OFF');
                }
            }

            // Sets the state of the continuous monitoring switch
            if (continuousMonitoringSwitchService) {
                continuousMonitoringSwitchService.updateCharacteristic(Characteristic.On, content['product-state']['rhtm'][1] !== 'OFF');
            }

            return;
        }
    });

    // Defines the timeout handle for fixing a bug in the Home app: whenever the air purifier is switched on, the TargetAirPurifierState is set to AUTO
    // This is prevented by delaying changes of the TargetAirPurifierState. If the Active characteristic is changed milliseconds after the TargetAirPurifierState,
    // it is detected and changing of the TargetAirPurifierState won't be executed
    let timeoutHandle = null;

    // Subscribes for changes of the active characteristic
    airPurifierService.getCharacteristic(Characteristic.Active).on('set', function (value, callback) {

        // Checks if a timeout has been set, which has to be cleared
        if (timeoutHandle) {
            platform.log.info(serialNumber + ' - set Active to ' + value + ': setting TargetAirPurifierState cancelled');
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }

        // Checks if the device is already in the target mode
        if (airPurifierService.getCharacteristic(Characteristic.Active).value === value) {
            return callback(null);
        }

        // Gets the active mode based on the configuration
        let activeMode = config.enableAutoModeWhenActivating ? 'AUTO' : 'FAN';

        // Builds the command data, which contains the active state and (optionally) the oscillation and night modes
        let commandData = {
            fpwr: value === Characteristic.Active.INACTIVE ? 'OFF' : 'ON',
            fmod: value === Characteristic.Active.INACTIVE ? 'OFF' : activeMode
        };
        if (config.enableOscillationWhenActivating && device.info.hasOscillation) {
            commandData['oson'] = 'ON';
        }
        if (config.enableNightModeWhenActivating) {
            commandData['nmod'] = 'ON';
        }

        // The Dyson app disables heating when the device is turned on
        if (value === Characteristic.Active.ACTIVE && device.info.hasHeating && !config.isHeatingSafetyIgnored) {
            commandData['hmod'] = 'OFF';
        }

        // Executes the actual change of the active state
        platform.log.info(serialNumber + ' - set Active to ' + value + ': ' + JSON.stringify(commandData));
        device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            data: commandData
        }));
        callback(null);
    });

    // Subscribes for changes of the target state characteristic
    airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState).on('set', function (value, callback) {

        // Checks if AUTO mode can be enabled when activating the device
        if (config.enableAutoModeWhenActivating || airPurifierService.getCharacteristic(Characteristic.Active).value) {

            // Directly sets the target state
            platform.log.info(serialNumber + ' - set TargetAirPurifierState to ' + value + ': ' + JSON.stringify({ auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON', fmod: value === Characteristic.TargetAirPurifierState.MANUAL ? 'FAN' : 'AUTO' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: {
                    auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON',
                    fmod: value === Characteristic.TargetAirPurifierState.MANUAL ? 'FAN' : 'AUTO'
                }
            }));
        } else {

            // Sets a timeout that can be cancelled by the Active characteristic handler
            platform.log.info(serialNumber + ' - set TargetAirPurifierState to ' + value + ' with delay');
            timeoutHandle = setTimeout(function () {
                platform.log.info(serialNumber + ' - set TargetAirPurifierState to ' + value + ': ' + JSON.stringify({ auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON', fmod: value === Characteristic.TargetAirPurifierState.MANUAL ? 'FAN' : 'AUTO' }));
                device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                    msg: 'STATE-SET',
                    time: new Date().toISOString(),
                    data: {
                        auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON',
                        fmod: value === Characteristic.TargetAirPurifierState.MANUAL ? 'FAN' : 'AUTO'
                    }
                }));
                timeoutHandle = null;
            }, 250);
        }
        callback(null);
    });

    // Subscribes for changes of the swing mode characteristic
    airPurifierService.getCharacteristic(Characteristic.SwingMode).on('set', function (value, callback) {
        platform.log.info(serialNumber + ' - set SwingMode to ' + value + ': ' + JSON.stringify({ oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }));
        device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            data: { oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }
        }));
        callback(null);
    });

    // Subscribes for changes of the rotation speed characteristic
    airPurifierService.getCharacteristic(Characteristic.RotationSpeed).on('set', function (value, callback) {
        platform.log.info(serialNumber + ' - set RotationSpeed to ' + value + ': ' + JSON.stringify({ fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }));
        device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            data: { fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }
        }));
        callback(null);
    });

    // Subscribes for changes of the heating mode and target temperature
    if (device.info.hasHeating) {
        temperatureService.getCharacteristic(Characteristic.TargetHeatingCoolingState).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set TargetHeatingCoolingState to ' + value + ': ' + JSON.stringify({ hmod: value === Characteristic.TargetHeatingCoolingState.OFF ? 'OFF' : 'HEAT' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { hmod: value === Characteristic.TargetHeatingCoolingState.OFF ? 'OFF' : 'HEAT' }
            }));
            callback(null);
        });
        temperatureService.getCharacteristic(Characteristic.TargetTemperature).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set TargetTemperature to ' + value + ': ' + JSON.stringify({ hmax: ('0000' + Math.round((value + 273.0) * 10.0).toString()).slice(-4) }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { hmax: ('0000' + Math.round((value + 273.0 - (config.temperatureOffset || 0.0)) * 10.0).toString()).slice(-4) }
            }));
            callback(null);
        });
    }

    // Subscribes for changes of the humidifier mode and threshold
    if (device.info.hasHumidifier) {
        humidifierService.getCharacteristic(Characteristic.Active).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set Humidifier Active to ' + value + ': ' + JSON.stringify({ hume: value === Characteristic.Active.ACTIVE ? 'HUMD' : 'OFF' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { hume: value === Characteristic.Active.ACTIVE ? 'HUMD' : 'OFF' }
            }));
            callback(null);
        });
        humidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set TargetHumidifierDehumidifierState to ' + value + ': ' + JSON.stringify({ haut: value === Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER ? 'ON' : 'OFF' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { haut: value === Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER ? 'ON' : 'OFF' }
            }));
            callback(null);
        });
        humidifierService.getCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set RelativeHumidityHumidifierThreshold to ' + value + ': ' + JSON.stringify({ humt: ('0000' + Math.min(70, Math.max(30, value)).toString()).slice(-4) }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { humt: ('0000' +  Math.min(70, Math.max(30, value - (config.humidityOffset || 0.0))).toString()).slice(-4) }
            }));
            callback(null);
        });
    }

    // Subscribes for changes of the night mode
    if (nightModeSwitchService) {
        nightModeSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {

            // Gets the active mode based on the configuration
            const activeMode = config.enableAutoModeWhenActivating ? 'AUTO' : 'FAN';

            // Builds the command data, if night mode is set to ON, the device has to be ON
            // If night mode is set to OFF, the device status is not changed
            let commandData = {};
            if (value) {
                if (airPurifierService.getCharacteristic(Characteristic.Active).value) {
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

    // Subscribes for changes of the auto mode
    if (autoModeSwitchService) {
        autoModeSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {

            // Builds the command data, if auto mode is set to ON, the device has to be ON
            // If auto mode is set to OFF, the device status is not changed
            let commandData = {};
            if (value) {
                commandData = { auto: 'ON', fmod: 'AUTO' }
                if (!airPurifierService.getCharacteristic(Characteristic.Active).value) {
                    commandData['fpwr'] = 'ON'
                }
            } else {
                commandData = { auto: 'OFF', fmod: 'FAN' };
            }

            // Sends the command
            platform.log.info(serialNumber + ' - set AutoMode to ' + value + ': ' + JSON.stringify(commandData));
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
            platform.log.info(serialNumber + ' - set JetFocus to ' + value + ': ' + JSON.stringify({ fdir: value ? 'ON' : 'OFF', ffoc: value ? 'ON' : 'OFF' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: { fdir: value ? 'ON' : 'OFF', ffoc: value ? 'ON' : 'OFF' }
            }));
            callback(null);
        });
    }

    // Subscribes for changes of the continuous monitoring
    if (continuousMonitoringSwitchService) {
        continuousMonitoringSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {
            platform.log.info(serialNumber + ' - set ContinuousMonitoring to ' + value + ': ' + JSON.stringify(value ? { rhtm: 'ON' } : { rhtm: 'OFF', fmod: 'OFF' }));
            device.mqttClient.publish(productType + '/' + serialNumber + '/command', JSON.stringify({
                msg: 'STATE-SET',
                time: new Date().toISOString(),
                data: value ? { rhtm: 'ON' } : { rhtm: 'OFF', fmod: 'OFF' }
            }));
            callback(null);
        });
    }
}

/**
 * Shuts down the device by ending the MQTT connection.
 */
DysonPureCoolDevice.prototype.shutdown = function () {
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
module.exports = DysonPureCoolDevice;
