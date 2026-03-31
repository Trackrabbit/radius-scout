// --- GLOBAL STATE ---
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

// --- INITIALIZE APP ---
document.addEventListener("DOMContentLoaded", () => {
    map = L.map("map", { zoomControl: false }).setView([32.8407, -83.6324], 14);
    
    // Using a dark-themed tile set for neon lines to pop
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    poiLayer = L.layerGroup().addTo(map);

    setupEventListeners();
});

// --- DATA FETCHING ---
async function fetchFromOverpass(lat, lon, radius, opts) {
    const offset = radius / 111320;
    const b = `${lat - offset},${lon - offset},${lat + offset},${lon + offset}`;
    let q = [];
    
    if (opts.worship) q.push(`nwr["amenity"="place_of_worship"](${b});`);
    if (opts.schools) q.push(`nwr["amenity"="school"](${b});`);
    if (opts.colleges) q.push(`nwr["amenity"~"college|university"](${b});`);
    if (opts.kindergarten) q.push(`nwr["amenity"="kindergarten"](${b});`);
    if (opts.daycare) q.push(`nwr["amenity"~"childcare|daycare"](${b});`);
    if (opts.libraries) q.push(`nwr["amenity"="library"](${b});`);
    if (opts.parks) q.push(`nwr["leisure"="park"](${b});`);
    if (opts.playgrounds) q.push(`nwr["leisure"="playground"](${b});`);
    if (opts.pools) q.push(`nwr["leisure"="swimming_pool"](${b});`);
    if (opts.busLines) q.push(`relation["route"="bus"](${b});`);

    if (!q.length) return [];

    // The Query: [timeout:90] gives the server more time to think
    const query = `[out:json][timeout:90];(${q.join("")});out geom;`;
    
    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query)
    });

    if (!response.ok) {
        if (response.status === 429) throw new Error("Server Busy (Too Many Requests)");
        throw new Error(`Server Error: ${response.status}`);
    }

    const data = await response.json();
    return data.elements || [];
}

// --- MAP RENDERING ---
function addPoisToMap(elements, rad) {
    poiLayer.clearLayers();
    activeBusLayers = {};
    const counts = { worship:0, school:0, college:0, kindergarten:0, daycare:0, library:0, park:0, playground:0, pool:0, busLines:0 };
    let busIdx = 0; let legendHtml = "";

    elements.forEach(el => {
        if (el.type === "relation" && el.tags.route === "bus") {
            counts.busLines++;
            const color = routeColors[busIdx % routeColors.length];
            const rid = `r-${el.id}`;
            const isDash = busIdx % 2 !== 0;
            
            legendHtml += `<div class="legend-route" onmouseover="highlight('${rid}')" onmouseout="unhighlight('${rid}')" onclick="focusRoute('${rid}')">
                <div class="route-line-preview" style="background:${color}; border-top:${isDash?'2px dashed #0a0c10':'none'}"></div>
                <span class="route-label">${el.tags.ref || 'Bus'}</span>
            </div>`;
            busIdx++;

            let coords = el.members.filter(m => m.geometry).map(m => m.geometry.map(p => [p.lat, p.lon]));
            const poly = L.polyline(coords, { color: color, weight: 7, opacity: 0.5, className: 'bus-route-glow', dashArray: isDash?"10,10":null }).addTo(poiLayer);
            activeBusLayers[rid] = { layer: poly, style: { weight: 7, opacity: 0.5 } };
        } else {
            const cat = categorize(el);
            if (!cat) return;
            const pos = [el.lat || el.center.lat, el.lon || el.center.lon];
            if (map.distance(pos, [currentCenter.lat, currentCenter.lon]) > rad) return;
            counts[cat]++;
            L.marker(pos, { 
                icon: L.divIcon({ 
                    html: `<div style="background:${poiStyles[cat].color}; width:12px; height:12px; border-radius:50%; border:2px solid black; box-shadow: 0 0 5px ${poiStyles[cat].color};"></div>`, 
                    iconSize:[12,12], className:'' 
                }) 
            }).bindPopup(`<strong>${poiStyles[cat].label}</strong><br>${el.tags.name || "Unnamed"}`).addTo(poiLayer);
        }
    });

    updateUI(counts, legendHtml);
    // Deep Zoom on Search Center
    map.setView([currentCenter.lat, currentCenter.lon], 18, { animate: true });
}

