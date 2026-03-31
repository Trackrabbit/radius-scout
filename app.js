// ===== Map setup =====
// Center on Macon, GA by default
const map = L.map("map").setView([32.8407, -83.6324], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let centerMarker = null;
let radiusCircle = null;
let poiLayer = L.layerGroup().addTo(map);
let currentCenter = null;

// Expanded Styles to match the new CSS colors
const poiStyles = {
  worship: { color: "#f56565", label: "Place of Worship" },
  school: { color: "#ecc94b", label: "School" },
  college: { color: "#ed64a6", label: "College/Uni" },
  kindergarten: { color: "#ed8936", label: "Kindergarten" },
  daycare: { color: "#9f7aea", label: "Daycare" },
  library: { color: "#667eea", label: "Library" },
  park: { color: "#48bb78", label: "Park" },
  playground: { color: "#38b2ac", label: "Playground" },
  pool: { color: "#4299e1", label: "Pool" },
  busLines: { color: "#63b3ed", label: "Bus Route" }
};

function createPoiIcon(color) {
  return L.divIcon({
    className: "custom-poi-icon",
    html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 2px rgba(0,0,0,0.6);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

// Math: Fast Box Boundaries for Overpass
function getBoundingBox(lat, lon, radiusMeters) {
  const latOffset = radiusMeters / 111320; 
  const lonOffset = radiusMeters / (111320 * Math.cos(lat * (Math.PI / 180)));
  return {
    south: lat - latOffset, west: lon - lonOffset,
    north: lat + latOffset, east: lon + lonOffset
  };
}

// Geocoding via Nominatim
async function geocodeAddress(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "RadiusScout/1.0" }
  });

  if (!res.ok) throw new Error("Geocoding failed.");
  const data = await res.json();
  if (!data.length) throw new Error("Address not found.");

  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

// Overpass API Fetching
async function fetchFromOverpass(lat, lon, radiusMeters, options) {
  const box = getBoundingBox(lat, lon, radiusMeters);
  const bboxStr = `${box.south},${box.west},${box.north},${box.east}`;
  
  const filters = [];
  // ... existing filters (Worship, Schools, etc.) ...
  
  // New Bus Line Filter
  if (options.busLines) {
    filters.push(`relation["route"="bus"](${bboxStr});`);
  }

  if (!filters.length) return [];

  // CRITICAL CHANGE: "out geom" instead of "out center"
  const query = `[out:json][timeout:25];(${filters.join("")});out geom;`;
  const encodedQuery = "data=" + encodeURIComponent(query);

  const servers = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter"
  ];

  for (const url of servers) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodedQuery
      });
      if (res.ok) {
        const data = await res.json();
        return data.elements || [];
      }
    } catch (e) {
      console.warn(`Server ${url} failed, trying next...`);
    }
  }
  throw new Error("All map data servers are busy. Try again in a few seconds.");
}

function categorizeElement(el) {
  const t = el.tags;
  if (!t) return null;
  // 1. Handle Bus Routes (Relations/Lines)
  if (t.route === "bus") return "busLines";
  
  // 2. Handle Amenities (Points/Markers)
  if (t.amenity === "place_of_worship") return "worship";
  if (t.amenity === "school") return "school";
  if (t.amenity === "college" || t.amenity === "university") return "college";
  if (t.amenity === "kindergarten") return "kindergarten";
  if (t.amenity === "childcare") return "daycare";
  if (t.amenity === "library") return "library";

  // 3. Handle Leisure (Parks/Playgrounds/Pools)
  if (t.leisure === "park") return "park";
  if (t.leisure === "playground") return "playground";
  if (t.leisure === "swimming_pool") return "pool";
  return null;
}

function updateSummary(counts) {
  const mapping = { 
    worship: "countWorship", school: "countSchools", college: "countColleges",
    kindergarten: "countKindergarten", daycare: "countDaycare",
    library: "countLibraries", park: "countParks", 
    playground: "countPlaygrounds", pool: "countPools",
    busLines: "countBusLines"
  };

  Object.keys(mapping).forEach(key => {
    const el = document.getElementById(mapping[key]);
    if (el) el.textContent = counts[key] || 0;
  });

  document.getElementById("summaryPopup")?.classList.remove("hidden");
}

