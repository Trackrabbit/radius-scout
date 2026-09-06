// =========================
// js/ui.js
// =========================
import { POI_CONFIG, POI_GROUPS, POI_STATE } from './config.js';

let activeFilter = null;
let autocompleteTimer = null;
let matchedAddressBackup = '';

// =========================
// INTERNAL HELPERS
// =========================

function groupPOIs() {
  const groups = {};
  Object.entries(POI_CONFIG).forEach(([key, poi]) => {
    poi.groups.forEach(group => {
      if (!groups[group]) groups[group] = [];
      groups[group].push({ key, ...poi });
    });
  });
  return groups;
}

function getGroupState(groupItems) {
  let activeCount = 0;
  groupItems.forEach(poi => { if (POI_STATE[poi.key]) activeCount++; });
  if (activeCount === 0) return 'none';
  if (activeCount === groupItems.length) return 'all';
  return 'partial';
}

// =========================
// EXPORTED UI METHODS
// =========================

export function initUI(actions) {
  const { 
    onSearch, 
    onClear, 
    onLocation, 
    onFilterToggle, 
    onSuggest 
  } = actions;

  const poiContainer = document.getElementById('poiContainer');
  const summaryGrid = document.getElementById('summaryGrid');
  const addressInput = document.getElementById('addressInput');

  poiContainer.innerHTML = '';
  summaryGrid.innerHTML = '';

  // Build POI Accordions
  const grouped = groupPOIs();
  Object.entries(grouped).forEach(([groupKey, items]) => {
    const group = document.createElement('div');
    group.className = 'poi-group';

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

    const content = document.createElement('div');
    content.className = 'poi-group-content';

    items.forEach(poi => {
      const chip = document.createElement('div');
      chip.className = 'poi-chip';
      chip.dataset.key = poi.key;
      if (POI_STATE[poi.key]) chip.classList.add('active');
      chip.innerHTML = `${poi.icon} ${poi.label}`;

      chip.onclick = () => {
        POI_STATE[poi.key] = !POI_STATE[poi.key];
        chip.classList.toggle('active', POI_STATE[poi.key]);
        updateHeaderUI();
      };
      content.appendChild(chip);
    });

    header.onclick = () => group.classList.toggle('open');
    updateHeaderUI();

    group.appendChild(header);
    group.appendChild(content);
    poiContainer.appendChild(group);
  });

  // Build Summary Cards
  Object.entries(POI_CONFIG).forEach(([key, poi]) => {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.id = `summary-${key}`;
    card.innerHTML = `
      <div class="summary-label">${poi.icon} ${poi.label}</div>
      <div class="summary-value" id="count-${key}">0</div>
    `;

    card.onclick = () => {
      document.querySelectorAll('.summary-card').forEach(el => el.classList.remove('active'));
      if (activeFilter === key) {
        activeFilter = null;
      } else {
        activeFilter = key;
        card.classList.add('active');
      }
      onFilterToggle(activeFilter);
    };

    summaryGrid.appendChild(card);
  });

  // Attach Button Listeners
  document.getElementById('searchBtn').onclick = onSearch;
  document.getElementById('clearBtn').onclick = onClear;
  document.getElementById('locationBtn').onclick = onLocation;

  // Autocomplete Listeners
  addressInput.addEventListener('input', e => {
    clearTimeout(autocompleteTimer);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
      document.getElementById('addressSuggestions').style.display = 'none';
      return;
    }
    
    autocompleteTimer = setTimeout(async () => {
      const results = await onSuggest(query);
      renderSuggestions(results, onSearch);
    }, 300);
  });

  addressInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  });
}

function renderSuggestions(results, onSearch) {
  const container = document.getElementById('addressSuggestions');
  
  if (!results || !results.length) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <div class="suggestion-main">${result.display_name.split(',')[0]}</div>
      <div class="suggestion-secondary">${result.display_name}</div>
    `;

    item.onclick = () => {
      document.getElementById('addressInput').value = result.display_name;
      setMatchedAddress('Selected Address', result.display_name);
      container.style.display = 'none';
      
      // Give UI a tick to clear the dropdown before firing search
      setTimeout(onSearch, 100); 
    };

    container.appendChild(item);
  });

  container.style.display = 'block';
}

export function showLoading(isLoading) {
  const searchBtn = document.getElementById('searchBtn');
  if (!searchBtn) return;
  
  if (isLoading) {
    // Disable the button and change text
    searchBtn.disabled = true;
    searchBtn.innerHTML = 'Searching... ⏳';
    
    // Visually mute the button so it looks inactive
    searchBtn.style.opacity = '0.7';
    searchBtn.style.cursor = 'not-allowed';
  } else {
    // Restore original state
    searchBtn.disabled = false;
    searchBtn.innerHTML = 'Search Area';
    searchBtn.style.opacity = '1';
    searchBtn.style.cursor = 'pointer';
  }
}

export function setMatchedAddress(title, address) {
  document.getElementById('matchedAddress').innerHTML = `
    <div style="color:#8b5cf6;font-weight:600;margin-bottom:4px;">${title}</div>
    <div>${address}</div>
  `;
}

export function updateSummaryCounts(counts) {
  Object.entries(counts).forEach(([key, val]) => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.innerText = val;
  });
}

export function resetUI() {
  document.getElementById('addressInput').value = '';
  document.getElementById('addressSuggestions').style.display = 'none';
  document.getElementById('addressSuggestions').innerHTML = '';
  
  document.getElementById('matchedAddress').innerHTML = `
    <div style="opacity:.7;">Ready for a new search</div>
  `;

  Object.keys(POI_CONFIG).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.innerText = '0';
  });

  activeFilter = null;
  document.querySelectorAll('.summary-card').forEach(el => el.classList.remove('active'));

  Object.keys(POI_STATE).forEach(key => {
    POI_STATE[key] = POI_CONFIG[key].default || false;
  });
    
  document.querySelectorAll('.poi-chip').forEach(chip => {
    const key = chip.dataset.key;
    chip.classList.toggle('active', POI_STATE[key]);
  });
    
  document.querySelectorAll('.poi-group').forEach(group => {
    group.classList.remove('open');
  });
}