function categorize(el) {
    const t = el.tags; if(!t) return null;
    if(t.amenity === "place_of_worship") return "worship";
    if(t.amenity === "school") return "school";
    if(t.amenity === "university" || t.amenity === "college") return "college";
    if(t.amenity === "kindergarten") return "kindergarten";
    if(t.amenity === "childcare" || t.amenity === "daycare") return "daycare";
    if(t.amenity === "library") return "library";
    if(t.leisure === "park") return "park";
    if(t.leisure === "playground") return "playground";
    if(t.leisure === "swimming_pool") return "pool";
    return null;
}

function updateUI(counts, leg) {
    const ids = { worship:"countWorship", school:"countSchools", college:"countColleges", kindergarten:"countKindergarten", daycare:"countDaycare", library:"countLibraries", park:"countParks", playground:"countPlaygrounds", pool:"countPools", busLines:"countBusLines" };
    Object.keys(ids).forEach(k => document.getElementById(ids[k]).textContent = counts[k]);
    document.getElementById("busLegend").innerHTML = leg;
    document.getElementById("transitLegend").style.display = leg ? "block" : "none";
    document.getElementById("summaryPopup").classList.remove("hidden");
}

// --- INTERACTIVE HELPERS ---
function highlight(id) { if(activeBusLayers[id]) activeBusLayers[id].layer.setStyle({ weight: 14, opacity: 1 }).bringToFront(); }
function unhighlight(id) { if(activeBusLayers[id]) activeBusLayers[id].layer.setStyle(activeBusLayers[id].style); }
function focusRoute(id) { if(activeBusLayers[id]) map.fitBounds(activeBusLayers[id].layer.getBounds(), { padding: [50, 50] }); }

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById("searchBtn").addEventListener("click", async () => {
        const btn = document.getElementById("searchBtn");
        const addr = document.getElementById("addressInput").value;
        const rad = parseInt(document.getElementById("radiusSelect").value);
        
        if(!addr) return alert("Please enter an address in Macon.");
        
        btn.textContent = "Searching...";
        btn.disabled = true;

        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
            const geoData = await geoRes.json();
            if(!geoData.length) throw new Error("Address not found.");

            currentCenter = { lat: parseFloat(geoData[0].lat), lon: parseFloat(geoData[0].lon) };
            
            if(centerMarker) map.removeLayer(centerMarker);
            if(radiusCircle) map.removeLayer(radiusCircle);

            centerMarker = L.marker([currentCenter.lat, currentCenter.lon]).addTo(map).bindPopup("Search Center");
            radiusCircle = L.circle([currentCenter.lat, currentCenter.lon], { 
                radius: rad, color: '#4fd1c5', fillOpacity: 0.1, weight: 3, dashArray: '10,5', className: 'circle-glow' 
            }).addTo(map);

            const opts = { 
                worship: document.getElementById("poiWorship").checked, 
                schools: document.getElementById("poiSchools").checked, 
                colleges: document.getElementById("poiColleges").checked,
                kindergarten: document.getElementById("poiKindergarten").checked, 
                daycare: document.getElementById("poiDaycare").checked, 
                libraries: document.getElementById("poiLibraries").checked,
                parks: document.getElementById("poiParks").checked, 
                playgrounds: document.getElementById("poiPlaygrounds").checked, 
                pools: document.getElementById("poiPools").checked, 
                busLines: document.getElementById("poiBusLines").checked 
            };

            const els = await fetchFromOverpass(currentCenter.lat, currentCenter.lon, rad, opts);
            addPoisToMap(els, rad);

        } catch (e) {
            alert(`Search Failed: ${e.message}`);
        } finally {
            btn.textContent = "Search Area";
            btn.disabled = false;
        }
    });

    document.getElementById("toggleAllBtn").addEventListener("click", (e) => {
        const cbs = document.querySelectorAll(".checkbox-grid input");
        const all = Array.from(cbs).every(c => c.checked);
        cbs.forEach(c => c.checked = !all);
        e.target.textContent = all ? "Select All" : "Deselect All";
    });

    document.querySelector('.checkbox-grid').addEventListener('change', () => {
        const cbs = document.querySelectorAll(".checkbox-grid input");
        const all = Array.from(cbs).every(c => c.checked);
        document.getElementById("toggleAllBtn").textContent = all ? "Deselect All" : "Select All";
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
        poiLayer.clearLayers();
        if(centerMarker) map.removeLayer(centerMarker);
        if(radiusCircle) map.removeLayer(radiusCircle);
        document.getElementById("summaryPopup").classList.add("hidden");
        document.getElementById("addressInput").value = "";
    });
}
