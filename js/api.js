// =========================
// js/api.js
// =========================
import { POI_CONFIG } from './config.js';

// The URL of your new Cloudflare Worker Proxy
export const PROXY_URL = 'https://radius-scout-proxy.ajamespage.workers.dev';

// Helper to format Photon's GeoJSON properties into a readable address string
function formatPhotonAddress(props) {
  return [props.name, props.housenumber, props.street, props.city, props.state]
    .filter(Boolean)
    .join(', ');
}

export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return formatPhotonAddress(data.features[0].properties);
    }
  } catch (err) {
    console.warn(`Photon reverse geocoder failed:`, err);
  }
  return 'Selected Location';
}

export async function geocode(address) {
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No coordinates found for this address.');
    }

    // Photon returns GeoJSON coordinates as [Longitude, Latitude]
    const coords = data.features[0].geometry.coordinates;
    const displayName = formatPhotonAddress(data.features[0].properties);

    return {
      lat: Number(coords[1]),
      lon: Number(coords[0]),
      display_name: displayName || address
    };
  } catch (err) {
    console.error("Geocoding failed:", err);
    throw new Error('Address service is temporarily unavailable. Please try again.');
  }
}

export async function searchAddresses(query) {
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
    const data = await response.json();
    
    if (!data.features) return [];

    return data.features.map(f => {
      const coords = f.geometry.coordinates;
      return {
        display_name: formatPhotonAddress(f.properties) || 'Unknown Location',
        lat: Number(coords[1]),
        lon: Number(coords[0])
      };
    });
  } catch (err) {
    console.error("Autocomplete failed:", err);
    return [];
  }
}

// Optimized Overpass QL constructor:
// Splits into node and way targets, sets max memory ceiling, and adds 'qt' (quad-tile) sort
export function buildQuery(center, radius, keys) {
  let queryParts = [];
  keys.forEach(key => {
    const poi = POI_CONFIG[key];
    if (!poi) return;
    poi.filters.forEach(([tag, val]) => {
      if (val === '*') {
        queryParts.push(`node["${tag}"](around:${radius},${center.lat},${center.lon});`);
        queryParts.push(`way["${tag}"](around:${radius},${center.lat},${center.lon});`);
      } else {
        queryParts.push(`node["${tag}"="${val}"](around:${radius},${center.lat},${center.lon});`);
        queryParts.push(`way["${tag}"="${val}"](around:${radius},${center.lat},${center.lon});`);
      }
    });
  });

  return `[out:json][timeout:25][maxsize:1073741824];\n(\n${queryParts.join('\n')}\n);\nout center qt;`;
}

export async function fetchPOI(center, radius, keys) {
  const types = keys.join(',');
  
  // BYPASS: We only build an Overpass query if this is a standard search
  const overpassQuery = types === 'real_estate' 
    ? null 
    : buildQuery(center, radius, keys);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: center.lat,
        lon: center.lon,
        radius: radius,
        types: types,
        overpassQuery: overpassQuery
      })
    });
    
    // 1. Grab the raw text response BEFORE trying to parse it
    const rawText = await response.text();
    
    // 2. The HTML Trap: Try to parse JSON safely
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("🚨 HTML PAYLOAD RECEIVED:", rawText);
      throw new Error(`Proxy returned an HTML webpage instead of JSON (Status ${response.status}). Check the console for the full page text.`);
    }
    
    // 3. Handle standard proxy errors
    if (!response.ok) {
      throw new Error(`Proxy Backend Failed: ${data.error}`);
    }
    
    // 4. ROUTING: Hand back the raw Zillow payload, OR the standard OSM elements
    if (types === 'real_estate') {
      return data; 
    }
    
    return data.elements || [];
    
  } catch (err) {
    console.error("Fetch POI Error:", err);
    throw err;
  }
}