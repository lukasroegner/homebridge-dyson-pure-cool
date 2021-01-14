
const request = require('request');
const crypto = require('crypto');

const DysonPureCoolDevice = require('./dyson-pure-cool-device');

/**
 * Initializes a new platform instance for the Dyson Pure Cool plugin.
 * @param log The logging function.
 * @param config The configuration that is passed to the plugin (from the config.json file).
 * @param api The API instance of homebridge (may be null on older homebridge versions).
 */
function DysonPureCoolPlatform(log, config, api) {
    const platform = this;

    // Saves objects for functions
    platform.Accessory = api.platformAccessory;
    platform.Categories = api.hap.Accessory.Categories;
    platform.Service = api.hap.Service;
    platform.Characteristic = api.hap.Characteristic;
    platform.UUIDGen = api.hap.uuid;
    platform.hap = api.hap;
    platform.pluginName = 'homebridge-dyson-pure-cool';
    platform.platformName = 'DysonPureCoolPlatform';

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

    // Registers the shutdown event
    api.on('shutdown', function () {

        // Shuts down all devices
        for (let i = 0; i < platform.devices.length; i++) {
            const device = platform.devices[i];
            device.shutdown();
        }
    });

    // Initializes the configuration
    platform.config.username = platform.config.username || null;
    platform.config.password = platform.config.password || null;
    platform.config.countryCode = platform.config.countryCode || 'US';
    platform.config.devices = platform.config.devices || [];
    platform.config.apiUri = 'https://appapi.cp.dyson.com';
    platform.config.supportedProductTypes = ['358', '438', '455', '469', '475', '520', '527'];
    platform.config.updateInterval = platform.config.updateInterval || (60 * 1000);

    // Checks whether the API object is available
    if (!api) {
        log.warn('Homebridge API not available, please update your homebridge version!');
        return;
    }

    // Saves the API object to register new devices later on
    log.debug('Homebridge API available.');
    platform.api = api;

    // Subscribes to the event that is raised when homebridge finished loading cached accessories
    platform.api.on('didFinishLaunching', function () {
        platform.log.debug('Cached accessories loaded.');

        // Checks if the devices array is properly formed
        if (!platform.config.devices || !Array.isArray(platform.config.devices)) {
            platform.log.warn('Check the devices property, it has to be a valid array.');
            return;
        }

        // Checks if devices can be loaded from config
        if (platform.getDevicesFromConfig()) {
            return;
        }

        // Initially gets the devices from the Dyson API
        const getDevicesFunction = function() {
            platform.getDevicesFromApi(function (success) {
                if (!success) {
                    if (platform.config.retrySignInInterval > 0) {
                        platform.log.warn('API could not be reached. Trying again soon...');
                        setTimeout(function() { getDevicesFunction(); }, platform.config.retrySignInInterval);
                    } else {
                        platform.log.warn('API could not be reached. Retry is disabled.');
                    }
                }
            });
        };
        getDevicesFunction();
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
        platform.log.warn('No API URI provided.');
        return callback(false);
    }
    if (!platform.config.countryCode) {
        platform.log.warn('No country code provided.');
        return false;
    }
    if (!platform.config.username || !platform.config.password) {
        platform.log.warn('No username and/or password provided.');
        return false;
    }

    // Sends the login request to the API
    platform.log.info('Signing in.');
    platform.authorizationHeader = null;
    request({
        uri: platform.config.apiUri + '/v1/userregistration/authenticate?country=' + platform.config.countryCode,
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        json: {
            Email: platform.config.username,
            Password: platform.config.password
        },
        rejectUnauthorized: false
    }, function (error, response, body) {

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.Account || !body.Password) {
            if (error) {
                platform.log.warn('Error while signing in. Error: ' + error);
            } else if (response.statusCode != 200) {
                platform.log.warn('Error while signing in. Status Code: ' + response.statusCode);
            } else if (!body || !body.Account || !body.Password) {
                platform.log.warn('Error while signing in. Could not get Account/Password parameter from response: ' + JSON.stringify(body));
            }
            return callback(false);
        }

        // Creates the authorization header for further use
        platform.authorizationHeader = 'Basic ' + Buffer.from(body.Account + ':' + body.Password).toString('base64');
        platform.log.info('Signed in.');
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
            'Authorization': platform.authorizationHeader,
            'User-Agent': 'Mozilla/5.0'
        },
        json: true,
        rejectUnauthorized: false
    }, function (error, response, body) {

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body) {
            if (error) {
                platform.log.warn('Error while retrieving the devices from the API. Error: ' + error);
            } else if (response.statusCode != 200) {
                platform.log.warn('Error while retrieving the devices from the API. Status Code: ' + response.statusCode);
            } else if (!body) {
                platform.log.warn('Error while retrieving the devices from the API. Could not get devices from response: ' + JSON.stringify(body));
            }
            return callback(false);
        }

        // Initializes a device for each device from the API
        for (let i = 0; i < body.length; i++) {
            const apiConfig = body[i];

            // Checks if the device is supported by this plugin
            if (!platform.config.supportedProductTypes.some(function(t) { return t === apiConfig.ProductType; })) {
                platform.log.info('Device with serial number ' + apiConfig.Serial + ' not added, as it is not supported by this plugin. Product type: ' + apiConfig.ProductType);
                continue;
            }

            // Gets the corresponding device configuration
            let config = platform.config.devices.find(function(d) { return d.serialNumber === apiConfig.Serial; });
            if (!config) {
                platform.log.warn('No IP address provided for device with serial number ' + apiConfig.Serial + '.');
                continue;
            }

            // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
            const key = Uint8Array.from(Array(32), (_, index) => index + 1);
            const initializationVector = new Uint8Array(16);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
            const decryptedPasswordString = decipher.update(apiConfig.LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
            const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
            const password = decryptedPasswordJson.apPasswordHash;

            // Creates the device instance and adds it to the list of all devices
            if (platform.config.supportedProductTypes.some(function(t) { return t === apiConfig.ProductType; })) {
                apiConfig.password = password;

                // Prints out the credentials hint
                platform.log.info('Credentials for device with serial number ' + apiConfig.Serial + ' are: ' + Buffer.from(JSON.stringify(apiConfig)).toString('base64'));

                // Creates the device
                platform.devices.push(new DysonPureCoolDevice(platform, apiConfig.Name, apiConfig.Serial, apiConfig.ProductType, apiConfig.Version, password, config));
            }
        }

        // Removes the accessories that are not bound to a device
        let unusedAccessories = platform.accessories.filter(function(a) { return !platform.devices.some(function(d) { return d.serialNumber === a.context.serialNumber; }); });
        for (let i = 0; i < unusedAccessories.length; i++) {
            const unusedAccessory = unusedAccessories[i];
            platform.log.info('Removing accessory with serial number ' + unusedAccessory.context.serialNumber + ' and kind ' + unusedAccessory.context.kind + '.');
            platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
        }
        platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);

        // Returns a positive result
        platform.log.info('Got devices from the Dyson API.');
        return callback(true);
    });
}

