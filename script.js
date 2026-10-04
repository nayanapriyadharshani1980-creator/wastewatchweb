'use strict';

const CONFIG = {
  REPORT_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx_jv5j9EE1tRNpmYIgAmM94_14EAXjmAFNK1ssq0Hb6XVB8r-NQHKjcBaqj5hXboFH7w/exec',
  DATA: {
    boundary: 'data/western_province_boundary.geojson',
    illegal: 'data/illegal_dumping_locations.geojson',
    legal: 'data/legal_waste_sites.geojson'
  }
};

const map = L.map('map', {
  zoomControl: false,
  preferCanvas: true
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
}).addTo(map);

const boundaryLayer = L.geoJSON(null, {
  style: {
    color: '#397ab7',
    weight: 2,
    opacity: 0.95,
    fillColor: '#70a7d7',
    fillOpacity: 0.08
  }
});

const illegalLayer = L.geoJSON(null, {
  pointToLayer: (_feature, latlng) =>
    L.marker(latlng, { icon: makeIcon('illegal', '!') }),

  onEachFeature: (feature, layer) =>
    layer.bindPopup(
      makePopup(
        'Existing illegal dumping location',
        feature.properties,
        'illegal'
      )
    )
});

const legalLayer = L.geoJSON(null, {
  pointToLayer: (_feature, latlng) =>
    L.marker(latlng, { icon: makeIcon('legal', '♻') }),

  onEachFeature: (feature, layer) =>
    layer.bindPopup(
      makePopup(
        feature.properties?.name ||
        feature.properties?.Name ||
        'Waste management facility',
        feature.properties,
        'legal'
      )
    )
});

const submittedReportsLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const status = String(
      feature.properties?.status || 'Pending'
    ).toLowerCase();

    const kind =
      status === 'verified'
        ? 'report-verified'
        : status === 'registered'
        ? 'report-registered'
        : 'report-pending';

    return L.marker(latlng, {
      icon: makeIcon(kind, '●')
    });
  },

  onEachFeature: (feature, layer) =>
    layer.bindPopup(
      makeReportPopup(feature.properties || {})
    )
});

const overlayLayers = {
  boundary: boundaryLayer,
  illegal: illegalLayer,
  legal: legalLayer,
  reports: submittedReportsLayer
};

let selectedMarker = null;
let pickingLocation = false;
let selectedLatLng = null;
let toastTimer = null;

// --------------------------------------------------
// MAP MARKERS AND POPUPS
// --------------------------------------------------

