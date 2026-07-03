// =========================
// js/main.js
// =========================
import { POI_STATE, POI_CONFIG, selectedPOI } from './config.js';
import { initUI, showLoading, setMatchedAddress, updateSummaryCounts, resetUI } from './ui.js';
import { geocode, reverseGeocode, searchAddresses, fetchPOI } from './api.js';
import { map, initMap, clearMapData, drawRadius, renderMarkers, applyFilter, resetMapView, renderRealEstateMarkers } from './map.js';

// APP STATE
let searchInProgress = false;
let selectedLocation = null;

// REAL ESTATE
let lastSuccessfulSearch = null;

const hiddenTrigger = document.querySelector('.brand'); 

// =========================
// SIDEBAR UI TOGGLES
// =========================
const summaryToggle = document.getElementById('summary-toggle');
const summaryContent = document.getElementById('summary-content');
const summaryChevron = document.getElementById('summary-chevron');

if (summaryToggle && summaryContent) {
  summaryToggle.addEventListener('click', () => {
    // Toggle the collapsed class
    summaryContent.classList.toggle('collapsed');
    
    // Rotate the chevron arrow
    if (summaryContent.classList.contains('collapsed')) {
      summaryChevron.style.transform = 'rotate(-90deg)'; // Points left when closed
    } else {
      summaryChevron.style.transform = 'rotate(0deg)';   // Points down when open
    }
  });
}

if (hiddenTrigger) {
  // Don't change the cursor to a pointer so it remains a secret!
  
  hiddenTrigger.addEventListener('click', async () => {
    if (!lastSuccessfulSearch) {
      console.warn("Run a standard search first to establish a center point.");
      return;
    }

    console.log("🤫 Secret Real Estate Mode Activated!");
    
    try {
      // Pass our super secret 'real_estate' key to the proxy
      const realEstateData = await fetchPOI(
        lastSuccessfulSearch.center, 
        lastSuccessfulSearch.radius, 
        ['real_estate'] 
      );
      
      console.log("Real Estate Data retrieved:", realEstateData);
      
      // Drill down into the custom wrapper structure returned by the new API
      const propertyArray = realEstateData.data?.home_search?.results;
      
      if (propertyArray && propertyArray.length > 0) {
        renderRealEstateMarkers(propertyArray);
        renderPropertyList(propertyArray);
        
        // Auto-collapse the search panel to reveal the list!
        document.getElementById('summary-content').classList.add('collapsed');
        document.getElementById('summary-chevron').style.transform = 'rotate(-90deg)';
      } else {
        console.warn("No properties found within this search boundary.");
      }
      
    } catch (error) {
      console.error("Real Estate Fetch Failed:", error);
    }
  });
}

const mobileToggle = document.getElementById('mobile-view-toggle');
const panel = document.querySelector('.panel');

if (mobileToggle && panel) {
  mobileToggle.addEventListener('click', () => {
    panel.classList.toggle('mobile-hidden');
    
    if (panel.classList.contains('mobile-hidden')) {
      mobileToggle.innerHTML = '📋 List View';
      mobileToggle.style.backgroundColor = '#10b981'; 
    } else {
      mobileToggle.innerHTML = '🗺️ Map View';
      mobileToggle.style.backgroundColor = '#1f2937'; 
    }
  });
}

// =========================
// CORE ACTIONS
// =========================

document.getElementById('addressInput').addEventListener('input', () => {
  selectedLocation = null;
});

async function handleSearch() {
  if (searchInProgress) return;
  
  const addressInput = document.getElementById('addressInput').value.trim();
  if (!addressInput && !selectedLocation) {
    alert('Enter an address');
    return;
  }

  const radius = +document.getElementById('radiusSelect').value;
  const selectedKeys = selectedPOI();

  if (!selectedKeys.length) {
    alert('Select at least one POI');
    return;
  }

  searchInProgress = true;
  showLoading(true);

  try {
    let center;

    if (selectedLocation) {
      center = { lat: Number(selectedLocation.lat), lon: Number(selectedLocation.lon) };
    } else {
      const geoResult = await geocode(addressInput);
      center = { lat: geoResult.lat, lon: geoResult.lon };
      setMatchedAddress('Matched Address', geoResult.display_name);
    }

    map.setView([center.lat, center.lon], 15);
    clearMapData(); // Prep map for new data
    drawRadius(center, radius);

    const results = await fetchPOI(center, radius, selectedKeys);
    
    // Render returns the counts needed for UI
    const counts = renderMarkers(results, center, selectedKeys);
    updateSummaryCounts(counts);
    updateURLState(center, radius);

    // Save state for the super secret Real Estate mode
    lastSuccessfulSearch = {
      center: center,
      radius: radius 
    };

    // Mobile UX Scroll
    if (window.innerWidth <= 768) {
      document.querySelector('.panel').scrollTo({ top: 9999, behavior: 'smooth' });
    }

  } catch (error) {
    console.error(error);
    alert(error.message || 'Search failed');
  } finally {
    showLoading(false);
    searchInProgress = false;
  }
}

