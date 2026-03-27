// ===== Map setup =====
const map = L.map("map").setView([32.8407, -83.6324], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let centerMarker = null;
let radiusCircle = null;
let poiLayer = L.layerGroup().addTo(map);

const poiStyles = {
  worship: { color: "#f56565", label: "Place of Worship" },
  school: { color: "#ecc94b", label: "School" },
  park: { color: "#48bb78", label: "Park" },
  daycare: { color: "#9f7aea", label: "Daycare" }
};

// Helper: Custom Marker Icon
function createPoiIcon(color) {
  return L.divIcon({
    className: "custom-poi-icon",
    html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 2px rgba(0,0,0,0.6);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

// ===== Math: Bounding Box Calculation (Fastest Search) =====
function getBoundingBox(lat, lon, radiusMeters) {
  const latOffset = radiusMeters / 111320; 
  const lonOffset = radiusMeters / (111320 * Math.cos(lat * (Math.PI / 180)));

  return {
    south: lat - latOffset,
    west: lon - lonOffset,
    north: lat + latOffset,
    east: lon + lonOffset
  };
}

// ===== Geocoding (Nominatim) =====
async function geocodeAddress(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "MapSearchTool/1.0 (contact@example.com)"
    }
  });

  if (!res.ok) throw new Error("Geocoding failed. Check your connection.");
  const data = await res.json();
  if (!data.length) throw new Error("Address not found.");

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name
  };
}

// ===== Overpass Query Logic =====
async function fetchFromOverpass(lat, lon, radiusMeters, options) {
  const box = getBoundingBox(lat, lon, radiusMeters);
  const bboxStr = `${box.south},${box.west},${box.north},${box.east}`;
  
  const filters = [];
  if (options.worship) filters.push(`nwr["amenity"="place_of_worship"](${bboxStr});`);
  if (options.schools) filters.push(`nwr["amenity"="school"](${bboxStr});`);
  if (options.parks)   filters.push(`nwr["leisure"="park"](${bboxStr});`);
  if (options.daycare) filters.push(`nwr["amenity"~"childcare|kindergarten"](${bboxStr});`);

  if (!filters.length) return [];

  const query = `[out:json][timeout:15];(${filters.join("")});out center;`;
  const url = "https://overpass-api.de/api/interpreter"; // Using main fast server

  const res = await fetch(url, {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: "data=" + encodeURIComponent(query)
  });

  const contentType = res.headers.get("content-type");
  if (!res.ok || !contentType || !contentType.includes("application/json")) {
    throw new Error("Overpass server busy. Please try again in a few seconds.");
  }

  const data = await res.json();
  return data.elements || [];
}

// ===== UI: Map Rendering =====
function categorizeElement(el) {
  const t = el.tags;
  if (!t) return null;
  if (t.amenity === "place_of_worship") return "worship";
  if (t.amenity === "school") return "school";
  if (t.leisure === "park") return "park";
  if (t.amenity === "childcare" || t.amenity === "kindergarten") return "daycare";
  return null;
}

function addPoisToMap(elements) {
  poiLayer.clearLayers();
  const counts = { worship: 0, school: 0, park: 0, daycare: 0 };
  const markers = [];

  elements.forEach(el => {
    const cat = categorizeElement(el);
    if (!cat) return;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (!lat || !lon) return;

    counts[cat]++;
    const style = poiStyles[cat];
    const marker = L.marker([lat, lon], { icon: createPoiIcon(style.color) })
                    .bindPopup(`<strong>${style.label}</strong><br>${el.tags.name || "Unnamed"}`);
    
    marker.addTo(poiLayer);
    markers.push([lat, lon]);
  });

  updateSummary(counts);

  // Auto-Zoom: Fit all markers on screen
  if (markers.length > 0) {
    const bounds = L.latLngBounds(markers);
    // Add the center point to the bounds so it's included
    if (centerMarker) bounds.extend(centerMarker.getLatLng());
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }
}

function updateSummary(counts) {
  const mapping = { worship: "countWorship", school: "countSchools", park: "countParks", daycare: "countDaycare" };
  Object.keys(mapping).forEach(key => {
    const el = document.getElementById(mapping[key]);
    if (el) el.textContent = counts[key];
  });
  document.getElementById("summaryPopup")?.classList.remove("hidden");
}

// ===== Execution Flow =====
const addressInput = document.getElementById("addressInput");
const radiusSelect = document.getElementById("radiusSelect");
const searchBtn = document.getElementById("searchBtn");

searchBtn.addEventListener("click", async () => {
  const address = addressInput.value.trim();
  if (!address) return alert("Please enter an address.");

  const radiusMeters = parseInt(radiusSelect.value, 10);
  const options = {
    worship: document.getElementById("poiWorship")?.checked,
    schools: document.getElementById("poiSchools")?.checked,
    parks: document.getElementById("poiParks")?.checked,
    daycare: document.getElementById("poiDaycare")?.checked
  };

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching...";

  try {
    const loc = await geocodeAddress(address);
    
    // Update Center UI
    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([loc.lat, loc.lon]).addTo(map).bindPopup("Searching from here...");

    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle([loc.lat, loc.lon], { radius: radiusMeters, color: "#4fd1c5", fillOpacity: 0.1 }).addTo(map);

    // Fetch and Display
    const results = await fetchFromOverpass(loc.lat, loc.lon, radiusMeters, options);
    addPoisToMap(results);

  } catch (err) {
    alert(err.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search Area";
  }
});
