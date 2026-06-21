// =========================
// CONFIG
// =========================

const POI_CONFIG = {

  worship:{
    label:'Worship',
    icon:'⛪',
    groups:['family','community'],
    default:true,
    filters:[
      ['amenity','place_of_worship']
    ]
  },

  school:{
    label:'Schools',
    icon:'🏫',
    groups:['family'],
    default:true,
    filters:[
      ['amenity','school']
    ]
  },

  college:{
    label:'Colleges',
    icon:'🎓',
    groups:['family'],
    default:true,
    filters:[
      ['amenity','college'],
      ['amenity','university']
    ]
  },

  kindergarten:{
    label:'Kinder',
    icon:'🧒',
    groups:['family'],
    default:true,
    filters:[
      ['amenity','kindergarten']
    ]
  },

  daycare:{
    label:'Daycare',
    icon:'👶',
    groups:['family'],
    default:true,
    filters:[
      ['amenity','childcare']
    ]
  },

  library:{
    label:'Libraries',
    icon:'📚',
    groups:['family','community'],
    default:true,
    filters:[
      ['amenity','library']
    ]
  },

  park:{
    label:'Parks',
    icon:'🌳',
    groups:['family','recreation'],
    default:true,
    filters:[
      ['leisure','park']
    ]
  },

  playground:{
    label:'Playgrounds',
    icon:'🛝',
    groups:['family','recreation'],
    default:true,
    filters:[
      ['leisure','playground']
    ]
  },

  pool:{
    label:'Pools',
    icon:'🏊',
    groups:['recreation'],
    default:true,
    filters:[
      ['leisure','swimming_pool']
    ]
  },

  bus_stop:{
    label:'Bus Stops',
    icon:'🚌',
    groups:['transportation'],
    default:true,
    filters:[
      ['highway','bus_stop']
    ]
  },

  bus_station:{
    label:'Bus Stations',
    icon:'🚏',
    groups:['transportation'],
    default:true,
    filters:[
      ['amenity','bus_station']
    ]
  },

  apartments:{
    label:'Apartments',
    icon:'🏢',
    groups:['business','realestate'],
    default:true,
    filters:[
      ['building','apartments'],
      ['building','residential']
    ]
  },

  restaurant:{
    label:'Restaurants',
    icon:'🍽️',
    groups:['dining','business'],
    default:false,
    filters:[
      ['amenity','restaurant']
    ]
  },

  cafe:{
    label:'Cafes',
    icon:'☕',
    groups:['dining'],
    default:false,
    filters:[
      ['amenity','cafe']
    ]
  },

  shop:{
    label:'Stores',
    icon:'🛍️',
    groups:['dining','business'],
    default:false,
    filters:[
      ['shop','*']
    ]
  },

  office:{
    label:'Offices',
    icon:'💼',
    groups:['business'],
    default:false,
    filters:[
      ['office','*']
    ]
  },

  hotel:{
    label:'Hotels',
    icon:'🏨',
    groups:['business'],
    default:false,
    filters:[
      ['tourism','hotel'],
      ['tourism','motel'],
      ['tourism','guest_house']
    ]
  },

  hospital:{
    label:'Hospitals',
    icon:'🏥',
    groups:['essential'],
    default:false,
    filters:[
      ['amenity','hospital']
    ]
  },

  pharmacy:{
    label:'Pharmacies',
    icon:'💊',
    groups:['essential'],
    default:false,
    filters:[
      ['amenity','pharmacy']
    ]
  },

  police:{
    label:'Police',
    icon:'👮',
    groups:['essential'],
    default:false,
    filters:[
      ['amenity','police']
    ]
  },

  fire_station:{
    label:'Fire Stations',
    icon:'🚒',
    groups:['essential'],
    default:false,
    filters:[
      ['amenity','fire_station']
    ]
  },

  fuel:{
    label:'Gas Stations',
    icon:'⛽',
    groups:['essential','transportation'],
    default:false,
    filters:[
      ['amenity','fuel']
    ]
  },

  grocery:{
    label:'Groceries',
    icon:'🛒',
    groups:['essential','family'],
    default:false,
    filters:[
      ['shop','supermarket']
    ]
  }

};

// =========================
// PRESETS
// =========================

const POI_PRESETS = {

  family:[
    'school',
    'college',
    'kindergarten',
    'daycare',
    'library',
    'park',
    'playground',
    'pool',
    'worship',
    'grocery'
  ],

  essentials:[
    'hospital',
    'pharmacy',
    'police',
    'fire_station',
    'fuel',
    'grocery'
  ],

  investor:[
    'apartments',
    'restaurant',
    'shop',
    'bus_stop',
    'bus_station'
  ],

  recreation:[
    'park',
    'playground',
    'pool'
  ]

};

