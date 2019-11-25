
const DysonPureCoolPlatform = require('./src/dyson-pure-cool-platform');

/**
 * Defines the export of the platform module.
 * @param homebridge The homebridge object that contains all classes, objects and functions for communicating with HomeKit.
 */
module.exports = function (homebridge) {
    homebridge.registerPlatform('homebridge-dyson-pure-cool', 'DysonPureCoolPlatform', DysonPureCoolPlatform, true);
}
