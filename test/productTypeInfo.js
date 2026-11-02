const productTypeInfo = require('../src/productTypeInfo');
const t = require('tap');

t.test('Default product', t => {
  t.same(productTypeInfo('999'), {
    model: 'Pure Cool',
    hardwareRevision: '',
    fanControlProtocol: 'fmod',
    deferTargetStateWhenInactive: false,
    hasAdvancedAirQualitySensors: false,
    hasParticulateAirQualitySensors: false,
    hasTemperatureAndHumiditySensors: false,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: false,
  });
  t.end();
  });

t.test('Dyson Pure Humidify+Cool - Few defaults', t => {
  t.same(productTypeInfo('358'), {
    model: 'Dyson Pure Humidify+Cool',
    hardwareRevision: 'PH01',
    fanControlProtocol: 'fmod',
    deferTargetStateWhenInactive: false,
    hasAdvancedAirQualitySensors: true,
    hasParticulateAirQualitySensors: false,
    hasTemperatureAndHumiditySensors: true,
    hasHeating: false,
    hasHumidifier: true,
    hasJetFocus: true,
    hasOscillation: true,
  });
  t.end();
});

t.test('Dyson Pure Cool Link Desk - Mostly defaults', t => {
  t.same(productTypeInfo('469'), {
    model: 'Dyson Pure Cool Link Desk',
    hardwareRevision: 'DP01',
    fanControlProtocol: 'fmod',
    deferTargetStateWhenInactive: false,
    hasAdvancedAirQualitySensors: false,
    hasParticulateAirQualitySensors: false,
    hasTemperatureAndHumiditySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: true,
  });
  t.end();
});

t.test('Dyson Hot+Cool HF1 - No purifier', t => {
  const info = productTypeInfo('635');
  t.equal(info.hardwareRevision, 'HF1');
  t.equal(info.hasHeating, true);
  t.equal(info.hasOscillation, true);
  t.equal(info.isFanOnly, true);
  t.equal(productTypeInfo('527').isFanOnly, undefined);
  t.end();
});

t.test('Dyson HushJet Purifier Compact', t => {
  const info = productTypeInfo('897');
  t.equal(info.hardwareRevision, 'HJ10');
  t.equal(info.fanControlProtocol, 'auto-fnsp');
  t.equal(info.deferTargetStateWhenInactive, true);
  t.equal(info.hasParticulateAirQualitySensors, true);
  t.equal(info.hasTemperatureAndHumiditySensors, false);
  t.equal(info.hasHumidifier, false);
  t.equal(info.isFanOnly, undefined);
  t.end();
});