function makeIcon(kind, text) {
  return L.divIcon({
    className: '',
    html: `<span class="custom-marker ${kind}">${text}</span>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
}

function makePopup(title, properties, kind) {
  const p = properties || {};
  const details = [];

  const district = p.district || p.District;
  const type =
    p.facility_type || p.type || p.waste_type;
  const locality =
    p.locality || p.address || p.description;

  if (district) {
    details.push(
      `<div><b>District:</b> ${escapeHtml(district)}</div>`
    );
  }

  if (type) {
    details.push(
      `<div><b>Type:</b> ${escapeHtml(type)}</div>`
    );
  }

  if (locality) {
    details.push(
      `<div>${escapeHtml(String(locality).slice(0, 260))}</div>`
    );
  }

  if (p.coordinate_status) {
    details.push(
      `<div><b>Coordinate note:</b> ${escapeHtml(p.coordinate_status)}</div>`
    );
  }

  if (!details.length) {
    details.push(
      '<div>Existing recorded point. Verify details before operational use.</div>'
    );
  }

  return `
    <div class="popup-title">${escapeHtml(title)}</div>
    <div class="popup-detail">${details.join('')}</div>
  `;
}

function makeReportPopup(p) {
  const status = String(p.status || 'Pending');

  const district = p.district
    ? `<div><b>District:</b> ${escapeHtml(p.district)}</div>`
    : '';

  const waste = p.wasteType
    ? `<div><b>Waste type:</b> ${escapeHtml(p.wasteType)}</div>`
    : '';

  const severity = p.severity
    ? `<div><b>Severity:</b> ${escapeHtml(p.severity)}</div>`
    : '';

  const stamp = p.timestamp
    ? `<div><b>Submitted:</b> ${escapeHtml(p.timestamp)}</div>`
    : '';

  const reportId = p.reportId
    ? `<div><b>Report ID:</b> ${escapeHtml(p.reportId)}</div>`
    : '';

  const photoUrl =
    typeof p.photoUrl === 'string'
      ? p.photoUrl.trim()
      : '';

  const safePhotoUrl =
    /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(photoUrl)
      ? photoUrl
      : '';

  const photo = safePhotoUrl
    ? `
      <a href="${escapeHtml(safePhotoUrl)}"
         target="_blank"
         rel="noopener noreferrer">
        <img
          src="${escapeHtml(safePhotoUrl)}"
          alt="Evidence photo for this dumping report"
          loading="lazy"
          referrerpolicy="no-referrer"
          style="display:block;width:100%;max-height:210px;object-fit:cover;border-radius:8px;margin:8px 0"
          onerror="this.style.display='none';this.nextElementSibling.style.display='none'"
        >
      </a>
      <div style="margin-bottom:8px">
        <a href="${escapeHtml(safePhotoUrl)}"
           target="_blank"
           rel="noopener noreferrer">
          View full-size photo
        </a>
      </div>
    `
    : `
      <div style="margin:6px 0">
        <i>No photo attached to this report.</i>
      </div>
    `;

  return `
    <div class="popup-title">Community dumping report</div>
    ${photo}
    <div class="popup-detail">
      ${reportId}
      ${district}
      ${waste}
      ${severity}
      ${stamp}
      <div class="report-status status-${escapeHtml(status.toLowerCase())}">
        <b>Status:</b> ${escapeHtml(status)}
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function showToast(message) {
  const el = document.getElementById('toast');

  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => el.classList.remove('show'),
    3500
  );
}

// --------------------------------------------------
// LOAD GEOJSON LAYERS
// --------------------------------------------------

async function loadGeoJSON(key, layer) {
  const url = CONFIG.DATA[key];

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (key === 'boundary') {
      layer.addData(data);
      layer.addTo(map);

      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.04), {
          maxZoom: 12
        });
      }
    } else {
      layer.addData(data);
      layer.addTo(map);
    }

    return data.features?.length || 0;

  } catch (error) {
    console.error(
      `Could not load ${key} layer (${url})`,
      error
    );

    showToast(
      `Could not load ${key} layer. Check the data folder and filenames.`
    );

    return 0;
  }
}

async function loadLayers() {
  const [
    boundaryCount,
    illegalCount,
    legalCount
  ] = await Promise.all([
    loadGeoJSON('boundary', boundaryLayer),
    loadGeoJSON('illegal', illegalLayer),
    loadGeoJSON('legal', legalLayer)
  ]);

  document.getElementById('illegalCount').textContent =
    illegalCount;

  document.getElementById('illegalLayerCount').textContent =
    illegalCount;

  document.getElementById('legalCount').textContent =
    legalCount;

  document.getElementById('legalLayerCount').textContent =
    legalCount;

  if (!boundaryCount) {
    map.setView([6.9, 79.9], 9);
  }

  console.info('Layer load summary:', {
    boundaryCount,
    illegalCount,
    legalCount
  });
}

function setLayerVisible(layer, visible) {
  if (visible && !map.hasLayer(layer)) {
    layer.addTo(map);
  }

  if (!visible && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

document.getElementById('toggleBoundary')
  .addEventListener('change', e =>
    setLayerVisible(boundaryLayer, e.target.checked)
  );

document.getElementById('toggleIllegal')
  .addEventListener('change', e =>
    setLayerVisible(illegalLayer, e.target.checked)
  );

document.getElementById('toggleLegal')
  .addEventListener('change', e =>
    setLayerVisible(legalLayer, e.target.checked)
  );

document.getElementById('toggleReports')
  .addEventListener('change', e =>
    setLayerVisible(submittedReportsLayer, e.target.checked)
  );

document.getElementById('zoomAll').addEventListener('click', () => {
  const bounds = boundaryLayer.getBounds();

  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.04));
  } else {
    map.setView([6.9, 79.9], 9);
  }
});

// --------------------------------------------------
// REPORT LOCATION SELECTION
// --------------------------------------------------

const modal = document.getElementById('reportModal');
const mapHint = document.getElementById('mapHint');
const coordinateText = document.getElementById('coordinateText');
const coordinateBox = coordinateText.parentElement;

function openReport() {
  modal.classList.remove('hidden');
  document.getElementById('formMessage').textContent = '';
}

function closeReport() {
  modal.classList.add('hidden');
}

