// =========================
// js/api.js
// =========================
import { POI_CONFIG } from './config.js';

// The URL of your new Cloudflare Worker Proxy
export const PROXY_URL = 'https://radius-scout-proxy.ajamespage.workers.dev';

export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lon},${lat}`);
    const data = await response.json();
    if (data.address) {
      return data.address.Match_addr || 'Selected Location';
    }
  } catch (err) {
    console.warn(`ArcGIS reverse geocoder failed:`, err);
  }
  return 'Selected Location';
}

export async function geocode(address) {
  try {
    const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(address)}&maxLocations=1`);
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No coordinates found for this address.');
    }

    const match = data.candidates[0];
    return {
      lat: match.location.y,
      lon: match.location.x,
      display_name: match.address
    };
  } catch (err) {
    console.error("Geocoding failed:", err);
    throw new Error('Address service is temporarily unavailable. Please try again.');
  }
}

export async function searchAddresses(query) {
  try {
    const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=5`);
    const data = await response.json();
    
    if (!data.candidates) return [];

    return data.candidates.map(c => ({
      display_name: c.address,
      lat: c.location.y,
      lon: c.location.x
    }));
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