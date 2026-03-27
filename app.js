// ===== Map setup =====
const map = L.map("map").setView([32.8407, -83.6324], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let centerMarker = null;
let radiusCircle = null;
let poiLayer = L.layerGroup().addTo(map);
let currentCenter = null;

// Expanded Styles with new categories
const poiStyles = {
  worship: { color: "#f56565", label: "Place of Worship" },
  school: { color: "#ecc94b", label: "School" },
  park: { color: "#48bb78", label: "Park" },
  daycare: { color: "#9f7aea", label: "Daycare" },
  kindergarten: { color: "#ed8936", label: "Kindergarten" },
  pool: { color: "#4299e1", label: "Pool" },
  library: { color: "#667eea", label: "Library" },
  college: { color: "#ed64a6", label: "College/Uni" },
  playground: { color: "#38b2ac", label: "Playground" }
};

function createPoiIcon(color) {
  return L.divIcon({
    className: "custom-poi-icon",
    html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 2px rgba(0,0,0,0.6);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function getBoundingBox(lat, lon, radiusMeters) {
  const latOffset = radiusMeters / 111320; 
  const lonOffset = radiusMeters / (111320 * Math.cos(lat * (Math.PI / 180)));
  return {
    south: lat - latOffset, west: lon - lonOffset,
    north: lat + latOffset, east: lon + lonOffset
  };
}

async function geocodeAddress(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "MapSearchTool/1.0" }
  });
  if (!res.ok) throw new Error("Geocoding failed.");
  const data = await res.json();
  if (!data.length) throw new Error("Address not found.");
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

async function fetchFromOverpass(lat, lon, radiusMeters, options) {
  const box = getBoundingBox(lat, lon, radiusMeters);
  const bboxStr = `${box.south},${box.west},${box.north},${box.east}`;
  
  const filters = [];
  if (options.worship) filters.push(`nwr["amenity"="place_of_worship"](${bboxStr});`);
  if (options.schools) filters.push(`nwr["amenity"="school"](${bboxStr});`);
  if (options.parks)   filters.push(`nwr["leisure"="park"](${bboxStr});`);
  if (options.daycare) filters.push(`nwr["amenity"="childcare"](${bboxStr});`);
  if (options.kindergarten) filters.push(`nwr["amenity"="kindergarten"](${bboxStr});`);
  if (options.pools)   filters.push(`nwr["leisure"="swimming_pool"](${bboxStr});`);
  if (options.libraries) filters.push(`nwr["amenity"="library"](${bboxStr});`);
  if (options.colleges)  filters.push(`nwr["amenity"~"college|university"](${bboxStr});`);
  if (options.playgrounds) filters.push(`nwr["leisure"="playground"](${bboxStr});`);

  if (!filters.length) return [];

  const query = `[out:json][timeout:15];(${filters.join("")});out center;`;
  const encodedQuery = "data=" + encodeURIComponent(query);
  const servers = ["https://overpass.kumi.systems/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"];

  for (const url of servers) {
    try {
      const res = await fetch(url, { method: "POST", body: encodedQuery });
      if (res.ok) {
        const data = await res.json();
        return data.elements || [];
      }
    } catch (e) { console.warn(`Server ${url} failed.`); }
  }
  throw new Error("Data servers busy.");
}

function categorizeElement(el) {
  const t = el.tags;
  if (!t) return null;
  if (t.amenity === "place_of_worship") return "worship";
  if (t.amenity === "school") return "school";
  if (t.leisure === "park") return "park";
  if (t.amenity === "childcare") return "daycare";
  if (t.amenity === "kindergarten") return "kindergarten";
  if (t.leisure === "swimming_pool") return "pool";
  if (t.amenity === "library") return "library";
  if (t.amenity === "college" || t.amenity === "university") return "college";
  if (t.leisure === "playground") return "playground";
  return null;
}

function addPoisToMap(elements, radiusMeters) {
  poiLayer.clearLayers();
  const counts = { worship: 0, school: 0, park: 0, daycare: 0, kindergarten: 0, pool: 0, library: 0, college: 0, playground: 0 };
  const bounds = L.latLngBounds([currentCenter.lat, currentCenter.lon]);
  let hasPois = false;

  elements.forEach(el => {
    const cat = categorizeElement(el);
    if (!cat) return;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (!lat || !lon) return;

    const dist = map.distance([lat, lon], [currentCenter.lat, currentCenter.lon]);
    if (dist > radiusMeters) return; 

    hasPois = true;
    counts[cat]++;
    const style = poiStyles[cat];
    
    L.marker([lat, lon], { icon: createPoiIcon(style.color) })
     .bindPopup(`<strong>${style.label}</strong><br>${el.tags.name || "Unnamed"}`)
     .addTo(poiLayer);
    
    bounds.extend([lat, lon]);
  });

  updateSummary(counts);

  setTimeout(() => {
    map.invalidateSize();
    if (!hasPois) {
      map.setView([currentCenter.lat, currentCenter.lon], 16, { animate: true });
    } else {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }, 100); 
}

function updateSummary(counts) {
  // Matches IDs in your HTML (e.g., <span id="countKindergarten">0</span>)
  const mapping = { 
    worship: "countWorship", school: "countSchools", park: "countParks", 
    daycare: "countDaycare", kindergarten: "countKindergarten",
    pool: "countPools", library: "countLibraries", college: "countColleges",
    playground: "countPlaygrounds"
  };
  Object.keys(mapping).forEach(key => {
    const el = document.getElementById(mapping[key]);
    if (el) el.textContent = counts[key];
  });
}

searchBtn.addEventListener("click", async () => {
  const address = addressInput.value.trim();
  const radiusMeters = parseInt(radiusSelect.value, 10);
  const options = {
    worship: document.getElementById("poiWorship")?.checked,
    schools: document.getElementById("poiSchools")?.checked,
    parks: document.getElementById("poiParks")?.checked,
    daycare: document.getElementById("poiDaycare")?.checked,
    kindergarten: document.getElementById("poiKindergarten")?.checked,
    pools: document.getElementById("poiPools")?.checked,
    libraries: document.getElementById("poiLibraries")?.checked,
    colleges: document.getElementById("poiColleges")?.checked,
    playgrounds: document.getElementById("poiPlaygrounds")?.checked
  };

  searchBtn.disabled = true;
  try {
    const loc = await geocodeAddress(address);
    currentCenter = loc; 
    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([loc.lat, loc.lon]).addTo(map);

    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle([loc.lat, loc.lon], { radius: radiusMeters, color: "#4fd1c5", fillOpacity: 0.1 }).addTo(map);

    const results = await fetchFromOverpass(loc.lat, loc.lon, radiusMeters, options);
    addPoisToMap(results, radiusMeters);
  } catch (err) {
    alert(err.message);
  } finally {
    searchBtn.disabled = false;
  }
});

const clearBtn = document.getElementById("clearBtn");

clearBtn.addEventListener("click", () => {
  // 1. Clear the Layers
  poiLayer.clearLayers();
  if (centerMarker) map.removeLayer(centerMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);

  // 2. Reset the Summary Counts to 0
  const countIds = [
    "countWorship", "countSchools", "countColleges", 
    "countKindergarten", "countDaycare", "countLibraries", 
    "countParks", "countPlaygrounds", "countPools"
  ];
  
  countIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });

  // 3. Hide the summary box and reset the input
  document.getElementById("summaryPopup")?.classList.add("hidden");
  document.getElementById("addressInput").value = "";
  
  // 4. Reset map view to the original position
  map.setView([32.8407, -83.6324], 12);
  
  console.log("Map cleared.");
});
