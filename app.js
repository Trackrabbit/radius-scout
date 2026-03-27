// ===== Map setup =====
const map = L.map("map").setView([32.8407, -83.6324], 12); // Macon, GA default

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

function createPoiIcon(color) {
  return L.divIcon({
    className: "custom-poi-icon",
    html: `<span style="
      display:inline-block;
      width:14px;
      height:14px;
      border-radius:50%;
      background:${color};
      box-shadow:0 0 0 2px rgba(0,0,0,0.6);
      "></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
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
      // Nominatim REQUIRES a User-Agent. Replace with your app name.
      "User-Agent": "MyPOIApp/1.0 (contact@example.com)" 
    }
  });

  if (!res.ok) throw new Error("Geocoding request failed");

  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error("No results for that address");
  }

  const { lat, lon, display_name } = data[0];
  return {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    label: display_name
  };
}

// ===== Overpass POI query =====
function buildOverpassQuery(lat, lon, radiusMeters, options) {
  const blocks = [];

  if (options.worship) blocks.push(`nwr["amenity"="place_of_worship"](around:${radiusMeters},${lat},${lon});`);
  if (options.schools) blocks.push(`nwr["amenity"="school"](around:${radiusMeters},${lat},${lon});`);
  if (options.parks)   blocks.push(`nwr["leisure"="park"](around:${radiusMeters},${lat},${lon});`);
  if (options.daycare) blocks.push(`nwr["amenity"~"childcare|kindergarten"](around:${radiusMeters},${lat},${lon});`);

  if (blocks.length === 0) return null;

  const body = blocks.join("\n");
  return `[out:json][timeout:25];(${body});out center;`;
}

async function fetchFromOverpass(query) {
  if (!query) return [];

  // You can also use https://overpass-api.de/api/interpreter if kumi is down
  const url = "https://overpass.kumi.systems/api/interpreter";
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    // The query MUST be prefixed with "data=" and URL encoded
    body: "data=" + encodeURIComponent(query)
  });

  const contentType = res.headers.get("content-type");
  if (!res.ok || !contentType || !contentType.includes("application/json")) {
    const errorText = await res.text();
    console.error("Overpass Error Response:", errorText);
    throw new Error("Overpass API error. The server might be rate-limiting or down.");
  }

  const data = await res.json();
  return data.elements || [];
}

async function fetchPOIs(lat, lon, radiusMeters, options) {
  const q = buildOverpassQuery(lat, lon, radiusMeters, options);
  return await fetchFromOverpass(q);
}

async function fetchCenterPOI(lat, lon, options) {
  const q = buildOverpassQuery(lat, lon, 10, options); // 10m tolerance for center
  return await fetchFromOverpass(q);
}

function categorizeElement(el) {
  if (!el.tags) return null;
  if (el.tags.amenity === "place_of_worship") return "worship";
  if (el.tags.amenity === "school") return "school";
  if (el.tags.leisure === "park") return "park";
  if (el.tags.amenity === "childcare" || el.tags.amenity === "kindergarten") return "daycare";
  return null;
}

function addPoisToMap(elements) {
  poiLayer.clearLayers();
  const counts = { worship: 0, school: 0, park: 0, daycare: 0 };

  elements.forEach(el => {
    const cat = categorizeElement(el);
    if (!cat) return;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (lat == null || lon == null) return;

    counts[cat]++;

    const style = poiStyles[cat];
    const icon = createPoiIcon(style.color);
    const name = el.tags.name || "(Unnamed)";
    
    const popupHtml = `
      <strong>${style.label}</strong><br/>
      ${name}
    `;

    L.marker([lat, lon], { icon }).bindPopup(popupHtml).addTo(poiLayer);
  });

  updateSummary(counts);
}

function updateSummary(counts) {
  const ids = { worship: "countWorship", school: "countSchools", park: "countParks", daycare: "countDaycare" };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = counts[key];
  }
  
  const summary = document.getElementById("summaryPopup");
  if (summary) summary.classList.remove("hidden");
}

// ===== Main flow =====
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
    map.setView([loc.lat, loc.lon], 15);

    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([loc.lat, loc.lon]).addTo(map)
      .bindPopup(`<strong>Center</strong><br/>${loc.label}`).openPopup();

    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle([loc.lat, loc.lon], {
      radius: radiusMeters,
      color: "#4fd1c5",
      fillOpacity: 0.15
    }).addTo(map);

    const [radiusResults, centerResults] = await Promise.all([
      fetchPOIs(loc.lat, loc.lon, radiusMeters, options),
      fetchCenterPOI(loc.lat, loc.lon, options)
    ]);

    const all = [...radiusResults, ...centerResults];
    const seen = new Set();
    const unique = all.filter(el => {
      const key = `${el.type}/${el.id}`;
      return seen.has(key) ? false : seen.add(key);
    });

    addPoisToMap(unique);

  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search Area";
  }
});