// =========================
// POI GROUPS
// =========================

const POI_GROUPS = {

  family: "🏠 Family & Community",

  essential: "🚨 Essential Services",

  transportation: "🚌 Transportation",

  dining: "🍔 Dining & Shopping",

  business: "🏢 Housing & Business",

  recreation: "🌳 Recreation",

  community: "🤝 Community",

  realestate: "🏠 Real Estate"

};

// =========================
// GROUP POI UTILITY
// =========================

function groupPOIs() {
  const groups = {};

  Object.entries(POI_CONFIG).forEach(([key, poi]) => {

    poi.groups.forEach(group => {

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push({ key, ...poi });

    });

  });

  return groups;
}

function getGroupState(groupItems) {

  let activeCount = 0;

  groupItems.forEach(poi => {
    if (POI_STATE[poi.key]) activeCount++;
  });

  if (activeCount === 0) return 'none';
  if (activeCount === groupItems.length) return 'all';
  return 'partial';
}

// =========================
// ADDRESS CLEANUP
// =========================

function cleanAddress(address) {
  return address
    .trim()
    .replace(/\s+/g, ' ')      // collapse multiple spaces
    .replace(/,+/g, ',')       // collapse multiple commas
    .replace(/\s*,\s*/g, ', ') // normalize comma spacing
    .replace(/\n/g, ' ');      // remove line breaks
}

// =========================
// MAP
// =========================

const map = L.map('map');

if (navigator.geolocation) {

  navigator.geolocation.getCurrentPosition(

    pos => {

      map.setView(
        [
          pos.coords.latitude,
          pos.coords.longitude
        ],
        13
      );

    },

    () => {

      map.setView([20,0],2);

    }

  );

} else {

  map.setView([20,0],2);

}

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

let selectedLocation = null;

let autocompleteTimer = null;

let matchedAddressBackup = '';

const POI_STATE = {};

// initialize state from config defaults
Object.keys(POI_CONFIG).forEach(key => {
  POI_STATE[key] = POI_CONFIG[key].default || false;
});

// =========================
// UI
// =========================

const poiContainer = document.getElementById('poiContainer');
const summaryGrid = document.getElementById('summaryGrid');

// clear containers (important if re-render ever happens later)

poiContainer.innerHTML = '';
summaryGrid.innerHTML = '';

const grouped = groupPOIs();


// Track summary cards so we can still update counts

const summaryCards = {};

Object.entries(grouped).forEach(([groupKey, items]) => {

  const group = document.createElement('div');
  group.className = 'poi-group';

  // HEADER
  const header = document.createElement('div');
  header.className = 'poi-group-header';

  header.innerHTML = `
    <div>
      ${POI_GROUPS[groupKey] || groupKey}
      <span class="group-indicator" style="margin-left:6px;color:#94a3b8;"></span>
    </div>
    <div class="poi-arrow">⌄</div>
  `;

  const indicator = header.querySelector('.group-indicator');

  function updateHeaderUI() {

    const state = getGroupState(items);

    let symbol = '○';

    if (state === 'all') symbol = '●';
    if (state === 'partial') symbol = '◐';

    indicator.textContent = symbol;

  }

  // CONTENT
  const content = document.createElement('div');
  content.className = 'poi-group-content';

  items.forEach(poi => {

    const chip = document.createElement('div');
    chip.className = 'poi-chip';
    chip.dataset.key = poi.key;

    if (POI_STATE[poi.key]) {
      chip.classList.add('active');
    }

    chip.innerHTML = `${poi.icon} ${poi.label}`;

    chip.onclick = () => {

      POI_STATE[poi.key] = !POI_STATE[poi.key];

      chip.classList.toggle(
        'active',
        POI_STATE[poi.key]
      );

      updateHeaderUI();

    };

    content.appendChild(chip);

  });

  header.onclick = () => {

    group.classList.toggle('open');

  };

  updateHeaderUI();

  group.appendChild(header);
  group.appendChild(content);

  poiContainer.appendChild(group);

});

// =========================
// SUMMARY CARDS (unchanged but preserved)
// =========================

Object.entries(POI_CONFIG).forEach(([key, poi]) => {

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

  card.onclick = () => toggleFilter(key);

  summaryGrid.appendChild(card);

  summaryCards[key] = card;

});