function addPoisToMap(elements, radiusMeters) {
  poiLayer.clearLayers();
  const counts = { 
    worship: 0, school: 0, college: 0, kindergarten: 0, 
    daycare: 0, library: 0, park: 0, playground: 0, pool: 0, 
    busLines: 0 // New counter
  };
  
  const bounds = L.latLngBounds([currentCenter.lat, currentCenter.lon]);
  let hasItems = false;

  elements.forEach(el => {
    // --- PART A: HANDLE BUS LINES (RELATIONS) ---
    if (el.type === "relation" && el.tags && el.tags.route === "bus") {
      counts.busLines++;
      hasItems = true;

      // Extract coordinates from the geometry of the relation members
      let routeCoords = [];
      if (el.members) {
        el.members.forEach(member => {
          if (member.role === "" || member.role === "outer") {
            if (member.geometry) {
              const segment = member.geometry.map(pt => [pt.lat, pt.lon]);
              routeCoords.push(segment);
            }
          }
        });
      }

      if (routeCoords.length > 0) {
        const polyline = L.multiPolyline(routeCoords, {
          color: "#4299e1", // Sky Blue
          weight: 5,
          opacity: 0.7,
          lineJoin: 'round'
        })
        .bindPopup(`<strong>Bus Route ${el.tags.ref || ""}</strong><br>${el.tags.name || "Unnamed Route"}`)
        .addTo(poiLayer);
        
        bounds.extend(polyline.getBounds());
      }
      return; // Skip marker logic for this item
    }

    // --- PART B: HANDLE MARKERS (NODES/WAYS) ---
    const cat = categorizeElement(el);
    if (!cat) return;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (!lat || !lon) return;

    const dist = map.distance([lat, lon], [currentCenter.lat, currentCenter.lon]);
    if (dist > radiusMeters) return; 

    hasItems = true;
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
    if (!hasItems) {
      map.setView([currentCenter.lat, currentCenter.lon], 16);
    } else {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }, 100); 
}

// UI Selectors
const addressInput = document.getElementById("addressInput");
const radiusSelect = document.getElementById("radiusSelect");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");

// Search Logic
searchBtn.addEventListener("click", async () => {
  const address = addressInput.value.trim();
  if (!address) return alert("Please enter an address.");

  const radiusMeters = parseInt(radiusSelect.value, 10);
  const options = {
    worship: document.getElementById("poiWorship")?.checked,
    schools: document.getElementById("poiSchools")?.checked,
    colleges: document.getElementById("poiColleges")?.checked,
    kindergarten: document.getElementById("poiKindergarten")?.checked,
    daycare: document.getElementById("poiDaycare")?.checked,
    libraries: document.getElementById("poiLibraries")?.checked,
    parks: document.getElementById("poiParks")?.checked,
    playgrounds: document.getElementById("poiPlaygrounds")?.checked,
    pools: document.getElementById("poiPools")?.checked,
    busLines: document.getElementById("poiBusLines")?.checked
  };

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching...";

  try {
    const loc = await geocodeAddress(address);
    currentCenter = loc; 

    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([loc.lat, loc.lon]).addTo(map).bindPopup("<b>Center:</b> " + loc.label);

    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle([loc.lat, loc.lon], { 
        radius: radiusMeters, 
        color: "#4fd1c5", 
        fillOpacity: 0.1 
    }).addTo(map);

    const results = await fetchFromOverpass(loc.lat, loc.lon, radiusMeters, options);
    addPoisToMap(results, radiusMeters);

  } catch (err) {
    alert(err.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search Area";
  }
});

// Clear Logic
clearBtn.addEventListener("click", () => {
  poiLayer.clearLayers();
  if (centerMarker) map.removeLayer(centerMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);
  
  addressInput.value = "";
  document.getElementById("summaryPopup")?.classList.add("hidden");
  
  // Reset to default view
  map.setView([32.8407, -83.6324], 12);
  console.log("Map cleared.");
});
