// =========================
// CONFIG
// =========================

const POI_CONFIG = {

  worship:{
    label:'Worship',
    icon:'⛪',
    default:true,
    filters:[['amenity','place_of_worship']]
  },

  school:{
    label:'Schools',
    icon:'🏫',
    default:true,
    filters:[['amenity','school']]
  },

  college:{
    label:'Colleges',
    icon:'🎓',
    default:true,
    filters:[
      ['amenity','college'],
      ['amenity','university']
    ]
  },

  kindergarten:{
    label:'Kinder',
    icon:'🧒',
    default:true,
    filters:[['amenity','kindergarten']]
  },

  daycare:{
    label:'Daycare',
    icon:'👶',
    default:true,
    filters:[['amenity','childcare']]
  },

  library:{
    label:'Libraries',
    icon:'📚',
    default:true,
    filters:[['amenity','library']]
  },

  park:{
    label:'Parks',
    icon:'🌳',
    default:true,
    filters:[['leisure','park']]
  },

  playground:{
    label:'Play',
    icon:'🛝',
    default:true,
    filters:[['leisure','playground']]
  },

  pool:{
    label:'Pools',
    icon:'🏊',
    default:true,
    filters:[['leisure','swimming_pool']]
  },

  bus_stop:{
    label:'Bus Stops',
    icon:'🚌',
    default:true,
    filters:[['highway','bus_stop']]
  },

  bus_station:{
    label:'Bus Stations',
    icon:'🚏',
    default:true,
    filters:[['amenity','bus_station']]
  },

  apartments:{
    label:'Apartments',
    icon:'🏢',
    default:true,
    filters:[
      ['building','apartments'],
      ['building','residential']
    ]
  },

  restaurant:{
    label:'Restaurants',
    icon:'🍽️',
    default:false,
    filters:[['amenity','restaurant']]
  },

  shop:{
    label:'Stores',
    icon:'🛍️',
    default:false,
    filters:[['shop','*']]
  },

  cafe:{
    label:'Cafes',
    icon:'☕',
    default:false,
    filters:[['amenity','cafe']]
  },

  office:{
    label:'Offices',
    icon:'💼',
    default:false,
    filters:[['office','*']]
  },

  hotel:{
    label:'Hotels',
    icon:'🏨',
    default:false,
    filters:[
      ['tourism','hotel'],
      ['tourism','motel'],
      ['tourism','guest_house']
    ]
  }

};

// =========================
// MAP
// =========================

const map = L.map('map').setView([32.84,-83.63],12);

// PREMIUM LIGHT MAP

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  {
    attribution:'© OpenStreetMap © CARTO'
  }
).addTo(map);

let markerLayer = L.layerGroup().addTo(map);

let markersByType = {};

let activeFilter = null;

let radiusCircle = null;

// =========================
// UI
// =========================

const poiContainer = document.getElementById('poiContainer');
const summaryGrid = document.getElementById('summaryGrid');

Object.entries(POI_CONFIG).forEach(([key,poi])=>{

  // Chips

  const chip = document.createElement('div');

  chip.className = 'poi-chip';

  if(poi.default){
    chip.classList.add('active');
  }

  chip.dataset.key = key;

  chip.innerHTML = `${poi.icon} ${poi.label}`;

  chip.onclick = ()=>{

    chip.classList.toggle('active');

  };

  poiContainer.appendChild(chip);

  // Summary cards

  const card = document.createElement('div');

  card.className = 'summary-card';

  card.id = `summary-${key}`;

  card.innerHTML = `
    <div class="summary-label">
      ${poi.icon} ${poi.label}
    </div>

    <div class="summary-value" id="count-${key}">
      0
    </div>
  `;

  card.onclick = ()=>toggleFilter(key);

  summaryGrid.appendChild(card);

});

// =========================
// HELPERS
// =========================

function selectedPOI(){

  return [...document.querySelectorAll('.poi-chip.active')]
    .map(el=>el.dataset.key);

}

function showLoading(show){

  document
    .getElementById('loading')
    .classList.toggle('hidden', !show);

}

async function geocode(address){

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
  );

  const data = await response.json();

  if(!data.length){
    throw new Error('Address not found');
  }

  return {
    lat:+data[0].lat,
    lon:+data[0].lon
  };

}

