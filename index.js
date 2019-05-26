
const request = require('request');
const crypto = require('crypto');
const mqtt = require('mqtt');

var homebridgeObj = null;
var pluginName = 'homebridge-dyson-pure-cool';
var platformName = 'DysonPureCoolPlatform';

/**
 * Defines the export of the platform module.
 * @param homebridge The homebridge object that contains all classes, objects and functions for communicating with HomeKit.
 */
module.exports = function (homebridge) {

  // Gets the classes required for implementation of the plugin
  homebridgeObj = homebridge;

  // Registers the dynamic Dyson Pure Cool platform, as the locks are read from the API and created dynamically
  homebridge.registerPlatform(pluginName, platformName, DysonPureCoolPlatform, true);
}

/**
 * Initializes a new platform instance for the Dyson Pure Cool plugin.
 * @param log The logging function.
 * @param config The configuration that is passed to the plugin (from the config.json file).
 * @param api The API instance of homebridge (may be null on older homebridge versions).
 */
function DysonPureCoolPlatform(log, config, api) {
  const platform = this;

  // Saves objects for functions
  platform.Accessory = homebridgeObj.platformAccessory;
  platform.Categories = homebridgeObj.hap.Accessory.Categories;
  platform.Service = homebridgeObj.hap.Service;
  platform.Characteristic = homebridgeObj.hap.Characteristic;
  platform.UUIDGen = homebridgeObj.hap.uuid;
  platform.hap = homebridgeObj.hap;
  platform.pluginName = pluginName;
  platform.platformName = platformName;

  // Registers the shutdown event
  homebridgeObj.on('shutdown', function() {
    platform.shutdown();
  });

  // Checks whether a configuration is provided, otherwise the plugin should not be initialized
  if (!config) {
    return;
  }

  // Defines the variables that are used throughout the platform
  platform.log = log;
  platform.config = config;
  platform.authorizationHeader = null;
  platform.devices = [];
  platform.accessories = [];
  platform.mqttClients = [];

  // Initializes the configuration
  platform.config.username = platform.config.username || null;
  platform.config.password = platform.config.password || null;
  platform.config.countryCode = platform.config.countryCode || 'US';
  platform.config.devices = platform.config.devices || [];
  platform.config.apiUri = 'https://api.cp.dyson.com';
  platform.config.supportedProductTypes = ['438', '520'];

  // Checks whether the API object is available
  if (!api) {
    log('Homebridge API not available, please update your homebridge version!');
    return;
  }

  // Saves the API object to register new locks later on
  log('Homebridge API available.');
  platform.api = api;

  // Subscribes to the event that is raised when homebridge finished loading cached accessories
  platform.api.on('didFinishLaunching', function () {
    platform.log('Cached accessories loaded.');

    // Initially gets the devices from the Dyson API
    platform.getDevicesFromApi(function() { });
  });
}

/**
 * Signs the user in with the credentials provided in the configuration.
 * @param callback The callback function that gets a boolean value indicating success or failure.
 */
DysonPureCoolPlatform.prototype.signIn = function (callback) {
  const platform = this;

  // Validates the configuration
  if (!platform.config.apiUri) {
    platform.log('No API URI provided.');
    return callback(false);
  }
  if (!platform.config.countryCode) {
    platform.log('No country code provided.');
    return false;
  }
  if (!platform.config.username || !platform.config.password) {
    platform.log('No username and/or password provided.');
    return false;
  }

  // Sends the login request to the API
  platform.log('Signing in.');
  platform.authorizationHeader = null;
  request({
    uri: platform.config.apiUri + '/v1/userregistration/authenticate?country=' + platform.config.countryCode,
    method: 'POST',
    json: {
      Email: platform.config.username,
      Password: platform.config.password
    },
    rejectUnauthorized: false
  }, function (error, response, body) {

    // Checks if the API returned a positive result
    if (error || response.statusCode != 200 || !body || !body.Account || !body.Password) {
      if (error) {
        platform.log('Error while signing in. Error: ' + error);
      } else if (response.statusCode != 200) {
        platform.log('Error while signing in. Status Code: ' + response.statusCode);
      } else if (!body || !body.Account || !body.Password) {
        platform.log('Error while signing in. Could not get Account/Password parameter from response: ' + JSON.stringify(body));
      }
      return callback(false);
    }

    // Creates the authorization header for further use
    platform.authorizationHeader = 'Basic ' + Buffer.from(body.Account + ':' + body.Password).toString('base64');
    platform.log('Signed in.');
    return callback(true);
  });
};

