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

// The new simplified fetch function pointing to your proxy
export async function fetchPOI(center, radius, keys) {
  const types = keys.join(',');
  const url = `${PROXY_URL}/?lat=${center.lat}&lon=${center.lon}&radius=${radius}&types=${types}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.elements || [];
    
  } catch (err) {
    console.error("Fetch POI Error:", err);
    throw new Error('Unable to load map data from the proxy server.');
  }
}
