// --- Globals ---
const map = L.map("map").setView([32.8407, -83.6324], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    className: 'map-tiles'
}).addTo(map);

let centerMarker = null;
let radiusCircle = null;
let poiLayer = L.layerGroup().addTo(map);
let currentCenter = null;
let activeBusLayers = {}; 

const poiStyles = {
    worship: { color: "#f56565", label: "Worship" },
    school: { color: "#ecc94b", label: "School" },
    college: { color: "#ed64a6", label: "College" },
    kindergarten: { color: "#ed8936", label: "Kindergarten" },
    daycare: { color: "#9f7aea", label: "Daycare" },
    library: { color: "#667eea", label: "Library" },
    park: { color: "#48bb78", label: "Park" },
    playground: { color: "#38b2ac", label: "Playground" },
    pool: { color: "#4299e1", label: "Pool" },
    busLines: { color: "#00ffff", label: "Bus Route" }
};

const routeColors = ["#00ffff", "#7fff00", "#ff00ff", "#ff4500", "#ffff00", "#00ff7f"];

// --- Helpers ---
function createPoiIcon(color) {
    return L.divIcon({
        className: "custom-icon",
        html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid black;"></div>`,
        iconSize: [12, 12]
    });
}

function categorizeElement(el) {
    const t = el.tags; if (!t) return null;
    if (t.route === "bus") return "busLines";
    if (t.amenity === "place_of_worship") return "worship";
    if (t.amenity === "school") return "school";
    if (t.amenity === "college" || t.amenity === "university") return "college";
    if (t.amenity === "kindergarten") return "kindergarten";
    if (t.amenity === "childcare") return "daycare";
    if (t.amenity === "library") return "library";
    if (t.leisure === "park") return "park";
    if (t.leisure === "playground") return "playground";
    if (t.leisure === "swimming_pool") return "pool";
    return null;
}

// --- Core Logic ---
async function fetchFromOverpass(lat, lon, radius, options) {
    const offset = radius / 111320;
    const b = `${lat-offset},${lon-offset},${lat+offset},${lon+offset}`;
    let queries = [];
    if (options.worship) queries.push(`nwr["amenity"="place_of_worship"](${b});`);
    if (options.schools) queries.push(`nwr["amenity"="school"](${b});`);
    if (options.busLines) queries.push(`relation["route"="bus"](${b});`);
    // ... add other options as needed ...

    const query = `[out:json][timeout:25];(${queries.join("")});out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query)
    });
    const data = await res.json();
    return data.elements || [];
}

function addPoisToMap(elements, radiusMeters) {
    poiLayer.clearLayers();
    activeBusLayers = {};
    const counts = { worship: 0, school: 0, college: 0, kindergarten: 0, daycare: 0, library: 0, park: 0, playground: 0, pool: 0, busLines: 0 };
    let busIdx = 0; let legendHtml = "";
    const bounds = L.latLngBounds([currentCenter.lat, currentCenter.lon]);

    elements.forEach(el => {
        if (el.type === "relation" && el.tags.route === "bus") {
            counts.busLines++;
            const color = routeColors[busIdx % routeColors.length];
            const isDashed = busIdx % 2 !== 0;
            const rid = `r-${el.id}`;
            legendHtml += `<div class="legend-route" onmouseover="highlightRoute('${rid}')" onmouseout="unhighlightRoute('${rid}')">
                <div class="route-line-preview" style="color:${color}; background:${color}; border-top:${isDashed?'2px dashed black':'none'}"></div>
                <span class="route-label">${el.tags.ref || 'Bus'}</span>
            </div>`;
            busIdx++;
            
            let coords = el.members.filter(m => m.geometry).map(m => m.geometry.map(p => [p.lat, p.lon]));
            const poly = L.polyline(coords, { color: color, weight: 6, opacity: 0.5, className: 'bus-route-glow', dashArray: isDashed?"10,10":null }).addTo(poiLayer);
            activeBusLayers[rid] = { layer: poly, style: { weight: 6, opacity: 0.5 } };
            bounds.extend(poly.getBounds());
        } else {
            const cat = categorizeElement(el);
            if (!cat) return;
            const pos = [el.lat || el.center.lat, el.lon || el.center.lon];
            if (map.distance(pos, [currentCenter.lat, currentCenter.lon]) > radiusMeters) return;
            counts[cat]++;
            L.marker(pos, { icon: createPoiIcon(poiStyles[cat].color) }).addTo(poiLayer);
            bounds.extend(pos);
        }
    });

    updateSummary(counts, legendHtml);
    map.fitBounds(bounds, { padding: [30, 30] });
}

function updateSummary(counts, legend) {
    document.getElementById("countBusLines").textContent = counts.busLines;
    // ... add other textContent updates ...
    const leg = document.getElementById("busLegend");
    leg.innerHTML = legend;
    document.getElementById("transitLegend").style.display = legend ? "block" : "none";
    document.getElementById("summaryPopup").classList.remove("hidden");
}

function highlightRoute(id) { if(activeBusLayers[id]) activeBusLayers[id].layer.setStyle({weight:12, opacity:1}).bringToFront(); }
function unhighlightRoute(id) { if(activeBusLayers[id]) activeBusLayers[id].layer.setStyle(activeBusLayers[id].style); }

// --- UI Events ---
document.getElementById("searchBtn").addEventListener("click", async () => {
    const addr = document.getElementById("addressInput").value;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${addr}`);
    const data = await res.json();
    if(data.length > 0) {
        currentCenter = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        map.setView([currentCenter.lat, currentCenter.lon], 15);
        const els = await fetchFromOverpass(currentCenter.lat, currentCenter.lon, 305, { busLines: true, worship: true, schools: true });
        addPoisToMap(els, 305);
    }
});

// Smart Toggle
document.getElementById("toggleAllBtn").addEventListener("click", (e) => {
    const cbs = document.querySelectorAll(".checkbox-grid input");
    const all = Array.from(cbs).every(c => c.checked);
    cbs.forEach(c => c.checked = !all);
    e.target.textContent = all ? "Select All" : "Deselect All";
});