function startPicking() {
  pickingLocation = true;

  closeReport();

  mapHint.classList.remove('hidden');
  map.getContainer().style.cursor = 'crosshair';

  showToast(
    'Click the map where the illegal dumping is located.'
  );
}

function stopPicking() {
  pickingLocation = false;
  mapHint.classList.add('hidden');
  map.getContainer().style.cursor = '';
}

function selectLocation(latlng) {
  selectedLatLng = latlng;

  document.getElementById('latitude').value =
    latlng.lat.toFixed(7);

  document.getElementById('longitude').value =
    latlng.lng.toFixed(7);

  coordinateText.textContent =
    `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;

  coordinateBox.classList.add('has-coordinates');

  if (selectedMarker) {
    map.removeLayer(selectedMarker);
  }

  selectedMarker = L.marker(latlng, {
    icon: makeIcon('selected', '✓'),
    draggable: true,
    zIndexOffset: 1500
  }).addTo(map);

  selectedMarker.bindPopup(
    '<div class="popup-title">Selected complaint location</div>' +
    '<div class="popup-detail">Drag the marker to adjust the location.</div>'
  ).openPopup();

  selectedMarker.on('dragend', () => {
    const pos = selectedMarker.getLatLng();

    selectedLatLng = pos;

    document.getElementById('latitude').value =
      pos.lat.toFixed(7);

    document.getElementById('longitude').value =
      pos.lng.toFixed(7);

    coordinateText.textContent =
      `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
  });

  stopPicking();
  openReport();
}

map.on('click', event => {
  if (pickingLocation) {
    selectLocation(event.latlng);
  }
});

['reportOpenTop', 'reportOpenSide'].forEach(id => {
  document.getElementById(id)
    .addEventListener('click', openReport);
});

document.getElementById('closeReport')
  .addEventListener('click', closeReport);

document.getElementById('cancelForm')
  .addEventListener('click', closeReport);

document.getElementById('chooseLocation')
  .addEventListener('click', startPicking);

document.getElementById('cancelPick')
  .addEventListener('click', () => {
    stopPicking();
    openReport();
  });

modal.addEventListener('click', e => {
  if (e.target === modal) {
    closeReport();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    stopPicking();
    closeReport();
  }
});

// --------------------------------------------------
// SEARCH MAP LOCATIONS
// --------------------------------------------------

function getSearchableFeatures() {
  const result = [];

  [illegalLayer, legalLayer, boundaryLayer].forEach(layer => {
    layer.eachLayer(child => {
      const p = child.feature?.properties || {};

      const name =
        p.name ||
        p.Name ||
        p.ADM1_EN ||
        p.locality ||
        p.address ||
        '';

      if (name) {
        result.push({
          name: String(name),
          layer: child,
          props: p
        });
      }
    });
  });

  return result;
}

