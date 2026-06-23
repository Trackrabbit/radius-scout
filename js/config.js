// ===============
// js/config.js
// ===============

export const POI_CONFIG = {
  worship: { label: 'Worship', icon: '⛪', groups: ['family', 'community'], default: true, filters: [['amenity', 'place_of_worship']] },
  school: { label: 'Schools', icon: '🏫', groups: ['family'], default: true, filters: [['amenity', 'school']] },
  college: { label: 'Colleges', icon: '🎓', groups: ['family'], default: true, filters: [['amenity', 'college'], ['amenity', 'university']] },
  kindergarten: { label: 'Kinder', icon: '🧒', groups: ['family'], default: true, filters: [['amenity', 'kindergarten']] },
  daycare: { label: 'Daycare', icon: '👶', groups: ['family'], default: true, filters: [['amenity', 'childcare']] },
  library: { label: 'Libraries', icon: '📚', groups: ['family', 'community'], default: true, filters: [['amenity', 'library']] },
  park: { label: 'Parks', icon: '🌳', groups: ['family', 'recreation'], default: true, filters: [['leisure', 'park']] },
  playground: { label: 'Playgrounds', icon: '🛝', groups: ['family', 'recreation'], default: true, filters: [['leisure', 'playground']] },
  pool: { label: 'Pools', icon: '🏊', groups: ['recreation'], default: true, filters: [['leisure', 'swimming_pool']] },
  bus_stop: { label: 'Bus Stops', icon: '🚌', groups: ['transportation'], default: true, filters: [['highway', 'bus_stop']] },
  bus_station: { label: 'Bus Stations', icon: '🚏', groups: ['transportation'], default: true, filters: [['amenity', 'bus_station']] },
  apartments: { label: 'Apartments', icon: '🏢', groups: ['business', 'realestate'], default: true, filters: [['building', 'apartments'], ['building', 'residential']] },
  restaurant: { label: 'Restaurants', icon: '🍽️', groups: ['dining', 'business'], default: false, filters: [['amenity', 'restaurant']] },
  cafe: { label: 'Cafes', icon: '☕', groups: ['dining'], default: false, filters: [['amenity', 'cafe']] },
  shop: { label: 'Stores', icon: '🛍️', groups: ['dining', 'business'], default: false, filters: [['shop', '*']] },
  office: { label: 'Offices', icon: '💼', groups: ['business'], default: false, filters: [['office', '*']] },
  hotel: { label: 'Hotels', icon: '🏨', groups: ['business'], default: false, filters: [['tourism', 'hotel'], ['tourism', 'motel'], ['tourism', 'guest_house']] },
  hospital: { label: 'Hospitals', icon: '🏥', groups: ['essential'], default: false, filters: [['amenity', 'hospital']] },
  pharmacy: { label: 'Pharmacies', icon: '💊', groups: ['essential'], default: false, filters: [['amenity', 'pharmacy']] },
  police: { label: 'Police', icon: '👮', groups: ['essential'], default: false, filters: [['amenity', 'police']] },
  fire_station: { label: 'Fire Stations', icon: '🚒', groups: ['essential'], default: false, filters: [['amenity', 'fire_station']] },
  fuel: { label: 'Gas Stations', icon: '⛽', groups: ['essential', 'transportation'], default: false, filters: [['amenity', 'fuel']] },
  grocery: { label: 'Groceries', icon: '🛒', groups: ['essential', 'family'], default: false, filters: [['shop', 'supermarket']] }
};

export const POI_PRESETS = {
  family: ['school', 'college', 'kindergarten', 'daycare', 'library', 'park', 'playground', 'pool', 'worship', 'grocery'],
  essentials: ['hospital', 'pharmacy', 'police', 'fire_station', 'fuel', 'grocery'],
  investor: ['apartments', 'restaurant', 'shop', 'bus_stop', 'bus_station'],
  recreation: ['park', 'playground', 'pool']
};

export const POI_GROUPS = {
  family: "🏠 Family & Community",
  essential: "🚨 Essential Services",
  transportation: "🚌 Transportation",
  dining: "🍔 Dining & Shopping",
  business: "🏢 Housing & Business",
  recreation: "🌳 Recreation",
  community: "🤝 Community",
  realestate: "🏠 Real Estate"
};

export const NOMINATIM_SERVERS = [
  'https://nominatim.openstreetmap.org',
  'https://nominatim.geocoding.ai'
];

export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

// GLOBAL STATE
export const POI_STATE = {};

Object.keys(POI_CONFIG).forEach(key => {
  POI_STATE[key] = POI_CONFIG[key].default || false;
});

// HELPER TO GET ARRAY OF ACTIVE POI KEYS
export function selectedPOI() {
  return Object.entries(POI_STATE)
    .filter(([_, val]) => val)
    .map(([key]) => key);
}