/**
 * Gets the devices of the user with the credentials provided in the configuration.
 * @param callback The callback function that gets a boolean value indicating success or failure.
 */
DysonPureCoolPlatform.prototype.getDevicesFromApi = function (callback) {
  const platform = this;

  // Checks if the user is signed in 
  if (!platform.authorizationHeader) {
    return platform.signIn(function (result) {
      if (result) {
        return platform.getDevicesFromApi(callback);
      } else {
        return callback(false);
      }
    });
  }

  // Sends a request to the API to get all devices of the user
  request({
    uri: platform.config.apiUri + '/v2/provisioningservice/manifest',
    method: 'GET',
    headers: {
      'Authorization': platform.authorizationHeader
    },
    json: true,
    rejectUnauthorized: false
  }, function (error, response, body) {

    // Checks if the API returned a positive result
    if (error || response.statusCode != 200 || !body) {
      if (error) {
        platform.log('Error while retrieving the devices from the API. Error: ' + error);
      } else if (response.statusCode != 200) {
        platform.log('Error while retrieving the devices from the API. Status Code: ' + response.statusCode);
      } else if (!body) {
        platform.log('Error while retrieving the devices from the API. Could not get devices from response: ' + JSON.stringify(body));
      }
      return callback(false);
    }

    // Stores the device information
    platform.devices = body;

    // Cycles through all existing homebridge accessory to remove the ones that do not exist in the Dyson account
    for (var i = 0; i < platform.accessories.length; i++) {

      // Checks if the device exists
      var deviceExists = false;
      for (var j = 0; j < platform.devices.length; j++) {
        if (platform.devices[j].Serial == platform.accessories[i].context.serialNumber) {
          deviceExists = true;
        }
      }

      // Removes the accessory
      if (!deviceExists) {
        platform.removeAccessory(platform.devices[j].Serial);
      }
    }

    // Cycles through all devices to add new accessories
    for (var i = 0; i < platform.devices.length; i++) {

      // Checks if an accessory already exists
      var accessoryExists = false;
      for (var j = 0; j < platform.accessories.length; j++) {
        if (platform.accessories[j].context.serialNumber == platform.devices[i].Serial) {
          accessoryExists = true;
        }
      }

      // Creates the new accessory
      if (!accessoryExists) {
        platform.addAccessory(platform.devices[i].Serial);
      }
    }

    // Returns a positive result
    platform.log('Got devices from the Dyson API.');
    return callback(true);
  });
}

/**
 * Adds a new accessory to the platform.
 * @param serialNumber The serial number for which the accessory is to be created.
 */
