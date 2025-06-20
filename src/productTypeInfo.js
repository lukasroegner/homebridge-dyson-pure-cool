const knownProducts = {
  '358': {
    model: 'Dyson Pure Humidify+Cool',
    hardwareRevision: 'PH01',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: true,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '358E': {
    model: 'Dyson Pure Humidify+Cool Formaldehyde',
    hardwareRevision: 'PH03/PH04',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: true,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '358K': {
    model: 'Dyson Pure Humidify+Cool Formaldehyde',
    hardwareRevision: 'PH03/PH04',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: true,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '438': {
    model: 'Dyson Pure Cool (Tower)',
    hardwareRevision: 'TP04/TP11',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '438E': {
    model: 'Dyson Pure Cool',
    hardwareRevision: 'TP07/TP09',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '438K': {
    model: 'Dyson Pure Cool',
    hardwareRevision: 'TP07/TP09',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '455': {
    model: 'Dyson Pure Hot+Cool Link',
    hardwareRevision: 'HP02',
    hasAdvancedAirQualitySensors: false,
    hasHeating: true,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '469': {
    model: 'Dyson Pure Cool Link Desk',
    hardwareRevision: 'DP01',
    hasAdvancedAirQualitySensors: false,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: true,
  },
  '475': {
    model: 'Dyson Pure Cool Link Tower',
    hardwareRevision: 'TP02',
    hasAdvancedAirQualitySensors: false,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: true,
  },
  '520': {
    model: 'Dyson Pure Cool Purifying Desk',
    hardwareRevision: 'DP04',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '527': {
    model: 'Dyson Pure Hot+Cool',
    hardwareRevision: 'HP04',
    hasAdvancedAirQualitySensors: true,
    hasHeating: true,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '527E': {
    model: 'Dyson Purifier Hot+Cool Formaldehyde',
    hardwareRevision: 'HP07/HP09',
    hasAdvancedAirQualitySensors: true,
    hasHeating: true,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '527K': {
    model: 'Dyson Purifier Hot+Cool',
    hardwareRevision: 'HP07',
    hasAdvancedAirQualitySensors: true,
    hasHeating: true,
    hasHumidifier: false,
    hasJetFocus: true,
    hasOscillation: true,
  },
  '664': {
    model: 'Dyson Purifier Big+Quiet Formaldehyde',
    hardwareRevision: 'BP02/BP03/BP04/BP06',
    hasAdvancedAirQualitySensors: true,
    hasHeating: false,
    hasHumidifier: false,
    hasJetFocus: false,
    hasOscillation: false,
  },
};

module.exports = function(productType) {
  const info = {};
  for (const [k, v] of Object.entries(knownProducts[productType] || {})) info[k] = v;
  if (!info.hardwareRevision) info.hardwareRevision = '';
  if (!info.hasAdvancedAirQualitySensors) info.hasAdvancedAirQualitySensors = false;
  if (!info.hasHeating) info.hasHeating = false;
  if (!info.hasHumidifier) info.hasHumidifier = false;
  if (!info.hasJetFocus) info.hasJetFocus = false;
  if (!info.hasOscillation) info.hasOscillation = false;
  if (!info.model) info.model = 'Pure Cool';
  return info;
};