/**
 * Gets the devices of the user from the config.json.
 */
DysonPureCoolPlatform.prototype.getDevicesFromConfig = function () {
    const platform = this;

    // Checks if there are credentials for all devices
    if (platform.config.devices.some(function(d) { return !d.credentials; })) {
        platform.log.info('Device credentials not stored, asking Dyson API. If you want to prevent communication with the Dyson API, copy the credentials for each device from the coming log entries to the config.json.');
        return false;
    }

    // Cycles over all devices from the config and tests whether the credentials can be parsed
    for (let i = 0; i < platform.config.devices.length; i++) {
        const config = platform.config.devices[i];

        // Decodes the API configuration that has been stored
        try {
            JSON.parse(Buffer.from(config.credentials.trim(), 'base64').toString('utf8'));
        } catch (e) {
            platform.log.warn('Invalid device credentials for device with serial number ' + config.serialNumber + '. Make sure you copied it correctly.');
            return false;
        }
    }

    // Cycles over all devices from the config and creates them
    for (let i = 0; i < platform.config.devices.length; i++) {
        const config = platform.config.devices[i];

        // Decodes the API configuration that has been stored
        let apiConfig = JSON.parse(Buffer.from(config.credentials.trim(), 'base64').toString('utf8'));

        // Creates the device instance and adds it to the list of all devices
        platform.devices.push(new DysonPureCoolDevice(platform, apiConfig.Name, apiConfig.Serial, apiConfig.ProductType, apiConfig.Version, apiConfig.password, config));
    }

    // Removes the accessories that are not bound to a device
    let unusedAccessories = platform.accessories.filter(function(a) { return !platform.devices.some(function(d) { return d.serialNumber === a.context.serialNumber; }); });
    for (let i = 0; i < unusedAccessories.length; i++) {
        const unusedAccessory = unusedAccessories[i];
        platform.log.info('Removing accessory with serial number ' + unusedAccessory.context.serialNumber + ' and kind ' + unusedAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);

    // Returns a positive result
    platform.log.info('Got devices from config.');
    return true;
}

/**
 * Configures a previously cached accessory.
 * @param accessory The cached accessory.
 */
DysonPureCoolPlatform.prototype.configureAccessory = function (accessory) {
    const platform = this;

    // Adds the cached accessory to the list
    platform.accessories.push(accessory);
}

/**
 * Defines the export of the file.
 */
module.exports = DysonPureCoolPlatform;
