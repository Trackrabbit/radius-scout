// =========================
// js/main.js
// =========================
import { POI_STATE, POI_CONFIG, selectedPOI } from './config.js';
import { initUI, showLoading, setMatchedAddress, updateSummaryCounts, resetUI } from './ui.js';
import { geocode, reverseGeocode, searchAddresses, fetchPOI } from './api.js';
import { map, initMap, clearMapData, drawRadius, renderMarkers, applyFilter, resetMapView } from './map.js';

// APP STATE
let searchInProgress = false;
let selectedLocation = null;

// REAL ESTATE
let lastSuccessfulSearch = null;

const hiddenTrigger = document.querySelector('.brand'); 

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

    } catch (error) {
      console.error("Real Estate Fetch Failed:", error);
    }
  });
}

// =========================
// CORE ACTIONS
// =========================

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
  clearMapData();
  resetUI();
  resetMapView();
  
  // Clear URL params
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
