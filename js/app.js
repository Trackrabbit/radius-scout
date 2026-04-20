const POI_CONFIG = {
  worship:{label:'Worship',icon:'⛪',default:true,filters:[['amenity','place_of_worship']]},
  school:{label:'School',icon:'🏫',default:true,filters:[['amenity','school']]},
  college:{label:'College',icon:'🎓',default:true,filters:[['amenity','college'],['amenity','university']]},
  kindergarten:{label:'Kinder',icon:'🧒',default:true,filters:[['amenity','kindergarten']]},
  daycare:{label:'Daycare',icon:'👶',default:true,filters:[['amenity','childcare']]},
  library:{label:'Library',icon:'📚',default:true,filters:[['amenity','library']]},
  park:{label:'Park',icon:'🌳',default:true,filters:[['leisure','park']]},
  playground:{label:'Play',icon:'🛝',default:true,filters:[['leisure','playground']]},
  pool:{label:'Pool',icon:'🏊',default:true,filters:[['leisure','swimming_pool']]},
  bus_stop:{label:'Bus Stop',icon:'🚌',default:true,filters:[['highway','bus_stop']]},
  bus_station:{label:'Bus Station',icon:'🚏',default:true,filters:[['amenity','bus_station']]},
  apartments:{label:'Apartments',icon:'🏢',default:true,filters:[['building','apartments'],['building','residential']]},
  restaurant:{label:'Restaurant',icon:'🍽️',default:false,filters:[['amenity','restaurant']]},
  shop:{label:'Store',icon:'🛍️',default:false,filters:[['shop','*']]},
  cafe:{label:'Cafe',icon:'☕',default:false,filters:[['amenity','cafe']]},
  office:{label:'Office',icon:'💼',default:false,filters:[['office','*']]},
  hotel:{label:'Hotel',icon:'🏨',default:false,filters:[['tourism','hotel'],['tourism','motel'],['tourism','guest_house']]}
};

const map = L.map('map').setView([32.84,-83.63],12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

let markers = L.layerGroup().addTo(map);
let markersByType = {};
let activeFilter = null;
let circle;

const chips = document.getElementById('poiChips');
const summary = document.getElementById('summary');

// Build UI
Object.entries(POI_CONFIG).forEach(([k,p],i)=>{
  let chip=document.createElement('div');
  chip.className='chip';
  chip.innerText=p.icon+' '+p.label;
  if(p.default) chip.classList.add('active');
  chip.onclick=()=>chip.classList.toggle('active');
  chips.appendChild(chip);

  let s=document.createElement('div');
  s.id='sum-'+k;
  s.innerHTML=p.icon+' '+p.label+': <span id="count-'+k+'">0</span>';
  s.onclick=()=>filter(k);
  summary.appendChild(s);
});

function selected(){
  return [...chips.children]
    .map((c,i)=>c.classList.contains('active')?Object.keys(POI_CONFIG)[i]:null)
    .filter(Boolean);
}

async function geo(a){
  let r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(a)}`);
  let j=await r.json();
  return {lat:+j[0].lat,lon:+j[0].lon};
}

function query(c,r,keys){
  let q=[];
  keys.forEach(k=>{
    POI_CONFIG[k].filters.forEach(([t,v])=>{
      if(v==='*'){
        q.push(`node["${t}"](around:${r},${c.lat},${c.lon});`);
        q.push(`way["${t}"](around:${r},${c.lat},${c.lon});`);
        q.push(`relation["${t}"](around:${r},${c.lat},${c.lon});`);
      } else {
        q.push(`node["${t}"="${v}"](around:${r},${c.lat},${c.lon});`);
        q.push(`way["${t}"="${v}"](around:${r},${c.lat},${c.lon});`);
        q.push(`relation["${t}"="${v}"](around:${r},${c.lat},${c.lon});`);
      }
    });
  });
  return `[out:json];(${q.join('')});out center;`;
}

async function fetchPOI(c,r,k){
  let res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:query(c,r,k)});
  return (await res.json()).elements;
}

function match(tags){
  for(const [k,p] of Object.entries(POI_CONFIG)){
    for(const [t,v] of p.filters){
      if(v==='*' && tags[t]) return k;
      if(tags[t]===v) return k;
    }
  }
}

// Filter
function filter(k){
  document.querySelectorAll('.summary div').forEach(el=>el.classList.remove('active'));

  if(activeFilter===k){
    activeFilter=null;
    markers.clearLayers();
    Object.values(markersByType).flat().forEach(m=>markers.addLayer(m));
    return;
  }

  activeFilter=k;
  document.getElementById('sum-'+k).classList.add('active');

  markers.clearLayers();
  markersByType[k].forEach(m=>markers.addLayer(m));
}

// Search
document.getElementById('searchBtn').onclick = async () => {
  let addr = addressInput.value;
  let rad = +radiusSelect.value;
  let keys = selected();

  let c = await geo(addr);
  map.setView([c.lat,c.lon],15);

  if(circle) map.removeLayer(circle);
  circle = L.circle([c.lat,c.lon],{radius:rad}).addTo(map);

  markers.clearLayers();
  markersByType = {};
  let counts = {};

  Object.keys(POI_CONFIG).forEach(k=>{
    markersByType[k]=[];
    counts[k]=0;
  });

  let data = await fetchPOI(c,rad,keys);

  data.forEach(d=>{
    let lat = d.lat || (d.center && d.center.lat);
    let lon = d.lon || (d.center && d.center.lon);
    if(!lat) return;

    let k = match(d.tags) || keys[0];
    counts[k]++;

    let icon = L.divIcon({html:POI_CONFIG[k].icon});
    let m = L.marker([lat,lon],{icon});

    markersByType[k].push(m);
    markers.addLayer(m);
  });

  Object.entries(counts).forEach(([k,v])=>{
    document.getElementById('count-'+k).innerText=v;
  });
};

// Clear
document.getElementById('clearBtn').onclick = () => {
  markers.clearLayers();
  if(circle) map.removeLayer(circle);
  activeFilter=null;
};