DysonPureCoolPlatform.prototype.addAccessory = function (serialNumber) {
  const platform = this;
  const { UUIDGen, Accessory } = platform;

  // Gets the corresponding devices object
  platform.log('Adding new accessory with serial number ' + serialNumber + '.');
  var device = null;
  for (var i = 0; i < platform.devices.length; i++) {
    if (platform.devices[i].Serial == serialNumber) {
      device = platform.devices[i];
    }
  }

  // Checks if the device has been found
  if (!device) {
    platform.log('Error while adding new accessory with serial number ' + serialNumber + ': not received from the Dyson API.');
    return;
  }

  // Checks if the device is supported by this plugin
  let isSupported = false;
  for (var i = 0; i < platform.config.supportedProductTypes.length; i++) {
    if (platform.config.supportedProductTypes[i] == device.ProductType) {
      isSupported = true;
    }
  }
  if (!isSupported) {
    platform.log('Accessory with serial number ' + serialNumber + ' not added, as it is not supported by this plugin.');
    return;
  }

  // Gets the corresponding IP address
  let configDevice = null;
  for (let i = 0; i < platform.config.devices.length; i++) {
    if (platform.config.devices[i].serialNumber == serialNumber) {
      configDevice = platform.config.devices[i];
      break;
    }
  }

  // Checks if the IP address has been found
  if (!configDevice) {
    platform.log('No IP address provided for device with ' + serialNumber + '.');
    return;
  }

  // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
  const key = Uint8Array.from(Array(32), (_, index) => index + 1);
  const initializationVector = new Uint8Array(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
  const decryptedPasswordString = decipher.update(device.LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
  const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
  const password = decryptedPasswordJson.apPasswordHash;

  // Creates the new accessory
  var accessory = new Accessory(device.Name, UUIDGen.generate(device.Serial));
  accessory.context.name = device.Name;
  accessory.context.serialNumber = serialNumber;
  accessory.context.productType = device.ProductType;
  accessory.context.version = device.Version;
  accessory.context.password = password;

  // configures the accessory
  platform.configureAccessory(accessory);

  // Adds the accessory
  platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, [accessory]);
  platform.log('Accessory for serial number ' + serialNumber + ' added.');
}  

/**
 * Configures a previously cached accessory.
 * @param accessory The cached accessory.
 */
DysonPureCoolPlatform.prototype.configureAccessory = function (accessory) {
  const platform = this;
  const { Characteristic, Service } = platform;

  platform.log('Configuring accessory with serial number ' + accessory.context.serialNumber + '.');

  // Gets the corresponding configuration
  let configDevice = null;
  for (let i = 0; i < platform.config.devices.length; i++) {
    if (platform.config.devices[i].serialNumber == accessory.context.serialNumber) {
      configDevice = platform.config.devices[i];
      break;
    }
  }

  // Checks if the configuration has been found
  if (!configDevice) {
    platform.log('No configuration provided for device with ' + accessory.context.serialNumber + '.');
    return;
  }

  // Updates the configuration
  accessory.context.ipAddress = configDevice.ipAddress;
  accessory.context.isNightModeEnabled = configDevice.isNightModeEnabled || false;
  accessory.context.isJetFocusEnabled = configDevice.isJetFocusEnabled || false;
  accessory.context.isTemperatureSensorEnabled = configDevice.isTemperatureSensorEnabled || false;
  accessory.context.isHumiditySensorEnabled = configDevice.isHumiditySensorEnabled || false;
  accessory.context.isAirQualitySensorEnabled = configDevice.isAirQualitySensorEnabled || false;

  // Creates the model name
  let model = 'Pure Cool';
  let hardwareRevision = '';
  switch (accessory.context.productType) {
    case '438':
      model = 'Dyson Pure Cool Tower';
      hardwareRevision = 'TP04';
      break;
    case '520':
      model = 'Dyson Pure Cool Desk';
      hardwareRevision = 'DP04';
      break;
  }

  // Updates the accessory information
  let accessoryInformationService = accessory.getService(Service.AccessoryInformation);
  if (!accessoryInformationService) {
    accessoryInformationService = accessory.addService(Service.AccessoryInformation);
  }
  accessoryInformationService
    .setCharacteristic(Characteristic.Manufacturer, 'Dyson')
    .setCharacteristic(Characteristic.Model, model)
    .setCharacteristic(Characteristic.SerialNumber, accessory.context.serialNumber)
    .setCharacteristic(Characteristic.FirmwareRevision, accessory.context.version)
    .setCharacteristic(Characteristic.HardwareRevision, hardwareRevision);

  // Updates the air purifier
  let airPurifierService = accessory.getService(Service.AirPurifier);
  if (!airPurifierService) {
    airPurifierService = accessory.addService(Service.AirPurifier);
  }
  airPurifierService
    .setCharacteristic(Characteristic.Active, Characteristic.Active.INACTIVE)
    .setCharacteristic(Characteristic.CurrentAirPurifierState, Characteristic.CurrentAirPurifierState.INACTIVE)
    .setCharacteristic(Characteristic.TargetAirPurifierState, Characteristic.TargetAirPurifierState.MANUAL)
    .setCharacteristic(Characteristic.SwingMode, Characteristic.SwingMode.SWING_DISABLED)
    .setCharacteristic(Characteristic.RotationSpeed, 10)
    .setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.FILTER_OK)
    .setCharacteristic(Characteristic.FilterLifeLevel, 100);

  // Updates the filter life level unit
  airPurifierService
    .getCharacteristic(Characteristic.FilterLifeLevel)
    .setProps({
      unit: Characteristic.Units.PERCENTAGE
    });

  // Updates the rotation speed steps
  airPurifierService
    .getCharacteristic(Characteristic.RotationSpeed)
    .setProps({
      minStep: 10,
      minValue: 10,
      maxValue: 100
    });

  // Updates the night mode
  let nightModeSwitchService = accessory.getServiceByUUIDAndSubType(Service.Switch, 'NightMode');
  if (accessory.context.isNightModeEnabled) {
    if (!nightModeSwitchService) {
      nightModeSwitchService = accessory.addService(Service.Switch, accessory.context.name + ' Night Mode', 'NightMode');
    }
    nightModeSwitchService
      .setCharacteristic(Characteristic.On, false);
  } else {
    if (nightModeSwitchService) {
      accessory.removeService(nightModeSwitchService);
      nightModeSwitchService = null;
    }
  }

  // Updates the jet focus
  let jetFocusSwitchService = accessory.getServiceByUUIDAndSubType(Service.Switch, 'JetFocus');
  if (accessory.context.isJetFocusEnabled) {
    if (!jetFocusSwitchService) {
      jetFocusSwitchService = accessory.addService(Service.Switch, accessory.context.name + ' Jet Focus', 'JetFocus');
    }
    jetFocusSwitchService
      .setCharacteristic(Characteristic.On, false);
  } else {
    if (jetFocusSwitchService) {
      accessory.removeService(jetFocusSwitchService);
      jetFocusSwitchService = null;
    }
  }

  // Updates the temperature sensor
  let temperatureSensorService = accessory.getServiceByUUIDAndSubType(Service.TemperatureSensor, 'Temperature');
  if (accessory.context.isTemperatureSensorEnabled) {
    if (!temperatureSensorService) {
      temperatureSensorService = accessory.addService(Service.TemperatureSensor, accessory.context.name + ' Temperature', 'Temperature');
    }
    temperatureSensorService
      .setCharacteristic(Characteristic.CurrentTemperature, 0);
    airPurifierService
      .removeCharacteristic(Characteristic.CurrentTemperature);

    // Updates the temperature steps
    temperatureSensorService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ 
        minValue: -50, 
        maxValue: 100, 
        unit: "celsius" 
      });
  } else {
    if (temperatureSensorService) {
      accessory.removeService(temperatureSensorService);
      temperatureSensorService = null;
    }
    airPurifierService
      .setCharacteristic(Characteristic.CurrentTemperature, 0);

    // Updates the temperature steps
    airPurifierService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ 
        minValue: -50, 
        maxValue: 100, 
        unit: "celsius" 
      });
  }

  // Updates the humidity sensor
  let humiditySensorService = accessory.getServiceByUUIDAndSubType(Service.HumiditySensor, 'Humidity');
  if (accessory.context.isSeparateHumiditySensorEnabled) {
    if (!humiditySensorService) {
      humiditySensorService = accessory.addService(Service.HumiditySensor, accessory.context.name + ' Humidity', 'Humidity');
    }
    humiditySensorService
      .setCharacteristic(Characteristic.CurrentRelativeHumidity, 0);
    airPurifierService
      .removeCharacteristic(Characteristic.CurrentRelativeHumidity);
  } else {
    if (humiditySensorService) {
      accessory.removeService(humiditySensorService);
      humiditySensorService = null;
    }
    airPurifierService
      .setCharacteristic(Characteristic.CurrentRelativeHumidity, 0);
  }

  // Updates the air quality sensor
  let airQualitySensorService = accessory.getServiceByUUIDAndSubType(Service.AirQualitySensor, 'AirQuality');
  if (accessory.context.isSeparateAirQualitySensorEnabled) {
    if (!airQualitySensorService) {
      airQualitySensorService = accessory.addService(Service.AirQualitySensor, accessory.context.name + ' Air Quality', 'AirQuality');
    }
    airQualitySensorService
      .setCharacteristic(Characteristic.AirQuality, Characteristic.AirQuality.UNKNOWN)
      .setCharacteristic(Characteristic.PM2_5Density, 0)
      .setCharacteristic(Characteristic.PM10Density, 0)
      .setCharacteristic(Characteristic.VOCDensity, 0)
      .setCharacteristic(Characteristic.NitrogenDioxideDensity, 0);
    airPurifierService
      .removeCharacteristic(Characteristic.AirQuality)
      .removeCharacteristic(Characteristic.PM2_5Density)
      .removeCharacteristic(Characteristic.PM10Density)
      .removeCharacteristic(Characteristic.VOCDensity)
      .removeCharacteristic(Characteristic.NitrogenDioxideDensity);
  } else {
    if (airQualitySensorService) {
      accessory.removeService(airQualitySensorService);
      airQualitySensorService = null;
    }
    airPurifierService
      .setCharacteristic(Characteristic.AirQuality, Characteristic.AirQuality.UNKNOWN)
      .setCharacteristic(Characteristic.PM2_5Density, 0)
      .setCharacteristic(Characteristic.PM10Density, 0)
      .setCharacteristic(Characteristic.VOCDensity, 0)
      .setCharacteristic(Characteristic.NitrogenDioxideDensity, 0);
  }

  // Adds the accessory
  platform.log('Configured accessory for device with serial number ' + accessory.context.serialNumber + '.');
  platform.accessories.push(accessory);

  // Initializes the MQTT client for local communication with the device
  const mqttClient = mqtt.connect('mqtt://' + accessory.context.ipAddress, {
    username: accessory.context.serialNumber,
    password: accessory.context.password,
    protocolVersion: 3,
    protocolId: 'MQIsdp'
  });
  platform.mqttClients.push({
    serialNumber: accessory.context.serialNumber,
    mqttClient: mqttClient
  });
  platform.log(accessory.context.serialNumber + ' - MQTT connection requested for ' + accessory.context.ipAddress + '.');

  // Subscribes for events of the MQTT client
  mqttClient.on('connect', function() {
    platform.log(accessory.context.serialNumber + ' - MQTT connection established.');

    // Subscribes to the status topic to receive updates
    mqttClient.subscribe(accessory.context.productType + '/' + accessory.context.serialNumber + '/status/current', function() {

      // Sends an initial request for the current state
      mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({
        msg: 'REQUEST-CURRENT-STATE',
        time: new Date().toISOString()
      }));
    });
  });
  mqttClient.on('error', function(error) {
    platform.log(accessory.context.serialNumber + ' - MQTT error: ' + error);
  });
  mqttClient.on('reconnect', function() {
    platform.log(accessory.context.serialNumber + ' - MQTT reconnecting.');
  });
  mqttClient.on('close', function() {
    platform.log(accessory.context.serialNumber + ' - MQTT disconnected.');
  });
  mqttClient.on('offline', function() {
    platform.log(accessory.context.serialNumber + ' - MQTT offline.');
  });
  mqttClient.on('end', function() {
    platform.log(accessory.context.serialNumber + ' - MQTT ended.');
  });
  mqttClient.on('message', function(topic, payload) {
    platform.log(accessory.context.serialNumber + ' - MQTT message received: ' + payload.toString());

    // Parses the payload
    const content = JSON.parse(payload);

    // Updates the environmental data
    if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {
      
      // Sets the sensor data for temperature
      if (temperatureSensorService) {
        temperatureSensorService
          .updateCharacteristic(Characteristic.CurrentTemperature, (Number.parseInt(content['data']['tact']) / 10.0) - 273.0);
      } else {
        airPurifierService
          .updateCharacteristic(Characteristic.CurrentTemperature, (Number.parseInt(content['data']['tact']) / 10.0) - 273.0);
      }

      // Sets the sensor data for humidity
      if (humiditySensorService) {
        humiditySensorService
          .updateCharacteristic(Characteristic.CurrentRelativeHumidity, Number.parseInt(content['data']['hact']));
      } else {
        airPurifierService
          .updateCharacteristic(Characteristic.CurrentRelativeHumidity, Number.parseInt(content['data']['hact']));
      }

      // Parses the air quality sensor data
      const pm25 = Number.parseInt(content['data']['pm25']);
      const pm10 = Number.parseInt(content['data']['pm10']);
      const va10 = Number.parseInt(content['data']['va10']);
      const noxl = Number.parseInt(content['data']['noxl']);

      // Maps the values of the sensors to the relative values described in the app (1 - 5 => Good, Medium, Bad, Very Bad, Extremely Bad)
      const pm25Quality = pm25 <= 35 ? 1 : (pm25 <= 53 ? 2 : (pm25 <= 70 ? 3 : (pm25 <= 150 ? 4 : 5)));
      const pm10Quality = pm10 <= 50 ? 1 : (pm10 <= 75 ? 2 : (pm10 <= 100 ? 3 : (pm10 <= 350 ? 4 : 5)));

      // Maps the VOC values to a self-created scale (as described values in the app don't fit)
      const va10Quality = (va10 * 0.125) <= 3 ? 1 : ((va10 * 0.125) <= 6 ? 2 : ((va10 * 0.125) <= 8 ? 3 : 4));

      // NO2 seems to be ignored when calculating the overall air quality in the app
      const noxlQuality = 0;

      // Sets the sensor data for air quality (the poorest sensor result wins)
      if (airQualitySensorService) {
        airQualitySensorService
          .updateCharacteristic(Characteristic.AirQuality, Math.max(pm25Quality, pm10Quality, va10Quality, noxlQuality))
          .updateCharacteristic(Characteristic.PM2_5Density, pm25)
          .updateCharacteristic(Characteristic.PM10Density, pm10)
          .updateCharacteristic(Characteristic.VOCDensity, va10)
          .updateCharacteristic(Characteristic.NitrogenDioxideDensity, noxl);
      } else {
        airPurifierService
          .updateCharacteristic(Characteristic.AirQuality, Math.max(pm25Quality, pm10Quality, va10Quality, noxlQuality))
          .updateCharacteristic(Characteristic.PM2_5Density, pm25)
          .updateCharacteristic(Characteristic.PM10Density, pm10)
          .updateCharacteristic(Characteristic.VOCDensity, va10)
          .updateCharacteristic(Characteristic.NitrogenDioxideDensity, noxl);
      }

      return;
    }

    // Updates the state data
    if (content.msg === 'CURRENT-STATE') {

      // Sets the state of the air purifier
      airPurifierService
        .updateCharacteristic(Characteristic.Active, content['product-state']['fpwr'] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE)
        .updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fpwr'] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'] === 'OFF' ?  Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR))
        .updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['auto'] === 'OFF' ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO)
        .updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED)
        .updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(Number.parseInt(content['product-state']['cflr']), Number.parseInt(content['product-state']['hflr'])) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER)
        .updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(Number.parseInt(content['product-state']['cflr']), Number.parseInt(content['product-state']['hflr'])));
      
      // Sets the fan speed based on the auto setting
      if (content['product-state']['fnsp'] !== 'AUTO') {
        airPurifierService
        .updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp']) * 10);
      }
      
      // Sets the state of the night mode switch
      if (nightModeSwitchService) {
        nightModeSwitchService
          .updateCharacteristic(Characteristic.On, content['product-state']['nmod'] !== 'OFF');
      }

      // Sets the state of the jet focus switch
      if (jetFocusSwitchService) {
        jetFocusSwitchService
          .updateCharacteristic(Characteristic.On, content['product-state']['fdir'] !== 'OFF');
      }
      
      return;
    }

    // Starts a new request as the state should be updated
    if (content.msg === 'STATE-CHANGE') {

      // Sets the state of the air purifier
      airPurifierService
        .updateCharacteristic(Characteristic.Active, content['product-state']['fpwr'][1] === 'OFF' ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE)
        .updateCharacteristic(Characteristic.CurrentAirPurifierState, content['product-state']['fpwr'][1] === 'OFF' ? Characteristic.CurrentAirPurifierState.INACTIVE : (content['product-state']['fnst'][1] === 'OFF' ?  Characteristic.CurrentAirPurifierState.IDLE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR))
        .updateCharacteristic(Characteristic.TargetAirPurifierState, content['product-state']['auto'][1] === 'OFF' ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO)
        .updateCharacteristic(Characteristic.SwingMode, content['product-state']['oson'][1] === 'OFF' ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED)
        .updateCharacteristic(Characteristic.FilterChangeIndication, Math.min(Number.parseInt(content['product-state']['cflr'][1]), Number.parseInt(content['product-state']['hflr'][1])) >= 10 ? Characteristic.FilterChangeIndication.FILTER_OK : Characteristic.FilterChangeIndication.CHANGE_FILTER)
        .updateCharacteristic(Characteristic.FilterLifeLevel, Math.min(Number.parseInt(content['product-state']['cflr'][1]), Number.parseInt(content['product-state']['hflr'][1])));
      
      // Sets the fan speed based on the auto setting
      if (content['product-state']['fnsp'][1] !== 'AUTO') {
        airPurifierService
          .updateCharacteristic(Characteristic.RotationSpeed, Number.parseInt(content['product-state']['fnsp'][1]) * 10);
      }
      
      // Sets the state of the night mode switch
      if (nightModeSwitchService) {
        nightModeSwitchService
          .updateCharacteristic(Characteristic.On, content['product-state']['nmod'][1] !== 'OFF');
      }

      // Sets the state of the jet focus switch
      if (jetFocusSwitchService) {
        jetFocusSwitchService
          .updateCharacteristic(Characteristic.On, content['product-state']['fdir'][1] !== 'OFF');
      }

      return;
    }
  });

  // Subscribes for changes of the active characteristic
  airPurifierService
    .getCharacteristic(Characteristic.Active).on('set', function (value, callback) {
      platform.log(accessory.context.serialNumber + ' - set Active to ' + value + ': ' + JSON.stringify({ fpwr: value === Characteristic.Active.INACTIVE ? 'OFF' : 'ON' }));
      mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
        msg: 'STATE-SET', 
        time: new Date().toISOString(), 
        data: { fpwr: value === Characteristic.Active.INACTIVE ? 'OFF' : 'ON' }
      }));
      callback(null);
    });

  // Subscribes for changes of the target state characteristic
  airPurifierService
    .getCharacteristic(Characteristic.TargetAirPurifierState).on('set', function (value, callback) {
      platform.log(accessory.context.serialNumber + ' - set TargetAirPurifierState to ' + value + ': ' + JSON.stringify({ auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON' }));
      mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
        msg: 'STATE-SET', 
        time: new Date().toISOString(), 
        data: { auto: value === Characteristic.TargetAirPurifierState.MANUAL ? 'OFF' : 'ON' }
      }));
      callback(null);
    });

  // Subscribes for changes of the swing mode characteristic
  airPurifierService
    .getCharacteristic(Characteristic.SwingMode).on('set', function (value, callback) {
      platform.log(accessory.context.serialNumber + ' - set SwingMode to ' + value + ': ' + JSON.stringify({ oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }));
      mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
        msg: 'STATE-SET', 
        time: new Date().toISOString(), 
        data: { oson: value === Characteristic.SwingMode.SWING_DISABLED ? 'OFF' : 'ON' }
      }));
      callback(null);
    });

  // Subscribes for changes of the rotation speed characteristic
  airPurifierService
    .getCharacteristic(Characteristic.RotationSpeed).on('set', function (value, callback) {
      platform.log(accessory.context.serialNumber + ' - set RotationSpeed to ' + value + ': ' + JSON.stringify({ fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }));
      mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
        msg: 'STATE-SET', 
        time: new Date().toISOString(), 
        data: { fnsp: ('0000' + Math.round(value / 10.0).toString()).slice(-4) }
      }));
      callback(null);
    });

  // Subscribes for changes of the night mode
  if (nightModeSwitchService) {
    nightModeSwitchService
      .getCharacteristic(Characteristic.On).on('set', function (value, callback) {
        platform.log(accessory.context.serialNumber + ' - set NightMode to ' + value + ': ' + JSON.stringify({ nmod: value ? 'ON' : 'OFF' }));
        mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
          msg: 'STATE-SET', 
          time: new Date().toISOString(), 
          data: { nmod: value ? 'ON' : 'OFF' }
        }));
        callback(null);
      });
  }

  // Subscribes for changes of the jet focus
  if (jetFocusSwitchService) {
    jetFocusSwitchService
      .getCharacteristic(Characteristic.On).on('set', function (value, callback) {
        platform.log(accessory.context.serialNumber + ' - set JetFocus to ' + value + ': ' + JSON.stringify({ fdir: value ? 'ON' : 'OFF' }));
        mqttClient.publish(accessory.context.productType + '/' + accessory.context.serialNumber + '/command', JSON.stringify({ 
          msg: 'STATE-SET', 
          time: new Date().toISOString(), 
          data: { fdir: value ? 'ON' : 'OFF' }
        }));
        callback(null);
      });
  }
}

