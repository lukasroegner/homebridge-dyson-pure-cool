
const DysonPureCoolDevice = require('./dyson-pure-cool-device');
const CredentialsGeneratorWebsite = require('./credentials-generator-website');

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
    platform.config.devices = platform.config.devices || [];
    platform.config.supportedProductTypes = ['358', '358E', '438', '438E', '455', '469', '475', '520', '527', '527E'];
    platform.config.updateInterval = platform.config.updateInterval || (60 * 1000);
    platform.config.credentialsGeneratorPort = platform.config.credentialsGeneratorPort || 48000;

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

        // Checks if there are credentials provided for all devices
        if (platform.config.devices.some(function(d) { return !d.credentials; })) {
            platform.log.info('Some devices are missing credentials. Please visit the credentials generator (see README) to retrieve them and add them to the configuration.');
            return ;
        }

        // Cycles over all devices from the config and tests whether the credentials can be parsed
        for (let i = 0; i < platform.config.devices.length; i++) {
            const config = platform.config.devices[i];

            // Decodes the API configuration that has been stored
            try {
                JSON.parse(Buffer.from(config.credentials.trim(), 'base64').toString('utf8'));
            } catch (e) {
                platform.log.warn('Invalid device credentials for device with serial number ' + config.serialNumber + '. Make sure you copied them correctly.');
                return;
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

        platform.log.info('Accessories initialized.');
    });

    // Starts the server for the credentials generator website
    platform.credentialsGeneratorWebsite = new CredentialsGeneratorWebsite(platform);
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