document.getElementById('searchForm')
  .addEventListener('submit', async e => {
    e.preventDefault();

    const query =
      document.getElementById('searchInput').value.trim();

    const message =
      document.getElementById('searchMessage');

    if (!query) {
      message.textContent =
        'Enter a town, address, or facility name.';
      return;
    }

    const local = getSearchableFeatures().find(item =>
      (item.name + ' ' + JSON.stringify(item.props))
        .toLowerCase()
        .includes(query.toLowerCase())
    );

    if (local) {
      if (
        local.layer.getBounds &&
        local.layer.getBounds().isValid()
      ) {
        map.fitBounds(local.layer.getBounds().pad(0.3));
      } else if (local.layer.getLatLng) {
        map.setView(local.layer.getLatLng(), 15);
      }

      local.layer.openPopup?.();

      message.textContent = `Found: ${local.name}`;
      return;
    }

    message.textContent = 'Searching OpenStreetMap…';

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=lk&q=${encodeURIComponent(query + ', Western Province, Sri Lanka')}`;

      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });

      if (!response.ok) {
        throw new Error('Search service unavailable');
      }

      const results = await response.json();

      if (!results.length) {
        message.textContent =
          'No place found. Try another spelling or nearby town.';
        return;
      }

      const item = results[0];

      map.setView([
        Number(item.lat),
        Number(item.lon)
      ], 15);

      message.textContent = `Found: ${item.display_name}`;

    } catch (err) {
      console.error(err);

      message.textContent =
        'Place search failed. Check your internet connection or try a facility name.';
    }
  });

// --------------------------------------------------
// PHOTO UPLOAD AND COMPRESSION
// --------------------------------------------------

async function prepareImageForUpload(file) {
  if (!file) return null;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      'Please select a JPG, PNG, or WebP image.'
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      'Please select an image smaller than 5 MB.'
    );
  }

  if (typeof createImageBitmap !== 'function') {
    throw new Error(
      'This browser cannot process the selected image. Please try another browser.'
    );
  }

  const bitmap = await createImageBitmap(file);

  try {
    const maxDimension = 900;

    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement('canvas');

    canvas.width = Math.max(
      1,
      Math.round(bitmap.width * scale)
    );

    canvas.height = Math.max(
      1,
      Math.round(bitmap.height * scale)
    );

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not process the selected image.');
    }

    context.drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        result => result
          ? resolve(result)
          : reject(new Error('Could not compress the image.')),
        'image/jpeg',
        0.60
      );
    });

    if (blob.size > 800 * 1024) {
      throw new Error(
        'The compressed image is too large. Please select a smaller photo.'
      );
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());

    let binary = '';
    const chunkSize = 8192;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, i + chunkSize)
      );
    }

    return btoa(binary);

  } finally {
    bitmap.close();
  }
}

// --------------------------------------------------
// JSONP REQUESTS TO GOOGLE APPS SCRIPT
// --------------------------------------------------

function jsonpRequest(params) {
  return new Promise((resolve, reject) => {
    const callback =
      `wasteWatchCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const script = document.createElement('script');

    const cleanup = () => {
      try {
        delete window[callback];
      } catch (_) {
        window[callback] = undefined;
      }

      script.remove();
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Reporting service timeout'));
    }, 15000);

    window[callback] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(
        new Error('Could not connect to reporting service')
      );
    };

    script.src =
      `${CONFIG.REPORT_ENDPOINT}?${new URLSearchParams({
        ...params,
        callback
      }).toString()}`;

    document.head.appendChild(script);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

// --------------------------------------------------
// LOAD COMMUNITY REPORTS AND DASHBOARD
// --------------------------------------------------

async function loadSubmittedReports() {
  try {
    const result = await jsonpRequest({
      action: 'reports'
    });

    if (!result?.success || !Array.isArray(result.reports)) {
      throw new Error(
        result?.message || 'Unexpected response'
      );
    }

    submittedReportsLayer.clearLayers();

    const features = result.reports
      .filter(r =>
        Number.isFinite(Number(r.latitude)) &&
        Number.isFinite(Number(r.longitude))
      )
      .map(r => ({
        type: 'Feature',

        geometry: {
          type: 'Point',
          coordinates: [
            Number(r.longitude),
            Number(r.latitude)
          ]
        },

        properties: {
          district: r.district || '',
          wasteType: r.wasteType || '',
          severity: r.severity || '',
          status: r.status || 'Pending',
          timestamp: r.timestamp || '',
          reportId: r.reportId || '',
          photoUrl: r.photoUrl || ''
        }
      }));

    submittedReportsLayer.addData({
      type: 'FeatureCollection',
      features
    });

    if (
      document.getElementById('toggleReports').checked &&
      !map.hasLayer(submittedReportsLayer)
    ) {
      submittedReportsLayer.addTo(map);
    }

    setText('reportsLayerCount', features.length);

    setText(
      'reportTotal',
      result.counts?.total ?? features.length
    );

    setText(
      'reportPending',
      result.counts?.pending ?? 0
    );

    setText(
      'reportVerified',
      result.counts?.verified ?? 0
    );

    setText(
      'reportRegistered',
      result.counts?.registered ?? 0
    );

  } catch (error) {
    console.error(
      'Could not load submitted reports:',
      error
    );

    [
      'reportsLayerCount',
      'reportTotal',
      'reportPending',
      'reportVerified',
      'reportRegistered'
    ].forEach(id => setText(id, '—'));
  }
}

// --------------------------------------------------
// TRACK A REPORT
// --------------------------------------------------

const trackForm = document.getElementById('trackForm');