// =========================
// INPUT LISTENER
// =========================

document
  .getElementById('addressInput')
  .addEventListener('input', e=>{

    selectedLocation = null;

    clearTimeout(autocompleteTimer);

    const query =
      e.target.value.trim();

    if(query.length < 3){

      document
        .getElementById('addressSuggestions')
        .style.display = 'none';

      return;
    }

    autocompleteTimer =
      setTimeout(async ()=>{

        try{

          const results =
            await searchAddresses(query);

          renderSuggestions(results);

        }catch(err){

          console.error(err);

        }

      },300);

  });

document
  .getElementById('addressInput')
  .addEventListener('keydown', e => {

    if (e.key === 'Enter') {

      e.preventDefault();

      document
        .getElementById('searchBtn')
        .click();
    }

  });

// =========================
// HELPERS
// =========================

function resetMapView(){

  if(navigator.geolocation){

    navigator.geolocation.getCurrentPosition(

      pos => {

        map.setView(
          [
            pos.coords.latitude,
            pos.coords.longitude
          ],
          13
        );

      },

      () => {

        map.setView([20,0],2);

      }

    );

  }else{

    map.setView([20,0],2);

  }

}

function selectedPOI(){
  return Object.entries(POI_STATE)
    .filter(([_, val]) => val)
    .map(([key]) => key);
}

function updateURLState(center, radius) {

  const params = new URLSearchParams();

  params.set('lat', center.lat);
  params.set('lon', center.lon);
  params.set('radius', radius);
  params.set('poi', selectedPOI().join(','));

  history.replaceState(
    {},
    '',
    `${window.location.pathname}?${params.toString()}`
  );

}

function showLoading(show){

  const matched =
    document.getElementById('matchedAddress');

  if(show){

    matchedAddressBackup = matched.innerHTML;

    matched.innerHTML = `
      <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">
        Searching...
      </div>
      <div>
        Finding nearby locations.
      </div>
    `;

  } else if(matchedAddressBackup){

    matched.innerHTML = matchedAddressBackup;

  }

}

async function reverseGeocode(lat, lon){

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
  );

  const data = await response.json();

  return data.display_name || '';
}

async function geocode(address){

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
  );

  const data = await response.json();

  if(!data.length){
    throw new Error('Address not found');
  }

  const matchedAddress =
    document.getElementById('matchedAddress');

  matchedAddress.style.display = 'block';

  matchedAddress.innerHTML = `
    <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">
      Matched Address
    </div>
    <div>
      ${data[0].display_name}
    </div>
  `;

  return {
    lat:+data[0].lat,
    lon:+data[0].lon
  };
}

