// =========================
// js/api.js
// =========================
import { NOMINATIM_SERVERS, POI_CONFIG } from './config.js';

// The URL of your new Cloudflare Worker Proxy
export const PROXY_URL = 'https://radius-scout-proxy.ajamespage.workers.dev';

export async function reverseGeocode(lat, lon) {
  for (const server of NOMINATIM_SERVERS) {
    try {
      const response = await fetch(`${server}/reverse?format=json&lat=${lat}&lon=${lon}`);
      const text = await response.text();
      if (!text.startsWith('{')) throw new Error();
      const data = JSON.parse(text);
      return data.display_name || '';
    } catch (err) {
      console.warn(`Reverse geocoder failed: ${server}`);
    }
  }
  return '';
}

export async function geocode(address) {
  for (const server of NOMINATIM_SERVERS) {
    try {
      const response = await fetch(`${server}/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
      const text = await response.text();
      const first = text.trim()[0];
      if (first !== '[' && first !== '{') throw new Error('Invalid JSON response');
      
      const data = JSON.parse(text);
      if (!data.length) continue;

      return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        display_name: data[0].display_name
      };
    } catch (err) {
      console.warn(`Geocoder failed: ${server}`, err);
    }
  }
  throw new Error('Address service is temporarily unavailable.');
}

export async function searchAddresses(query) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`);
  return await response.json();
}

//
export function buildQuery(center, radius, keys) {
  let queryParts = [];
  keys.forEach(key => {
    const poi = POI_CONFIG[key];
    poi.filters.forEach(([tag, val]) => {
      if (val === '*') {
        queryParts.push(`nwr["${tag}"](around:${radius},${center.lat},${center.lon});`);
      } else {
        queryParts.push(`nwr["${tag}"="${val}"](around:${radius},${center.lat},${center.lon});`);
      }
    });
  });
  return `[out:json][timeout:25];\n(\n${queryParts.join('\n')}\n);\nout center;`;
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
