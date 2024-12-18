const productTypeInfo = require('../src/productTypeInfo');
const t = require('tap');

t.test('Default product', t => {
  t.same(productTypeInfo('999'), {
    model: 'Pure Cool',
    hardwareRevision: '',
    hasAdvancedAirQualitySensors: false,
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
    hasAdvancedAirQualitySensors: true,
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
    hasAdvancedAirQualitySensors: false,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: true,
  });
  t.end();
});
