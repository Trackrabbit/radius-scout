// =========================
// js/map.js
// =========================
import { POI_CONFIG } from './config.js';

export const map = L.map('map');
export let markerLayer = L.layerGroup().addTo(map);
export let radiusCircle = null;
export let markersByType = {};
// Add this near the top of map.js with your other let/const declarations
let popupTimeout;

// Initialize base layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

export function initMap() {
  resetMapView();

  // Watch for pop-ups
  map.on('popupopen', (e) => {
    const popupNode = e.popup._container;
    
    // If the mouse enters the pop-up card, cancel the closing timer
    popupNode.addEventListener('mouseenter', () => {
      clearTimeout(popupTimeout);
    });
    
    // If the mouse leaves the pop-up card, start a 5-second countdown
    popupNode.addEventListener('mouseleave', () => {
      popupTimeout = setTimeout(() => {
        map.closePopup(e.popup);
      }, 2000);
    });
  });
}

export function resetMapView() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => map.setView([20, 0], 2)
    );
  } else {
    map.setView([20, 0], 2);
  }
}

export function drawRadius(center, radius) {
  if (radiusCircle) map.removeLayer(radiusCircle);
  
  radiusCircle = L.circle([center.lat, center.lon], {
    radius,
    color: '#8b5cf6',
    fillOpacity: 0.12,
    weight: 2,
    dashArray: '4'
  }).addTo(map);
}

export function clearMapData() {
  markerLayer.clearLayers();
  markersByType = {};
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  map.closePopup();
}

export function applyFilter(filterKey) {
  markerLayer.clearLayers();
  if (!filterKey) {
    Object.values(markersByType).flat().forEach(m => markerLayer.addLayer(m));
  } else if (markersByType[filterKey]) {
    markersByType[filterKey].forEach(m => markerLayer.addLayer(m));
  }
}

// =========================
// RENDER & HELPERS
// =========================

export function renderMarkers(results, center, selectedKeys) {
  let counts = {};
  
  Object.keys(POI_CONFIG).forEach(key => {
    markersByType[key] = [];
    counts[key] = 0;
  });

  results.forEach(item => {
    const lat = item.lat || item.center?.lat;
    const lon = item.lon || item.center?.lon;
    if (!lat || !lon) return;

    let type = matchPOI(item.tags);
    if (!type || !selectedKeys.includes(type)) type = selectedKeys[0];

    counts[type]++;

    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: `<div style="font-size:20px;filter:drop-shadow(0 0 4px rgba(0,0,0,0.8));">${POI_CONFIG[type].icon}</div>`
      })
    });

    // Bind the pop-up, but disables the default click toggle behavior
    marker.bindPopup(buildPopup(item, type, center), {
      closeButton: false,
      offset: [0, -10]
    });

    // Open on hover and clear any active closing timers
    marker.on('mouseover', function (e) {
      clearTimeout(popupTimeout);
      this.openPopup();
    });

    // Start the countdown when the mouse leaves the map marker
    marker.on('mouseout', function (e) {
      popupTimeout = setTimeout(() => {
        this.closePopup();
      }, 5000);
    });

    markersByType[type].push(marker);
    markerLayer.addLayer(marker);
  });

  return counts;
}

function matchPOI(tags) {
  for (const [key, poi] of Object.entries(POI_CONFIG)) {
    for (const [tag, val] of poi.filters) {
      if (val === '*' && tags?.[tag]) return key;
      if (tags?.[tag] === val) return key;
    }
  }
  return null;
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildPopup(item, type, center) {
  const tags = item.tags || {};
  const distance = distanceMiles(center.lat, center.lon, item.lat || item.center?.lat, item.lon || item.center?.lon).toFixed(2);
  
  // Extract richer OSM Data
  const name = tags.name || tags.brand || POI_CONFIG[type].label;
  const address = `${tags['addr:housenumber'] || ''} ${tags['addr:street'] || ''}`.trim();
  const hours = tags.opening_hours ? `🕒 ${tags.opening_hours.replace(/;/g, ', ')}` : '';
  const cuisine = tags.cuisine ? `🍔 ${tags.cuisine.replace(/;/g, ', ')}` : '';
  const wheelchair = tags.wheelchair === 'yes' ? `♿ Accessible` : (tags.wheelchair === 'no' ? `🚫 Not Accessible` : '');
  const wifi = tags.internet_access === 'wlan' || tags.internet_access === 'yes' ? `📶 WiFi Available` : '';

  const extraBadges = [];
  
  if (tags.takeaway === 'yes') extraBadges.push('🥡 Takeaway');
  if (tags.outdoor_seating === 'yes') extraBadges.push('☀️ Patio');
  if (tags.toilets === 'yes' || tags.toilets === 'customers') extraBadges.push('🚻 Restrooms');
  if (tags.parking === 'surface' || tags.parking === 'multi-storey') extraBadges.push('🅿️ Parking');

  const badgesHTML = extraBadges.length 
    ? `<div class="popup-line" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
        ${extraBadges.map(b => `<span style="font-size: 11px; background: #1f2937; padding: 2px 6px; border-radius: 4px;">${b}</span>`).join('')}
       </div>`
    : '';
  
  return `
    <div class="popup-card">
      <div class="popup-title">${POI_CONFIG[type].icon} ${name}</div>
      
      ${address ? `<div class="popup-line">📍 ${address}</div>` : ''}
      ${hours ? `<div class="popup-line">${hours}</div>` : ''}
      ${cuisine ? `<div class="popup-line" style="text-transform: capitalize;">${cuisine}</div>` : ''}
      
      ${tags.phone ? `<div class="popup-line">📞 ${tags.phone}</div>` : ''}
      
      ${tags.website ? `
        <div class="popup-line">
          🌐 <a href="${tags.website}" target="_blank" rel="noopener noreferrer">Website</a>
        </div>
      ` : ''}
      
      <div class="popup-line" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
        ${wheelchair ? `<span style="font-size: 11px; background: #1f2937; padding: 2px 6px; border-radius: 4px;">${wheelchair}</span>` : ''}
        ${wifi ? `<span style="font-size: 11px; background: #1f2937; padding: 2px 6px; border-radius: 4px;">${wifi}</span>` : ''}
      </div>

      <div class="popup-line" style="margin-top: 8px; color: #8b5cf6; font-weight: 600;">
        📏 ${distance} mi away
      </div>
    </div>
  `;
}
