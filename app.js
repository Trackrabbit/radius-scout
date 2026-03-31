// --- GLOBALS ---
let map, poiLayer, centerMarker, radiusCircle, currentCenter;
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
    busLines: { color: "#00ffff", label: "Bus" }
};

const routeColors = ["#00ffff", "#7fff00", "#ff00ff", "#ff4500", "#ffff00", "#00ff7f"];

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", () => {
    map = L.map("map", { zoomControl: false }).setView([32.8407, -83.6324], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    poiLayer = L.layerGroup().addTo(map);

    setupEventListeners();
});

// --- CORE FUNCTIONS ---
async function fetchFromOverpass(lat, lon, radius, options) {
    const offset = radius / 111320;
    const b = `${lat-offset},${lon-offset},${lat+offset},${lon+offset}`;
    let q = [];
    if(options.worship) q.push(`nwr["amenity"="place_of_worship"](${b});`);
    if(options.schools) q.push(`nwr["amenity"="school"](${b});`);
    if(options.colleges) q.push(`nwr["amenity"~"college|university"](${b});`);
    if(options.kindergarten) q.push(`nwr["amenity"="kindergarten"](${b});`);
    if(options.daycare) q.push(`nwr["amenity"~"childcare|daycare"](${b});`);
    if(options.libraries) q.push(`nwr["amenity"="library"](${b});`);
    if(options.parks) q.push(`nwr["leisure"="park"](${b});`);
    if(options.playgrounds) q.push(`nwr["leisure"="playground"](${b});`);
    if(options.pools) q.push(`nwr["leisure"="swimming_pool"](${b});`);
    if(options.busLines) q.push(`relation["route"="bus"](${b});`);

    if(!q.length) return [];
    const query = `[out:json][timeout:25];(${q.join("")});out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(query) });
    const data = await res.json();
    return data.elements || [];
}

function addPoisToMap(elements, radiusMeters) {
    poiLayer.clearLayers();
    activeBusLayers = {};
    const counts = { worship: 0, school: 0, college: 0, kindergarten: 0, daycare: 0, library: 0, park: 0, playground: 0, pool: 0, busLines: 0 };
    let busIdx = 0; let legendHtml = "";
    const bounds = L.latLngBounds([currentCenter.lat, currentCenter.lon]);
    let hasItems = false;

    elements.forEach(el => {
        if(el.type === "relation" && el.tags.route === "bus") {
            hasItems = true; counts.busLines++;
            const color = routeColors[busIdx % routeColors.length];
            const isDashed = busIdx % 2 !== 0;
            const rid = `r-${el.id}`;
            legendHtml += `<div class="legend-route" onmouseover="highlightRoute('${rid}')" onmouseout="unhighlightRoute('${rid}')">
                <div class="route-line-preview" style="background:${color}; border-top:${isDashed?'2px dashed #0a0c10':'none'}"></div>
                <span class="route-label">${el.tags.ref || 'Bus'}</span>
            </div>`;
            busIdx++;
            let coords = el.members.filter(m => m.geometry).map(m => m.geometry.map(p => [p.lat, p.lon]));
            const poly = L.polyline(coords, { color: color, weight: 7, opacity: 0.5, className: 'bus-route-glow', dashArray: isDashed?"10,10":null }).addTo(poiLayer);
            activeBusLayers[rid] = { layer: poly, style: { weight: 7, opacity: 0.5 } };
            bounds.extend(poly.getBounds());
        } else {
            const cat = categorize(el);
            if(!cat) return;
            const pos = [el.lat || el.center.lat, el.lon || el.center.lon];
            if(map.distance(pos, [currentCenter.lat, currentCenter.lon]) > radiusMeters) return;
            hasItems = true; counts[cat]++;
            L.marker(pos, { icon: L.divIcon({ html: `<div style="background:${poiStyles[cat].color}; width:12px; height:12px; border-radius:50%; border:2px solid black;"></div>`, iconSize:[12,12], className:'' }) }).bindPopup(poiStyles[cat].label).addTo(poiLayer);
            bounds.extend(pos);
        }
    });

    updateUI(counts, legendHtml);
    if(hasItems) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
}

function categorize(el) {
    const t = el.tags; if(!t) return null;
    if(t.amenity === "place_of_worship") return "worship";
    if(t.amenity === "school") return "school";
    if(t.amenity === "university" || t.amenity === "college") return "college";
    if(t.amenity === "kindergarten") return "kindergarten";
    if(t.amenity === "childcare") return "daycare";
    if(t.amenity === "library") return "library";
    if(t.leisure === "park") return "park";
    if(t.leisure === "playground") return "playground";
    if(t.leisure === "swimming_pool") return "pool";
    return null;
}

function updateUI(counts, legend) {
    const ids = { worship:"countWorship", school:"countSchools", college:"countColleges", kindergarten:"countKindergarten", daycare:"countDaycare", library:"countLibraries", park:"countParks", playground:"countPlaygrounds", pool:"countPools", busLines:"countBusLines" };
    Object.keys(ids).forEach(k => document.getElementById(ids[k]).textContent = counts[k]);
    document.getElementById("busLegend").innerHTML = legend;
    document.getElementById("transitLegend").style.display = legend ? "block" : "none";
    document.getElementById("summaryPopup").classList.remove("hidden");
}

function highlightRoute(id) { if(activeBusLayers[id]) { activeBusLayers[id].layer.setStyle({ weight: 14, opacity: 1 }).bringToFront(); } }
function unhighlightRoute(id) { if(activeBusLayers[id]) { activeBusLayers[id].layer.setStyle(activeBusLayers[id].style); } }

// --- EVENTS ---
function setupEventListeners() {
    document.getElementById("searchBtn").addEventListener("click", async () => {
        const addr = document.getElementById("addressInput").value;
        const rad = parseInt(document.getElementById("radiusSelect").value);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
        const data = await res.json();
        if(!data.length) return alert("Not found");
        
        currentCenter = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        if(centerMarker) map.removeLayer(centerMarker);
        if(radiusCircle) map.removeLayer(radiusCircle);

        centerMarker = L.marker([currentCenter.lat, currentCenter.lon]).addTo(map);
        radiusCircle = L.circle([currentCenter.lat, currentCenter.lon], { radius: rad, color: '#4fd1c5', fillOpacity: 0.15, weight: 3, dashArray: '10,5', className: 'circle-glow' }).addTo(map);

        const opts = { 
            worship: document.getElementById("poiWorship").checked, schools: document.getElementById("poiSchools").checked,
            colleges: document.getElementById("poiColleges").checked, kindergarten: document.getElementById("poiKindergarten").checked,
            daycare: document.getElementById("poiDaycare").checked, libraries: document.getElementById("poiLibraries").checked,
            parks: document.getElementById("poiParks").checked, playgrounds: document.getElementById("poiPlaygrounds").checked,
            pools: document.getElementById("poiPools").checked, busLines: document.getElementById("poiBusLines").checked
        };
        const els = await fetchFromOverpass(currentCenter.lat, currentCenter.lon, rad, opts);
        addPoisToMap(els, rad);
    });

    document.getElementById("toggleAllBtn").addEventListener("click", (e) => {
        const cbs = document.querySelectorAll(".checkbox-grid input");
        const all = Array.from(cbs).every(c => c.checked);
        cbs.forEach(c => c.checked = !all);
        e.target.textContent = all ? "Select All" : "Deselect All";
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
        poiLayer.clearLayers();
        if(centerMarker) map.removeLayer(centerMarker);
        if(radiusCircle) map.removeLayer(radiusCircle);
        document.getElementById("summaryPopup").classList.add("hidden");
    });
}