function buildQuery(center, radius, keys){

  let queryParts = [];

  keys.forEach(key=>{

    const poi = POI_CONFIG[key];

    poi.filters.forEach(([tag,val])=>{

      if(val === '*'){

        queryParts.push(
          `nwr["${tag}"](around:${radius},${center.lat},${center.lon});`
        );

      } else {

        queryParts.push(
          `nwr["${tag}"="${val}"](around:${radius},${center.lat},${center.lon});`
        );

      }

    });

  });

  return `
[out:json][timeout:25];
(
  ${queryParts.join('\n')}
);
out center;
`;

}

async function fetchPOI(center, radius, keys){

  const query = buildQuery(center, radius, keys);

  const response = await fetch(
    'https://overpass-api.de/api/interpreter',
    {
      method:'POST',
      body:query
    }
  );

  const data = await response.json();

  return data.elements || [];

}

function matchPOI(tags){

  for(const [key,poi] of Object.entries(POI_CONFIG)){

    for(const [tag,val] of poi.filters){

      if(val === '*' && tags?.[tag]){
        return key;
      }

      if(tags?.[tag] === val){
        return key;
      }

    }

  }

  return null;

}

// =========================
// FILTER
// =========================

function toggleFilter(key){

  document
    .querySelectorAll('.summary-card')
    .forEach(el=>el.classList.remove('active'));

  if(activeFilter === key){

    activeFilter = null;

    markerLayer.clearLayers();

    Object.values(markersByType)
      .flat()
      .forEach(marker=>markerLayer.addLayer(marker));

    return;

  }

  activeFilter = key;

  document
    .getElementById(`summary-${key}`)
    .classList.add('active');

  markerLayer.clearLayers();

  markersByType[key]
    .forEach(marker=>markerLayer.addLayer(marker));

}

// =========================
// SEARCH
// =========================

document
  .getElementById('searchBtn')
  .onclick = async ()=>{

  try{

    const address =
      document.getElementById('addressInput').value.trim();

    if(!address){
      alert('Enter an address');
      return;
    }

    const radius =
      +document.getElementById('radiusSelect').value;

    const selected = selectedPOI();

    if(!selected.length){
      alert('Select at least one POI');
      return;
    }

    showLoading(true);

    // Geocode

    const center = await geocode(address);

    map.setView([center.lat, center.lon], 15);

    // Radius Circle

    if(radiusCircle){
      map.removeLayer(radiusCircle);
    }

    radiusCircle = L.circle(
      [center.lat, center.lon],
      {
        radius,
        color:'#8b5cf6',
        fillColor:'#8b5cf6',
        fillOpacity:0.12,
        weight:2,
        dashArray:'4'
      }
    ).addTo(map);

    // Reset

    markerLayer.clearLayers();

    markersByType = {};

    let counts = {};

    Object.keys(POI_CONFIG).forEach(key=>{

      markersByType[key] = [];

      counts[key] = 0;

    });

    // Fetch POI

    const results = await fetchPOI(
      center,
      radius,
      selected
    );

    // Render

    results.forEach(item=>{

      const lat =
        item.lat ||
        item.center?.lat;

      const lon =
        item.lon ||
        item.center?.lon;

      if(!lat || !lon){
        return;
      }

      let type =
        matchPOI(item.tags);

      if(!type || !selected.includes(type)){
        type = selected[0];
      }

      counts[type]++;

      const marker = L.marker(
        [lat, lon],
        {
          icon:L.divIcon({
            className:'custom-marker',
            html:`
              <div style="
                font-size:20px;
                filter:drop-shadow(0 0 4px rgba(0,0,0,0.5));
              ">
                ${POI_CONFIG[type].icon}
              </div>
            `
          })
        }
      );

      marker.bindPopup(`
        <strong>
          ${item.tags?.name || POI_CONFIG[type].label}
        </strong>
      `);

      markersByType[type].push(marker);

      markerLayer.addLayer(marker);

    });

    // Update Summary

    Object.entries(counts).forEach(([key,val])=>{

      document
        .getElementById(`count-${key}`)
        .innerText = val;

    });

    // Mobile UX Improvement

    if(window.innerWidth <= 768){

      document
        .querySelector('.panel')
        .scrollTo({
          top:9999,
          behavior:'smooth'
        });

    }

  } catch(error){

    console.error(error);

    alert(error.message || 'Search failed');

  } finally {

    showLoading(false);

  }

};

// =========================
// CLEAR
// =========================

document
  .getElementById('clearBtn')
  .onclick = ()=>{

  markerLayer.clearLayers();

  if(radiusCircle){
    map.removeLayer(radiusCircle);
  }

  activeFilter = null;

  document
    .querySelectorAll('.summary-card')
    .forEach(el=>el.classList.remove('active'));

};
