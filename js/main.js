// ========================
// js/main.js
// ========================
import { POI_STATE, POI_CONFIG, selectedPOI } from './config.js';
import { initUI, showLoading, setMatchedAddress, updateSummaryCounts, resetUI } from './ui.js';
import { geocode, reverseGeocode, searchAddresses, fetchPOI } from './api.js';
import { map, initMap, clearMapData, drawRadius, renderMarkers, applyFilter, resetMapView, renderRealEstateMarkers, radiusCircle } from './map.js';

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
    summaryContent.classList.toggle('collapsed');
    
    if (summaryContent.classList.contains('collapsed')) {
      summaryChevron.style.transform = 'rotate(-90deg)'; 
    } else {
      summaryChevron.style.transform = 'rotate(0deg)';   
    }
  });
}

if (hiddenTrigger) {
  hiddenTrigger.addEventListener('click', async () => {
    if (!lastSuccessfulSearch) {
      console.warn("Run a standard search first to establish a center point.");
      return;
    }

    console.log("🤫 Secret Real Estate Mode Activated!");
    
    try {
      const realEstateData = await fetchPOI(
        lastSuccessfulSearch.center, 
        lastSuccessfulSearch.radius, 
        ['real_estate'] 
      );
      
      console.log("Real Estate Data retrieved:", realEstateData);
      
      const propertyArray = realEstateData.data?.home_search?.results;
      
      if (propertyArray && propertyArray.length > 0) {
        renderRealEstateMarkers(propertyArray);
        renderPropertyList(propertyArray);
        
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

    // WAKE UP LEAFLET!
    setTimeout(() => {
      map.invalidateSize();
    }, 400);
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
    clearMapData(); 
    drawRadius(center, radius);

    const results = await fetchPOI(center, radius, selectedKeys);
    
    // Render returns the counts needed for UI
    const counts = renderMarkers(results, center, selectedKeys);
    updateSummaryCounts(counts);
    updateURLState(center, radius);

    document.getElementById('exportPdfBtn').style.display = 'block';

    lastSuccessfulSearch = {
      center: center,
      radius: radius 
    };

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

  Object.keys(POI_STATE).forEach(key => POI_STATE[key] = false);
  if (poi) {
    poi.split(',').forEach(key => {
      if (POI_STATE.hasOwnProperty(key)) POI_STATE[key] = true;
    });
  }

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
  
  listContainer.innerHTML = ''; 
  
  const header = document.createElement('div');
  header.style.marginBottom = '10px';
  header.style.fontSize = '14px';
  header.style.fontWeight = '600';
  header.style.color = '#6b7280';
  header.innerText = `${properties.length} Properties Found`;
  listContainer.appendChild(header);

  properties.forEach(prop => {
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

    card.addEventListener('click', () => {
      map.flyTo([lat, lon], 17, {
        animate: true,
        duration: 1.5 
      });

      if (window.innerWidth <= 768) {
        const panel = document.querySelector('.panel');
        const mobileToggle = document.getElementById('mobile-view-toggle');
        
        if (panel && mobileToggle) {
          panel.classList.add('mobile-hidden');
          mobileToggle.innerHTML = '📋 List View';
          mobileToggle.style.backgroundColor = '#10b981';
          
          // WAKE UP LEAFLET HERE TOO!
          setTimeout(() => {
            map.invalidateSize();
          }, 400);
        }
      }
    });

    listContainer.appendChild(card);
  });
}

// =========================
// PRO PDF EXPORT (MAP + LAYOUT)
// =========================
const exportBtn = document.getElementById('exportPdfBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '📸 Focusing Map...';
    
    if (radiusCircle) {
      map.fitBounds(radiusCircle.getBounds(), { padding: [20, 20], animate: false });
    }

    setTimeout(async () => {
      exportBtn.innerHTML = '📸 Capturing...';
      
      try {
        const mapDiv = document.getElementById('map');
        
        const canvas = await html2canvas(mapDiv, {
          useCORS: true, 
          allowTaint: false,
          scale: 2 
        });
        
        exportBtn.innerHTML = '📄 Formatting...';
        const mapDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        const currentAddress = document.getElementById('addressInput').value || 'Selected Area';
        const propertyCards = document.getElementById('property-list').innerHTML;
        const summaryGrid = document.getElementById('summaryGrid').innerHTML;

        const printContainer = document.createElement('div');
        printContainer.style.width = '800px'; 
        printContainer.style.backgroundColor = '#ffffff';

        printContainer.innerHTML = `
          <style>
            /* Force the elements to look good and PREVENT page-break chopping */
            .property-card { page-break-inside: avoid !important; border: 1px solid #d1d5db; padding: 15px; border-radius: 8px; margin-bottom: 15px; background-color: #ffffff; }
            .summary-item { page-break-inside: avoid !important; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; background-color: #f9fafb; text-align: center; margin-bottom: 10px;}
            h1, h2, h3 { margin-top: 0; }
          </style>
          
          <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, sans-serif; color: #1f2937;">
            
            <!-- Header -->
            <div style="border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 25px;">
              <h1 style="margin: 0; font-size: 28px; color: #111827;">Location Scouting Report</h1>
              <h2 style="margin: 5px 0 0 0; font-size: 16px; color: #6b7280; font-weight: 500;">📍 ${currentAddress}</h2>
            </div>

            <!-- The Captured Map Image -->
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <img src="${mapDataUrl}" style="width: 100%; height: auto; max-height: 450px; object-fit: cover; border-radius: 8px; border: 1px solid #d1d5db; box-shadow: 0 4px 6px rgba(0,0,0,0.05);" />
            </div>

            <!-- Amenities Summary -->
            <div style="page-break-inside: avoid; margin-bottom: 40px;">
              <h3 style="font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; color: #374151;">Neighborhood Amenities</h3>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                ${summaryGrid}
              </div>
            </div>

            <!-- Real Estate List -->
            <div>
              <h3 style="font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; color: #374151;">Available Real Estate</h3>
              <!-- 2-Column Grid for Properties -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                ${propertyCards}
              </div>
            </div>

          </div>
        `;

        const opt = {
          margin:       0,
          filename:     `Scout-Report-${currentAddress.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printContainer).save().then(() => {
          exportBtn.innerHTML = originalText;
        });

      } catch (error) {
        console.error("Map Capture Failed:", error);
        alert("Failed to capture the map image.");
        exportBtn.innerHTML = originalText;
      }
    }, 1000);
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