async function handleLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }

  showLoading(true);

  navigator.geolocation.getCurrentPosition(
    async position => {
      try {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        selectedLocation = { lat, lon };

        map.setView([lat, lon], 16);
        const address = await reverseGeocode(lat, lon);
        
        document.getElementById('addressInput').value = address;
        setMatchedAddress('Current Location', address);
        
        handleSearch();
      } catch (err) {
        console.error(err);
      } finally {
        showLoading(false);
      }
    },
    () => {
      showLoading(false);
      alert('Unable to retrieve location. Please allow location access.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function handleClear() {
  selectedLocation = null;
  lastSuccessfulSearch = null; 
  clearMapData();
  resetUI();
  resetMapView();
  
  history.replaceState({}, '', window.location.pathname);
}

async function handleSuggest(query) {
  return await searchAddresses(query);
}

function handleFilterToggle(filterKey) {
  applyFilter(filterKey);
}

// =========================
// URL ROUTING
// =========================

function updateURLState(center, radius) {
  const params = new URLSearchParams();
  params.set('lat', center.lat);
  params.set('lon', center.lon);
  params.set('radius', radius);
  params.set('poi', selectedPOI().join(','));
  history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function loadURLState() {
  const params = new URLSearchParams(window.location.search);
  const lat = params.get('lat');
  const lon = params.get('lon');
  const radius = params.get('radius');
  const poi = params.get('poi');

  if (!lat || !lon) return;

  selectedLocation = { lat: Number(lat), lon: Number(lon) };
  if (radius) document.getElementById('radiusSelect').value = radius;

  // Reset then apply URL POIs
  Object.keys(POI_STATE).forEach(key => POI_STATE[key] = false);
  if (poi) {
    poi.split(',').forEach(key => {
      if (POI_STATE.hasOwnProperty(key)) POI_STATE[key] = true;
    });
  }

  // Sync chips
  document.querySelectorAll('.poi-chip').forEach(chip => {
    chip.classList.toggle('active', POI_STATE[chip.dataset.key]);
  });

  reverseGeocode(selectedLocation.lat, selectedLocation.lon).then(address => {
    document.getElementById('addressInput').value = address;
    setMatchedAddress('Shared Location', address);
    handleSearch();
  });
}

// =========================
// SIDEBAR UI RENDERER
// =========================

function renderPropertyList(properties) {
  const listContainer = document.getElementById('property-list');
  if (!listContainer) return;
  
  // Wipe the list clean before adding new results
  listContainer.innerHTML = ''; 
  
  // Add a quick result counter at the top
  const header = document.createElement('div');
  header.style.marginBottom = '10px';
  header.style.fontSize = '14px';
  header.style.fontWeight = '600';
  header.style.color = '#6b7280';
  header.innerText = `${properties.length} Properties Found`;
  listContainer.appendChild(header);

  // Loop through the data and build a card for each property
  properties.forEach(prop => {
    // Extract the exact same data we used for the map markers
    const lat = prop.location?.address?.coordinate?.lat;
    const lon = prop.location?.address?.coordinate?.lon;
    if (!lat || !lon) return;

    const rawPrice = prop.list_price || 0;
    const formattedPrice = rawPrice > 0 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rawPrice)
      : 'Contact Agent';

    const streetAddress = prop.location?.address?.line || 'Address Undisclosed';
    const beds = prop.description?.beds || '--';
    const baths = prop.description?.baths || '--';
    const sqft = prop.description?.sqft 
      ? new Intl.NumberFormat('en-US').format(prop.description.sqft) 
      : '--';
    
    const isRental = prop.status && prop.status.toLowerCase().includes('rent');
    const cleanStatus = prop.status ? prop.status.replace('_', ' ') : 'Active';

    // Create the card element
    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <h4 style="margin: 0; color: #10b981; font-size: 18px;">${formattedPrice}${isRental ? '<span style="font-size:12px; color:#6b7280;">/mo</span>' : ''}</h4>
        <span style="background-color: ${isRental ? '#dbeafe' : '#d1fae5'}; color: ${isRental ? '#1e40af' : '#065f46'}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase;">${cleanStatus}</span>
      </div>
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563; text-transform: capitalize;">${streetAddress.toLowerCase()}</p>
      
      <div style="display: flex; gap: 12px; font-size: 13px; color: #374151; border-top: 1px solid #f3f4f6; padding-top: 8px;">
        <span><b>${beds}</b> bd</span>
        <span style="color: #d1d5db;">|</span>
        <span><b>${baths}</b> ba</span>
        <span style="color: #d1d5db;">|</span>
        <span><b>${sqft}</b> sqft</span>
      </div>
    `;

    // INTERACTIVITY: When clicked, fly the map to this house!
    card.addEventListener('click', () => {
      map.flyTo([lat, lon], 17, {
        animate: true,
        duration: 1.5 
      });

      // Auto-hide the panel on mobile so they can see the map!
      if (window.innerWidth <= 768) {
        const panel = document.querySelector('.panel');
        const mobileToggle = document.getElementById('mobile-view-toggle');
        
        if (panel && mobileToggle) {
          panel.classList.add('mobile-hidden');
          mobileToggle.innerHTML = '📋 List View';
          mobileToggle.style.backgroundColor = '#10b981';
        }
      }
    });
}

// =========================
// INITIALIZATION
// =========================

initMap();

initUI({
  onSearch: handleSearch,
  onClear: handleClear,
  onLocation: handleLocation,
  onSuggest: handleSuggest,
  onFilterToggle: handleFilterToggle
});

loadURLState();