/**
 * Removes an accessory from the platform.
 * @param serialNumber The serial number of the device for which the accessory is to be removed.
 */
DysonPureCoolPlatform.prototype.removeAccessory = function (serialNumber) {
  const platform = this;

  // Initializes the lists for remaining and removed accessories
  platform.log('Removing accessory with serial number ' + serialNumber);
  var remainingAccessories = [];
  var removedAccessories = [];

  // Adds the accessories to the two lists
  for (var i = 0; i < platform.accessories.length; i++) {
    if (platform.accessories[i].context.serialNumber == serialNumber) {
      removedAccessories.push(platform.accessories[i]);
    } else {
      remainingAccessories.push(platform.accessories[i]);
    }
  }

  // Removes the accessories
  if (removedAccessories.length > 0) {
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, removedAccessories);
    platform.accessories = remainingAccessories;
    platform.log(removedAccessories.length + ' accessories removed.');
  }
}

/**
 * Closes all connections to MQTT clients.
 */
DysonPureCoolPlatform.prototype.shutdown = function () {
  const platform = this;

  // Ends all MQTT clients
  for (var i = 0; i < platform.mqttClients.length; i++) {
    platform.mqttClients[i].mqttClient.end(true);
    platform.log(platform.mqttClients[i].serialNumber + ' - MQTT connection ended.');
  }
}
