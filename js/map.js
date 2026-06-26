// ========================
// js/map.js
// ========================
import { POI_CONFIG } from './config.js';

export const map = L.map('map');
export let markerLayer = L.layerGroup().addTo(map);
export let radiusCircle = null;
export let centerMarker = null;
export let markersByType = {};
export let realEstateLayer;

let popupTimeout;

// Initialize base layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

export function initMap() {
  resetMapView();

  // Initialize the real estate layer immediately when the map loads!
  realEstateLayer = L.layerGroup().addTo(map);

  // Watch for pop-ups
  map.on('popupopen', (e) => {
    const popupNode = e.popup._container;
    
    // If the mouse enters the pop-up card, cancel the closing timer
    popupNode.addEventListener('mouseenter', () => {
      clearTimeout(popupTimeout);
    });
    
    // If the mouse leaves the pop-up card, start a 1.5-second countdown
    popupNode.addEventListener('mouseleave', () => {
      popupTimeout = setTimeout(() => {
        map.closePopup(e.popup);
      }, 1500);
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
  if (centerMarker) map.removeLayer(centerMarker); 
  
  // Draw the circle
  radiusCircle = L.circle([center.lat, center.lon], {
    radius,
    color: '#8b5cf6',
    fillOpacity: 0.12,
    weight: 2,
    dashArray: '4'
  }).addTo(map);

  // Draw the center anchor
  const centerIcon = L.divIcon({
    className: 'center-anchor-icon',
    html: `
      <div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7] // Centers the dot perfectly on the exact coordinates
  });

  centerMarker = L.marker([center.lat, center.lon], {
    icon: centerIcon,
    zIndexOffset: 1000 // Forces the center dot to sit above all other markers
  }).addTo(map);
}

export function clearMapData() {
  markerLayer.clearLayers();
  markersByType = {};
  if (realEstateLayer) realEstateLayer.clearLayers();
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  if (centerMarker) {
    map.removeLayer(centerMarker);
    centerMarker = null;
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
      }, 1500);
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

// =========================
// REAL ESTATE RENDERER
// =========================
export function renderRealEstateMarkers(properties) {
  if (realEstateLayer) realEstateLayer.clearLayers();

  const houseIcon = L.divIcon({
    className: 'custom-real-estate-icon',
    html: `
      <div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">
        🏠
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

  properties.forEach(prop => {
    // 1. Extract live coordinates from the nested location block
    const lat = prop.location?.address?.coordinate?.lat;
    const lon = prop.location?.address?.coordinate?.lon;
    
    // Skip plotting if coordinate entries are missing or malformed
    if (!lat || !lon) return;

    // 2. Normalize and format raw data fields
    const rawPrice = prop.list_price || 0;
    const formattedPrice = rawPrice > 0 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rawPrice)
      : 'Contact Agent';

    const streetAddress = prop.location?.address?.line || 'Address Undisclosed';
    const beds = prop.description?.beds || '--';
    const baths = prop.description?.baths || '--';
    const sqft = prop.description?.sqft 
      ? new Intl.NumberFormat('en-US').format(prop.description.sqft) 
      : '--';
    
    // Normalize status strings (e.g., "for_sale" -> "For Sale")
    const cleanStatus = prop.status 
      ? prop.status.replace('_', ' ') 
      : 'Active';

    // 3. Build Marker and Popup
    const marker = L.marker([lat, lon], { icon: houseIcon });

    const popupContent = `
      <div style="font-family: system-ui, sans-serif; min-width: 220px; padding: 5px;">
        <h2 style="margin: 0 0 4px 0; color: #10b981; font-size: 22px;">${formattedPrice}</h2>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; font-weight: 500; text-transform: capitalize;">${streetAddress.toLowerCase()}</p>
        
        <div style="display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 8px 0; margin-bottom: 12px; font-size: 14px; color: #374151;">
          <div style="text-align: center;"><b>${beds}</b><br><span style="font-size:11px; color:#9ca3af;">Beds</span></div>
          <div style="text-align: center;"><b>${baths}</b><br><span style="font-size:11px; color:#9ca3af;">Baths</span></div>
          <div style="text-align: center;"><b>${sqft}</b><br><span style="font-size:11px; color:#9ca3af;">SqFt</span></div>
        </div>
        
        <div style="text-align: center;">
          <span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
            ${cleanStatus}
          </span>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    realEstateLayer.addLayer(marker);
  });
}
