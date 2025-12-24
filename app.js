// ===== Map setup =====
const map = L.map("map").setView([32.8407, -83.6324], 12); // Macon, GA default

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let centerMarker = null;
let radiusCircle = null;
let poiLayer = L.layerGroup().addTo(map);

// Simple color scheme for POI icons
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
// Nominatim usage policy: add a proper User-Agent / Referer in production. [web:16]
async function geocodeAddress(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en"
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
// Uses Overpass QL to query nodes/ways/relations within an around-radius. [web:24][web:28]
function buildOverpassQuery(lat, lon, radiusMeters, options) {
  const blocks = [];

  if (options.worship) {
    blocks.push(`
      nwr["amenity"="place_of_worship"](around:${radiusMeters},${lat},${lon});
    `);
  }
  if (options.schools) {
    blocks.push(`
      nwr["amenity"="school"](around:${radiusMeters},${lat},${lon});
    `);
  }
  if (options.parks) {
    blocks.push(`
      nwr["leisure"="park"](around:${radiusMeters},${lat},${lon});
    `);
  }
  if (options.daycare) {
    blocks.push(`
      nwr["amenity"="childcare"](around:${radiusMeters},${lat},${lon});
    `);
  }

  if (blocks.length === 0) {
    return null;
  }

  const body = blocks.join("\n");

  const query = `
    [out:json][timeout:25];
    (
      ${body}
    );
    out center;
  `;

  return query;
}

async function fetchCenterPOI(lat, lon, options) {
  const tinyRadius = 5; // meters
  const q = buildOverpassQuery(lat, lon, tinyRadius, options);
  if (!q) return [];

  const url = "https://overpass.kumi.systems/api/interpreter"; // or your chosen instance
  const res = await fetch(url, {
    method: "POST",
    body: q
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.elements || [];
}

async function fetchPOIs(lat, lon, radiusMeters, options) {
  const q = buildOverpassQuery(lat, lon, radiusMeters, options);
  if (!q) return [];

  const url = "https://overpass.kumi.systems/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    body: q
  });

  if (!res.ok) {
    throw new Error("Overpass API request failed");
  }

  const data = await res.json();
  return data.elements || [];
}

function categorizeElement(el) {
  if (!el.tags) return null;

  if (el.tags.amenity === "place_of_worship") return "worship";
  if (el.tags.amenity === "school") return "school";
  if (el.tags.leisure === "park") return "park";
  if (el.tags.amenity === "childcare") return "daycare";

  return null;
}

function addPoisToMap(elements) {
  poiLayer.clearLayers();

  const counts = {
    worship: 0,
    school: 0,
    park: 0,
    daycare: 0
  };

  elements.forEach(el => {
    const cat = categorizeElement(el);
    console.log("POI raw tags:", el.tags);
    console.log("POI category from categorizeElement:", cat);

    if (!cat) return;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (lat == null || lon == null) return;

    if (counts[cat] === undefined) {
      console.warn("Unknown category key for counts:", cat);
    } else {
      counts[cat] += 1;
    }

    const style = poiStyles[cat];
    if (!style) {
      console.warn("Missing poiStyles entry for category:", cat);
      return;
    }

    const icon = createPoiIcon(style.color);

    const name = el.tags.name || "(Unnamed)";
    const details = [];
    if (el.tags.denomination) details.push(`Denomination: ${el.tags.denomination}`);
    if (el.tags.religion) details.push(`Religion: ${el.tags.religion}`);
    if (el.tags.operator) details.push(`Operator: ${el.tags.operator}`);

    const popupHtml = `
      <strong>${style.label}</strong><br/>
      ${name}<br/>
      <small>${details.join("<br/>")}</small>
    `;

    L.marker([lat, lon], { icon }).bindPopup(popupHtml).addTo(poiLayer);
  });

  console.log("Final counts:", counts);
  updateSummary(counts);
}

function updateSummary(counts) {
  document.getElementById("countWorship").textContent = counts.worship;
  document.getElementById("countSchools").textContent = counts.school;
  document.getElementById("countParks").textContent = counts.park;
  document.getElementById("countDaycare").textContent = counts.daycare;

  const summary = document.getElementById("summaryPopup");
  summary.classList.remove("hidden");
}

// ===== Monetization stub =====
function initMonetization() {
  // Placeholder: call ad network, show paywall, etc.
  // Example:
  //   loadAds();
  //   if (!userIsPaid) limit radius or results.
  console.log("Monetization stub initialized.");
}

// ===== Main flow =====
const addressInput = document.getElementById("addressInput");
const radiusSelect = document.getElementById("radiusSelect");
const searchBtn = document.getElementById("searchBtn");

searchBtn.addEventListener("click", async () => {
  const address = addressInput.value.trim();
  if (!address) {
    alert("Please enter an address.");
    return;
  }

  const radiusMeters = parseInt(radiusSelect.value, 10);

  const options = {
    worship: document.getElementById("poiWorship").checked,
    schools: document.getElementById("poiSchools").checked,
    parks: document.getElementById("poiParks").checked,
    daycare: document.getElementById("poiDaycare").checked
  };

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching...";

  try {
    // 1. Geocode
    const loc = await geocodeAddress(address);

    // Center map
    map.setView([loc.lat, loc.lon], 15);

    if (centerMarker) {
      map.removeLayer(centerMarker);
    }
    centerMarker = L.marker([loc.lat, loc.lon]).addTo(map);
    centerMarker.bindPopup(`<strong>Center</strong><br/>${loc.label}`).openPopup();

    // Draw radius
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
    }
    radiusCircle = L.circle([loc.lat, loc.lon], {
      radius: radiusMeters,
      color: "#4fd1c5",
      weight: 1.5,
      fillColor: "#4fd1c5",
      fillOpacity: 0.15
    }).addTo(map);

  // 2. Query POIs in radius
  const elements = await fetchPOIs(loc.lat, loc.lon, radiusMeters, options);
  
  // 2b. Query POI exactly at the center (in case the address is itself a school, church, etc.)
  const centerElements = await fetchCenterPOI(loc.lat, loc.lon, options);
  
  // Merge and remove duplicates by OSM id
  const all = [...elements, ...centerElements];
  const seen = new Set();
  const unique = all.filter(el => {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // 3. Add to map
  addPoisToMap(unique);

  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong. Try again.");
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search Area";
  }
});

// Initialize
initMonetization();