trackForm.addEventListener('submit', async e => {
  e.preventDefault();

  const code =
    document.getElementById('trackCode')
      .value.trim().toUpperCase();

  const box =
    document.getElementById('trackMessage');

  box.className = 'tracking-result';
  box.textContent = 'Checking report status…';

  try {
    const result = await jsonpRequest({
      action: 'track',
      reportId: code
    });

    if (!result?.success || !result.report) {
      box.className =
        'tracking-result tracking-error';

      box.textContent =
        result?.message ||
        'No report found for that reference number.';

      return;
    }

    const r = result.report;

    box.className =
      'tracking-result tracking-found';

    box.innerHTML = `
      <strong>Report found</strong>
      <span>Status: <b>${escapeHtml(r.status || 'Pending')}</b></span>
      <span>District: ${escapeHtml(r.district || 'Not provided')}</span>
      <span>Waste type: ${escapeHtml(r.wasteType || 'Not provided')}</span>
      <small>Last checked: ${escapeHtml(r.timestamp || 'Not available')}</small>
    `;

  } catch (error) {
    box.className =
      'tracking-result tracking-error';

    box.textContent =
      'Could not check the status right now. Please try again later.';

    console.error(error);
  }
});

// --------------------------------------------------
// SUBMIT A NEW REPORT WITH OPTIONAL PHOTO
// --------------------------------------------------

const form = document.getElementById('reportForm');

form.addEventListener('submit', async e => {
  e.preventDefault();

  const message =
    document.getElementById('formMessage');

  const submitButton =
    document.getElementById('submitReport');

  if (
    !selectedLatLng ||
    !document.getElementById('latitude').value ||
    !document.getElementById('longitude').value
  ) {
    message.className = 'form-message error';
    message.textContent =
      'Please choose a location on the map first.';
    return;
  }

  if (
    !CONFIG.REPORT_ENDPOINT ||
    !CONFIG.REPORT_ENDPOINT.endsWith('/exec')
  ) {
    message.className = 'form-message error';
    message.textContent =
      'The Google Apps Script endpoint is not configured.';
    return;
  }

  const reportId =
    `WW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const params = new URLSearchParams({
    reportId,

    latitude:
      document.getElementById('latitude').value,

    longitude:
      document.getElementById('longitude').value,

    district:
      document.getElementById('district').value,

    wasteType:
      document.getElementById('wasteType').value,

    severity:
      document.getElementById('severity').value,

    nearWater:
      document.getElementById('nearWater').value,

    description:
      document.getElementById('description').value.trim()
  });

  submitButton.disabled = true;
  submitButton.textContent = 'Preparing…';

  message.className = 'form-message';
  message.textContent = 'Preparing your report…';

  try {
    const photoInput =
      document.getElementById('reportPhoto');

    const photoFile = photoInput?.files?.[0];

    if (photoFile) {
      const imageBase64 =
        await prepareImageForUpload(photoFile);

      params.set('imageBase64', imageBase64);
      params.set('imageName', photoFile.name);
      params.set('imageMimeType', 'image/jpeg');
    }

    submitButton.textContent = 'Sending…';

    message.textContent = photoFile
      ? 'Uploading photo and submitting report…'
      : 'Sending your report…';

    // The Apps Script backend must decode imageBase64,
    // save the image to Google Drive, and store its URL
    // in the Photo URL column of the Google Sheet.
    //
    // Note: no-cors means this frontend cannot confirm
    // that the server saved the report successfully.

    await fetch(CONFIG.REPORT_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      body: params
    });

    message.className = 'form-message success';

    message.innerHTML = `
      <strong>Report submitted!</strong><br><br>
      Your Tracking Number is:<br>
      <strong style="font-size:20px;color:#15803d;">
        ${escapeHtml(reportId)}
      </strong><br><br>
      Please save this number to track your complaint status later.
    `;

    showToast(`Your Tracking Number: ${reportId}`);

    form.reset();

    selectedLatLng = null;

    if (selectedMarker) {
      map.removeLayer(selectedMarker);
      selectedMarker = null;
    }

    setTimeout(loadSubmittedReports, 2500);

    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';

    coordinateText.textContent =
      'No location selected yet';

    coordinateBox.classList.remove('has-coordinates');

  } catch (err) {
    console.error(err);

    message.className = 'form-message error';

    message.textContent =
      err?.message ||
      'Could not send the report. Check your internet connection and Apps Script deployment.';

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit report';
  }
});

// --------------------------------------------------
// INITIALISE MAP AND REFRESH REPORTS
// --------------------------------------------------

loadLayers();
loadSubmittedReports();

// Refresh submitted report markers and dashboard every 60 seconds.
setInterval(loadSubmittedReports, 60000);
