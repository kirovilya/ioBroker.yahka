"use strict";
var debug = require("debug");
var util = require("util");
var HAP = require("hap-nodejs");
var FFMPEG = require('./ffmpeg').FFMPEG;
exports.HAPService = HAP.Service;
exports.HAPCharacteristic = HAP.Characteristic;
var THomeKitBridge = (function () {
    function THomeKitBridge(config, FBridgeFactory, FLogger) {
        this.config = config;
        this.FBridgeFactory = FBridgeFactory;
        this.FLogger = FLogger;
        // need to count cameras for different username
        this.cameraCount = 0;
        this.init();
    }
    THomeKitBridge.prototype.init = function () {
        this.bridgeObject = this.setupBridge();
        if (this.config.devices)
            for (var _i = 0, _a = this.config.devices; _i < _a.length; _i++) {
                var device = _a[_i];
                if (device.enabled === false) {
                    continue;
                }
                this.FLogger.info("init Device " + JSON.stringify(device));
                var hapDevice = this.createDevice(device);
                if (hapDevice) {
                    try {
                        this.bridgeObject.addBridgedAccessory(hapDevice);
                    }
                    catch (e) {
                        this.FLogger.warn(e);
                        this.FLogger.warn('Error by adding: ' + JSON.stringify(device));
                    }
                }
            }
        this.bridgeObject.publish({
            username: this.config.username,
            port: this.config.port,
            pincode: this.config.pincode,
            category: 2
        });
    };
    THomeKitBridge.prototype.setupBridge = function () {
        var _this = this;
        var hapBridge = new HAP.Bridge(this.config.name, HAP.uuid.generate(this.config.ident));
        hapBridge.getService(exports.HAPService.AccessoryInformation)
            .setCharacteristic(exports.HAPCharacteristic.Manufacturer, this.config.manufacturer || "not configured")
            .setCharacteristic(exports.HAPCharacteristic.Model, this.config.model || "not configured")
            .setCharacteristic(exports.HAPCharacteristic.SerialNumber, this.config.serial || "not configured");
        hapBridge.on('identify', function (paired, callback) {
            _this.FLogger.debug('Node Bridge identify:' + paired);
            callback();
        });
        return hapBridge;
    };
    THomeKitBridge.prototype.createDevice = function (device) {
        var _this = this;
        var deviceID = HAP.uuid.generate(this.config.ident + ':' + device.name);
        var hapDevice = new HAP.Accessory(device.name, deviceID);
        hapDevice.getService(exports.HAPService.AccessoryInformation)
            .setCharacteristic(exports.HAPCharacteristic.Manufacturer, device.manufacturer || 'not configured')
            .setCharacteristic(exports.HAPCharacteristic.Model, device.model || 'not configured')
            .setCharacteristic(exports.HAPCharacteristic.SerialNumber, device.serial || 'not configured');
        hapDevice.on('identify', function (paired, callback) {
            _this.FLogger.debug('device identify');
            callback();
        });
        _this.FLogger.info("create Device " + device.category);
        for (var _i = 0, _a = device.services; _i < _a.length; _i++) {
            var serviceConfig = _a[_i];
            this.initService(hapDevice, serviceConfig);
        }
        // if it's Camera - not return device
        if (device.category == 17) {
            return;
        } else {
            return hapDevice;
        }
    };
    THomeKitBridge.prototype.initCamera = function (hapDevice, deviceConfig) {
        var _this = this;
        var cameraConfig = {
            //"source": "-re -i rtsp://184.72.239.149/vod/mp4:BigBuckBunny_175k.mov",
            "source": "",
            "maxStreams": 2,
            "maxWidth": 640,
            "maxHeight": 480,
            "maxFPS": 30
        };
        for (var _i = 0, _a = deviceConfig.characteristics; _i < _a.length; _i++) {
            var charactConfig = _a[_i];
            if (charactConfig.enabled) {
            	cameraConfig[charactConfig.name] = charactConfig.inOutParameters;
            }
            _this.FLogger.info(JSON.stringify(charactConfig));
        }
        _this.FLogger.info("Camera Config: " + JSON.stringify(cameraConfig));
        var cameraSource = new FFMPEG(_this, cameraConfig);
        hapDevice.configureCameraSource(cameraSource);
        //hapDevice.on('identify', function(paired, callback) {
        //    _this.FLogger.info("Node Camera identify");
        //    callback(); // success
        //});
        // Publish the camera on the local network.
        var publishData = {
            username: this.config.username.substr(0,15) + ('00'+_this.cameraCount.toString(16)).substr(-2),
            port: _this.config.port,
            pincode: _this.config.pincode,
            category: 17
        };
        _this.cameraCount += 1;
        _this.FLogger.info("Publish Camera: '" + hapDevice.displayName + "'" + JSON.stringify(publishData));
        hapDevice.publish(publishData, true);
    };
    THomeKitBridge.prototype.initService = function (hapDevice, serviceConfig) {
        if (!(serviceConfig.type in HAP.Service)) {
            if (serviceConfig.type == 'Camera') {
            	this.initCamera(hapDevice, serviceConfig);
            	return;
            } else
            	throw Error('unknown service type: ' + serviceConfig.type);
        }
        var isNew = false;
        var hapService = hapDevice.getService(HAP.Service[serviceConfig.type]);
        if (hapService !== undefined && hapService.subType !== serviceConfig.subType) {
            hapService = undefined;
        }
        if (hapService === undefined) {
            hapService = new HAP.Service[serviceConfig.type](serviceConfig.name, serviceConfig.subType);
            isNew = true;
        }
        // fix negative temperature issue
        if (serviceConfig.type == 'TemperatureSensor') {
            hapService.getCharacteristic(exports.HAPCharacteristic.CurrentTemperature).setProps({ minValue: -50 });
        }
        for (var _i = 0, _a = serviceConfig.characteristics; _i < _a.length; _i++) {
            var charactConfig = _a[_i];
            this.initCharacteristic(hapService, charactConfig);
        }
        if (isNew) {
            hapDevice.addService(hapService);
        }
    };
    THomeKitBridge.prototype.initCharacteristic = function (hapService, characteristicConfig) {
        var _this = this;
        var hapCharacteristic = hapService.getCharacteristic(exports.HAPCharacteristic[characteristicConfig.name]);
        if (!hapCharacteristic) {
            this.FLogger.warn("unknown characteristic: " + characteristicConfig.name);
            return;
        }
        if (!characteristicConfig.enabled)
            return;
        hapCharacteristic.binding = this.FBridgeFactory.CreateBinding(characteristicConfig, function (plainIOValue) {
            _this.FLogger.debug('[' + characteristicConfig.name + '] got a change notify event, ioValue: ' + JSON.stringify(plainIOValue));
            var binding = hapCharacteristic.binding;
            if (!binding) {
                _this.FLogger.error('[' + characteristicConfig.name + '] no binding!');
                return;
            }
            var hkValue = binding.conversion.toHomeKit(plainIOValue);
            _this.FLogger.debug('[' + characteristicConfig.name + '] forwarding value from ioBroker (' + JSON.stringify(plainIOValue) + ') to homekit as (' + JSON.stringify(hkValue) + ')');
            hapCharacteristic.setValue(hkValue, undefined, binding);
        });
        hapCharacteristic.on('set', function (hkValue, callback, context) {
            _this.FLogger.debug('[' + characteristicConfig.name + '] got a set event, hkValue: ' + JSON.stringify(hkValue));
            var binding = hapCharacteristic.binding;
            if (!binding) {
                _this.FLogger.error('[' + characteristicConfig.name + '] no binding!');
                callback();
                return;
            }
            if (context === binding) {
                _this.FLogger.debug('[' + characteristicConfig.name + '] set was initiated from ioBroker - exiting here');
                callback();
                return;
            }
            var ioValue = binding.conversion.toIOBroker(hkValue);
            binding.inOut.toIOBroker(ioValue, function () {
                _this.FLogger.debug('[' + characteristicConfig.name + '] set was accepted by ioBroker (value: ' + JSON.stringify(ioValue) + ')');
                callback();
            });
        });
        hapCharacteristic.on('get', function (hkCallback) {
            _this.FLogger.debug('[' + characteristicConfig.name + '] got a get event');
            var binding = hapCharacteristic.binding;
            if (!binding) {
                _this.FLogger.error('[' + characteristicConfig.name + '] no binding!');
                hkCallback('no binding', null);
                return;
            }
            binding.inOut.fromIOBroker(function (ioBrokerError, ioValue) {
                var hkValue = binding.conversion.toHomeKit(ioValue);
                _this.FLogger.debug('[' + characteristicConfig.name + '] forwarding value from ioBroker (' + JSON.stringify(ioValue) + ') to homekit as (' + JSON.stringify(hkValue) + ')');
                hkCallback(ioBrokerError, hkValue);
            });
        });
    };
    return THomeKitBridge;
}());
exports.THomeKitBridge = THomeKitBridge;
var hapInited = false;
function initHAP(storagePath, HAPdebugLogMethod) {
    if (hapInited) {
        return;
    }
    HAP.init(storagePath);
    debug.log = function () {
        HAPdebugLogMethod(util.format.apply(this, arguments));
    };
}
exports.initHAP = initHAP;