async function searchAddresses(query){

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`
  );

  return await response.json();

}

function renderSuggestions(results){

  const container =
    document.getElementById('addressSuggestions');

  if(!results.length){

    container.style.display = 'none';

    return;
  }

  container.innerHTML = '';

  results.forEach(result=>{

    const item =
      document.createElement('div');

    item.className =
      'suggestion-item';

    item.innerHTML = `
      <div class="suggestion-main">
        ${result.display_name.split(',')[0]}
      </div>

      <div class="suggestion-secondary">
        ${result.display_name}
      </div>
    `;

    item.onclick = ()=>{

      selectedLocation = result;

      document
        .getElementById('addressInput')
        .value = result.display_name;

      document
        .getElementById('matchedAddress')
        .innerHTML = `
          <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">
            Selected Address
          </div>
          <div>
            ${result.display_name}
          </div>
        `;

      container.style.display = 'none';

      setTimeout(() => {

        document
          .getElementById('searchBtn')
          .click();

      }, 100);

    };

    container.appendChild(item);

  });

  container.style.display = 'block';

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

    const address = cleanAddress(
        document.getElementById('addressInput').value
    );
    
    // If we already have coordinates from URL or location button,
    // don't require an address.
    if (!address && !selectedLocation) {
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

    let center;

    if(selectedLocation){
    
      center = {
        lat:Number(selectedLocation.lat),
        lon:Number(selectedLocation.lon)
      };
    
    }else{
    
      center = await geocode(address);
    
    }

    map.setView([center.lat, center.lon], 15);

    // Radius

    if(radiusCircle){
      map.removeLayer(radiusCircle);
    }

    radiusCircle = L.circle(
      [center.lat, center.lon],
      {
        radius,
        color:'#8b5cf6',
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

    // Fetch

    const results = await fetchPOI(
      center,
      radius,
      selected
    );

    updateURLState(center, radius);

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
                filter:drop-shadow(0 0 4px rgba(0,0,0,0.8));
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

    // Update summary

    Object.entries(counts).forEach(([key,val])=>{

      document
        .getElementById(`count-${key}`)
        .innerText = val;

    });

    // Mobile UX improvement

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
// LOCATION LOGIC
// =========================

document
  .getElementById('locationBtn')
  .onclick = () => {

    if(!navigator.geolocation){

      alert('Geolocation not supported');

      return;
    }

    showLoading(true);

    navigator.geolocation.getCurrentPosition(

      async position => {

        try{

          const lat =
            position.coords.latitude;

          const lon =
            position.coords.longitude;

          selectedLocation = {
            lat,
            lon
          };

          reverseGeocode(
            selectedLocation.lat,
            selectedLocation.lon
          ).then(address => {
          
            document.getElementById('addressInput').value = address;
          
            document.getElementById('matchedAddress').innerHTML = `
              <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">
                Shared Location
              </div>
              <div>${address}</div>
            `;
          
          });

          map.setView([lat, lon], 16);

          const address =
            await reverseGeocode(lat, lon);

          document
            .getElementById('addressInput')
            .value = address;

          document
            .getElementById('matchedAddress')
            .innerHTML = `
              <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">
                Current Location
              </div>
              <div>
                ${address}
              </div>
            `;

          document
            .getElementById('searchBtn')
            .click();

        }catch(err){

          console.error(err);

        }finally{

          showLoading(false);

        }

      },

      error => {

        showLoading(false);

        alert(
          'Unable to retrieve location. Please allow location access.'
        );

      },

      {
        enableHighAccuracy:true,
        timeout:10000,
        maximumAge:60000
      }

    );

  };
// =========================
// CLEAR
// =========================

document
  .getElementById('clearBtn')
  .onclick = ()=>{

    // Clear markers
    markerLayer.clearLayers();

    markersByType = {};

    // Remove radius circle
    if(radiusCircle){
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }

    // Clear selected location
    selectedLocation = null;

    // Clear address field
    document.getElementById('addressInput').value = '';

    // Clear suggestions
    document.getElementById('addressSuggestions').style.display = 'none';
    document.getElementById('addressSuggestions').innerHTML = '';

    // Reset matched address panel
    document.getElementById('matchedAddress').innerHTML = `
      <div style="opacity:.7;">
        Ready for a new search
      </div>
    `;

    // Reset summary counts
    Object.keys(POI_CONFIG).forEach(key => {

      document.getElementById(`count-${key}`).innerText = '0';

    });

    // Clear active summary filter
    activeFilter = null;

    Object.keys(POI_STATE).forEach(key => {
      POI_STATE[key] = POI_CONFIG[key].default || false;
    });
    
    document.querySelectorAll('.poi-chip').forEach(chip => {
    
      const key = chip.dataset.key;
    
      chip.classList.toggle('active', POI_STATE[key]);
    
    });
    
    // Close all accordion groups
    document.querySelectorAll('.poi-group').forEach(group => {
      group.classList.remove('open');
    });
    
    // Also collapse all groups (important UX reset)
    document.querySelectorAll('.poi-group').forEach(group => {
      group.classList.remove('open');
    });

    // Close popups
    map.closePopup();
    
    // Return map to default view
    resetMapView();
};

function loadURLState() {

  const params = new URLSearchParams(window.location.search);

  const lat = params.get('lat');
  const lon = params.get('lon');
  const radius = params.get('radius');
  const poi = params.get('poi');

  if (!lat || !lon) return;

  selectedLocation = {
    lat: Number(lat),
    lon: Number(lon)
  };

  if (radius) {
    document.getElementById('radiusSelect').value = radius;
  }

  // reset all POIs
  Object.keys(POI_STATE).forEach(key => {
    POI_STATE[key] = false;
  });

  if (poi) {

    poi.split(',').forEach(key => {

      if (POI_STATE.hasOwnProperty(key)) {
        POI_STATE[key] = true;
      }

    });

  }

  // sync chips
  document.querySelectorAll('.poi-chip').forEach(chip => {

    const key = chip.dataset.key;

    chip.classList.toggle(
      'active',
      POI_STATE[key]
    );

  });

  // trigger search
  document.getElementById('searchBtn').click();

}

document.addEventListener('click', e=>{

  if(
    !e.target.closest('.autocomplete-wrapper')
  ){

    document
      .getElementById('addressSuggestions')
      .style.display = 'none';

  }

});

loadURLState();
