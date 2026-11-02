/**
 * LILY POND & CARNIVAL TRAVEL HUB - APP.JS
 * Complete Logic with City Filtering Fix, Firebase Storage Integration,
 * Quick-Deck Emergency Support, Post-Travel Infographic Stats,
 * and Optimized Launch Speed.
 */

const firebaseConfig = {
  apiKey: "AIzaSyD66lgTr64OmKbJVSFW0FqkU-hl-Cxj-Ko",
  authDomain: "lilypondhub.firebaseapp.com",
  projectId: "lilypondhub",
  storageBucket: "lilypondhub.firebasestorage.app",
  messagingSenderId: "506164833633",
  appId: "1:506164833633:web:48175dbea8051317472920",
  measurementId: "G-RZC21KJMJS"
};

// Initialize Firebase & Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

try { if (db.enablePersistence) db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}   // keep data + edits when offline

let appData = {
  currentTripId: "trip_jakarta_bandung",
  trips: [
    {
      id: "trip_jakarta_bandung",
      name: "Jakarta & Bandung Escape",
      startDate: "2026-11-21",
      endDate: "2026-11-26",
      category: "Vacation",
      people: "5 Pax",
      budget: "RM 2,000 / pax",
      activeHotel: "The Papandayan Hotel",
      hotelCity: "bandung",
      hotelStation: "Bandung Station (23 min walk)",
      places: [],
      itinerary: [
        { day: 1, title: "Airport Arrival & Whoosh Transfer", time: "09:00", location: "CGK / Halim Station", notes: "High speed train to Bandung", starred: true },
        { day: 1, title: "Hotel Check-in & Relaxation", time: "14:00", location: "The Papandayan Hotel", notes: "Unpack and rest", starred: true }
      ],
      checklists: {
        packing: [
          { text: "Passport & ID", category: "documents", done: true, important: true, fileData: null },
          { text: "Whoosh Train Ticket", category: "documents", done: false, important: true, fileData: null },
          { text: "Universal Adapter", category: "electronics", done: false, important: true },
          { text: "T-Shirts (5x)", category: "clothes", done: false, important: false }
        ]
      },
      expenses: [
        { title: "Hotel Deposit", amount: "300", category: "Hotel & Stay" },
        { title: "Whoosh Train Ticket", amount: "150", category: "Transport" }
      ]
    }
  ]
};

let activeTripId = "trip_jakarta_bandung";
let activeItineraryDay = 1;
let selectedWaddleCluster = "NEAR_HOTEL";
let activeLocationSubTab = "nearby";
let activePackingCategory = "clothes";
let activeTransportMode = "walk";

let editingItineraryIndex = null;
let editingPlaceId = null;
let editingExpenseIndex = null;
const CURRENCIES = { MYR: 'RM', IDR: 'Rp', SGD: 'S$', USD: 'US$', EUR: '€', GBP: '£', JPY: '¥', THB: '฿', AUD: 'A$', KRW: '₩', CNY: 'CN¥', HKD: 'HK$', PHP: '₱' };
let _expSetup = false, _payIdx = null;
const tripCur = trip => (trip && trip.currency) || 'MYR';
function fmtMoney(n, code) {
  const d = ['IDR', 'JPY', 'KRW'].includes(code) ? 0 : 2;
  return (CURRENCIES[code] || code) + ' ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function expToTrip(trip, e) {
  const amt = parseFloat(e.amount) || 0, cur = e.currency || tripCur(trip), tc = tripCur(trip);
  if (cur === tc) return amt;
  if ((e.rateCur || 'MYR') === tc && e.rate > 0) return amt * e.rate;
  return null;
}
let expSplitSel = new Set();
let editingPackingIndex = null;
let editingTicketIndex = null;
let activeItinTab = 'plan';
const TICKET_ICONS = { Flight: 'fa-plane', Train: 'fa-train', Bus: 'fa-bus', Hotel: 'fa-hotel', Other: 'fa-ticket' };
const ticketIcon = t => TICKET_ICONS[t] || TICKET_ICONS.Other;
let pendingCover = null;
let userLoc = { lat: null, lng: null, live: false, denied: false };
let masterCat = 'ALL', spotsAllCities = false, spotReturnPage = 'master', _popping = false, _locWatch = null;
const SPOT_EMOJI = { Attraction: '🏛️', Coffee: '☕', Food: '🍜', 'Shopping Mall': '🛍️' };
const WALK_M_PER_MIN = 80;
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E888A"/><stop offset="1" stop-color="#113665"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/></svg>');

// Firebase Storage Upload Helper Function
async function uploadImageToFirebase(file, folder = "user_uploads") {
  try {
    const filename = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const ref = storage.ref().child(filename);
    const snap = await ref.put(file);
    return await snap.ref.getDownloadURL();
  } catch (err) {
    console.error("Firebase Storage Upload Error:", err);
    return null;
  }
}

function scaleImage(file, maxDim, cb) {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => cb(e.target.result);
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

function walkMins(lat1, lng1, lat2, lng2) { return Math.round(calculateDistanceInKm(lat1, lng1, lat2, lng2) * 1000 / WALK_M_PER_MIN); }
function getHotelObj(trip) {
  const list = (typeof hotelDatabase !== 'undefined' && hotelDatabase[getActiveHotelCity(trip)]) || [];
  return list.find(h => h.name === trip.activeHotel) || null;
}

function stationsNear(lat, lng, city, maxMins = 30) {
  return (stationDatabase[city] || []).map(s => ({ ...s, mins: walkMins(lat, lng, s.lat, s.lng) }))
    .filter(s => s.mins <= maxMins).sort((a, b) => a.mins - b.mins);
}
function stationLabel(lat, lng, city) {
  const s = stationsNear(lat, lng, city)[0];
  return s ? `${s.name} (${s.mins} min walk)` : "No station within 30 min walk";
}
function openImageViewer(src) { document.getElementById('image-viewer-img').src = src; openModal('modal-image'); }

// Open-Meteo Weather Integration
const WX = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌧️', 57: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️', 80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️', 95: '⛈️', 96: '⛈️', 99: '⛈️' };
const wxIcon = c => WX[c] || '🌡️';
let _wx = {};
function todayIso() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function tripDayIso(trip, n) { return new Date(new Date(trip.startDate).getTime() + (n - 1) * 864e5).toISOString().slice(0, 10); }
function tripTodayIndex(trip) {
  if (!trip || !trip.startDate) return 0;
  const n = Math.round((new Date(todayIso()) - new Date(trip.startDate)) / 864e5) + 1;
  return (n >= 1 && n <= getTotalTripDays(trip)) ? n : 0;
}
function weatherFor(trip, n) { const w = _wx[trip.id]; return (w && w.days && trip.startDate) ? w.days[tripDayIso(trip, n)] : null; }
function weatherPoint(trip) {
  const h = getHotelObj(trip); if (h) return { lat: h.lat, lng: h.lng };
  const p = (trip.places || []).find(x => x.lat && x.lng); return p ? { lat: p.lat, lng: p.lng } : null;
}
async function loadWeather(trip) {
  const pt = weatherPoint(trip);
  if (!pt || !trip.startDate) return;
  const key = 'lily_wx_' + trip.id, ptKey = pt.lat.toFixed(2) + ',' + pt.lng.toFixed(2);
  if (!_wx[trip.id]) { try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) _wx[trip.id] = c; } catch (e) {} }
  const cur = _wx[trip.id];
  if ((!cur || cur.pt !== ptKey || Date.now() - cur.fetched > 3 * 3600e3) && navigator.onLine) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`);
      const j = await r.json(), days = {};
      j.daily.time.forEach((t, i) => { days[t] = { code: j.daily.weathercode[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), pop: j.daily.precipitation_probability_max[i] }; });
      _wx[trip.id] = { fetched: Date.now(), pt: ptKey, days };
      try { localStorage.setItem(key, JSON.stringify(_wx[trip.id])); } catch (e) {}
    } catch (e) {}
  }
  renderTodayCard();
  if (!document.getElementById('page-itinerary')?.classList.contains('hidden')) renderItinerary();
}
function openTodayItinerary() { const t = getActiveTrip(); activeItineraryDay = tripTodayIndex(t) || 1; switchDashboardPage('itinerary'); }
function renderTodayCard() {
  const el = document.getElementById('today-card'), trip = getActiveTrip();
  if (!el || !trip) return;
  const total = getTotalTripDays(trip), idx = tripTodayIndex(trip);
  const until = trip.startDate ? Math.round((new Date(trip.startDate) - new Date(todayIso())) / 864e5) : null;
  const wxBox = w => w ? `<div class="text-right flex-shrink-0"><span class="text-3xl leading-none">${wxIcon(w.code)}</span><p class="text-[11px] font-bold mt-0.5">${w.max}° / ${w.min}°</p><p class="text-[10px] text-stone-500">☔ ${w.pop ?? 0}%</p></div>` : '';
  if (idx) {
    const acts = trip.itinerary.filter(a => a.day === idx).sort((x, y) => (x.time || '99').localeCompare(y.time || '99'));
    const now = new Date().toTimeString().slice(0, 5);
    const next = acts.find(a => a.time && a.time >= now) || acts.find(a => !a.time);
    el.innerHTML = `
      <div class="flex justify-between items-start gap-3">
        <div><p class="text-[10px] font-extrabold uppercase tracking-widest" style="color: var(--carnival-red);">Today • Day ${idx} of ${total}</p>
          <h3 class="font-extrabold text-lg leading-tight mt-0.5" style="color: var(--midnight-blue);">${dayParts(trip, idx).full || ''}</h3></div>
        ${wxBox(weatherFor(trip, idx))}
      </div>
      ${next ? `<div class="rounded-2xl p-3" style="background: var(--beige);"><p class="text-[10px] font-bold text-stone-500">NEXT UP</p><p class="font-bold text-sm mt-0.5" style="color: var(--dark-green);">${next.time ? next.time + ' • ' : ''}${escapeHtml(next.title)}</p>${next.location ? `<p class="text-[11px] text-stone-500 mt-0.5"><i class="fa-solid fa-location-dot me-1 text-rose-600"></i>${escapeHtml(next.location)}</p>` : ''}</div>` : '<p class="text-xs text-stone-500">Nothing left planned for today. Enjoy! 🦆</p>'}
      <button onclick="openTodayItinerary()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white" style="background-color: var(--midnight-blue);">Open today's plan</button>`;
  } else if (until !== null && until > 0) {
    const w = weatherFor(trip, 1);
    el.innerHTML = `
      <div class="flex justify-between items-start gap-3">
        <div><p class="text-[10px] font-extrabold uppercase tracking-widest" style="color: var(--carnival-red);">Coming up</p>
          <h3 class="font-extrabold text-xl leading-tight mt-0.5" style="color: var(--midnight-blue);">${until} day${until === 1 ? '' : 's'} to go 🦆</h3></div>
        ${wxBox(w)}
      </div>
      <p class="text-[11px] text-stone-500">${w ? 'Forecast for your first day.' : 'The forecast appears here about 16 days before you leave.'}</p>`;
  } else {
    el.innerHTML = `<p class="text-[10px] font-extrabold uppercase tracking-widest" style="color: var(--carnival-red);">Trip</p><h3 class="font-extrabold text-lg" style="color: var(--midnight-blue);">${until !== null && until <= -total ? 'Hope it was lovely! 🪷' : 'Dates not set yet'}</h3>`;
  }
}

// INSTALL + OFFLINE LOGIC
let _installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvt = e; showInstallCard(); });
window.addEventListener('appinstalled', () => document.getElementById('install-card')?.classList.add('hidden'));
function showInstallCard() {
  const card = document.getElementById('install-card');
  if (!card || isStandalone()) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!_installEvt && !ios) return;
  card.classList.remove('hidden');
  if (!_installEvt) { document.getElementById('install-hint').textContent = 'On iPhone: tap Share, then "Add to Home Screen".'; document.getElementById('install-btn').classList.add('hidden'); }
}
async function installApp() {
  if (!_installEvt) return;
  _installEvt.prompt();
  try { await _installEvt.userChoice; } catch (e) {}
  _installEvt = null; document.getElementById('install-card')?.classList.add('hidden');
}
function updateOnlinePill() { document.getElementById('offline-pill')?.classList.toggle('hidden', navigator.onLine); }
window.addEventListener('online', updateOnlinePill);
window.addEventListener('offline', updateOnlinePill);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

function loadCachedAppData() {
  try {
    const saved = localStorage.getItem('lily_pond_image2_data');
    if (!saved) return;
    appData = JSON.parse(saved); hydrateDeviceChecklists();
    renderHomeViews(); renderActiveTripDashboard();
  } catch (e) { console.warn('No saved copy yet', e); }
}

// INITIALIZATION
window.onload = function() {
  initHotelDatabase();
  showInstallCard(); updateOnlinePill(); loadCachedAppData();
  try { history.replaceState({ v: 'home' }, ''); } catch (e) {}
  listenToCloudChanges();
};

function initHotelDatabase() {
  if (typeof hotelDatabase === 'undefined' || !hotelDatabase) {
    window.hotelDatabase = {
      jakarta: [
        { name: "Hotel Grand Sahid Jaya", city: "Jakarta", lat: -6.210709476, lng: 106.8200146, nearestStation: "Setiabudi Astra (1 min walk)" },
        { name: "Park Hyatt Jakarta", city: "Jakarta", lat: -6.1845858, lng: 106.8313233, nearestStation: "Gondangdia (3 min walk)" }
      ],
      bandung: [
        { name: "The Papandayan Hotel", city: "Bandung", lat: -6.9242, lng: 107.6231, nearestStation: "Bandung Station (23 min walk)" },
        { name: "Padma Hotel Bandung", city: "Bandung", lat: -6.8488, lng: 107.6105, nearestStation: "No station nearby" }
      ]
    };
  }
}

const _photoCache = {}, _photoLoading = {};
function savePhotoDoc(id, data) {
  _photoCache[id] = data;
  db.collection("travelHub").doc("photo_" + id).set({ data }).catch(() => alert("Couldn't share that photo offline."));
}
function deletePhotoDoc(ref) { delete _photoCache[ref]; db.collection("travelHub").doc("photo_" + ref).delete().catch(() => {}); }
function fetchPhotoNow(ref) {
  if (_photoCache[ref]) return Promise.resolve(_photoCache[ref]);
  try {
    return db.collection("travelHub").doc("photo_" + ref).get()
      .then(d => { if (d.exists) { _photoCache[ref] = d.data().data; return _photoCache[ref]; } return null; }).catch(() => null);
  } catch (e) { return Promise.resolve(null); }
}
function docPhoto(i) {
  if (!i) return null;
  if (i.fileData) return i.fileData;
  if (!i.photoRef) return null;
  if (_photoCache[i.photoRef]) return _photoCache[i.photoRef];
  if (!_photoLoading[i.photoRef]) {
    _photoLoading[i.photoRef] = true;
    fetchPhotoNow(i.photoRef).then(d => { delete _photoLoading[i.photoRef]; if (d) { try { renderCategorizedPackingList(); renderSummaryPage(); renderItinerary(); } catch (e) {} } });
  }
  return null;
}

function checklistStorageKey(tripId) { return `lily_pond_device_checklists_${tripId}`; }
function saveDeviceChecklists() {
  try { appData.trips.forEach(t => localStorage.setItem(checklistStorageKey(t.id), JSON.stringify({ packing: ((t.checklists && t.checklists.packing) || []).filter(i => !i.shared) }))); } catch (e) {}
}

function hydrateDeviceChecklists() {
  (appData.trips || []).forEach(t => {
    const key = checklistStorageKey(t.id);
    let personal = null;
    try { const raw = localStorage.getItem(key); if (raw) personal = (JSON.parse(raw).packing || []).filter(i => !i.shared); } catch (e) {}
    if (!personal) {
      personal = ((t.checklists && t.checklists.packing) || []).filter(i => !i.shared);
      try { localStorage.setItem(key, JSON.stringify({ packing: personal })); } catch (e) {}
    }
    const shared = (t.sharedChecklist || []).map(i => ({ ...i, shared: true }));
    t.checklists = { packing: [...shared, ...personal] };
    delete t.sharedChecklist;
  });
}

function listenToCloudChanges() {
  const docRef = db.collection("travelHub").doc("sharedTripData");
  docRef.onSnapshot((doc) => {
    if (doc.exists) {
      const prevTrip = activeTripId, viewing = !document.getElementById('section-trip-dashboard')?.classList.contains('hidden');
      appData = doc.data();
      hydrateDeviceChecklists();
      if (appData.currentTripId) activeTripId = appData.currentTripId;
      let trip = getActiveTrip();
      if (trip && syncMasterLocations(trip)) saveAppData();

      localStorage.setItem("lily_pond_image2_data", JSON.stringify(appData));
      renderHomeViews();
      renderActiveTripDashboard();
      if (viewing && !(appData.trips || []).some(t => t.id === prevTrip)) openHomePage();
    } else {
      const trip = getActiveTrip();
      if (trip && typeof getAllMasterLocations === 'function' && (!trip.places || trip.places.length === 0)) {
        trip.places = getAllMasterLocations();
      }
      saveAppData();
    }
  }, (error) => {
    const saved = localStorage.getItem("lily_pond_image2_data");
    if (saved) { appData = JSON.parse(saved); hydrateDeviceChecklists(); }
    renderHomeViews();
    renderActiveTripDashboard();
  });
}

function syncMasterLocations(trip) {
  if (typeof getAllMasterLocations !== 'function') return false;
  let changed = false;
  getAllMasterLocations().forEach(m => {
    const p = trip.places.find(x => x.id === m.id);
    if (!p) { trip.places.push({ ...m }); changed = true; }
    else if (!p.lat && m.lat) { p.lat = m.lat; p.lng = m.lng; changed = true; }
  });
  return changed;
}

function renderSvgMap(el, pts, opts = {}) {
  if (!pts.length) { el.innerHTML = `<div class="h-28 flex items-center justify-center text-xs text-stone-400 px-6 text-center" style="background: var(--beige);">${opts.empty || 'No mapped places yet'}</div>`; return; }
  const W = 360, H = 190, pad = 28;
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const sx = Math.max((maxLng - minLng) * k, 1e-4), sy = Math.max(maxLat - minLat, 1e-4);
  const s = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const ox = (W - sx * s) / 2, oy = (H - sy * s) / 2;
  const P = pts.map(p => ({ ...p, x: ox + (p.lng - minLng) * k * s, y: oy + (maxLat - p.lat) * s }));
  const col = { stop: '#4D5A2E', you: '#E9767F', hotel: '#8A8C41', spot: '#C4BA65' };
  let km = 0;
  if (opts.route) for (let i = 1; i < pts.length; i++) km += calculateDistanceInKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  const pads = [[40, 150, 26], [300, 40, 20], [330, 160, 16], [150, 30, 14], [90, 100, 12]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#8A8C41" opacity=".13"/>`).join('');
  const path = opts.route && P.length > 1 ? `<polyline points="${P.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="none" stroke="#4D5A2E" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" opacity=".7"/>` : '';
  let n = 0;
  const pins = P.map(p => {
    const lab = (p.label || '').slice(0, 16);
    const inner = p.kind === 'stop' ? `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${++n}</text>` : '';
    return `<circle cx="${p.x}" cy="${p.y}" r="${p.kind === 'stop' ? 11 : 8}" fill="${col[p.kind] || col.spot}" stroke="#fff" stroke-width="2.5"/>${inner}<text x="${p.x}" y="${p.y + 24}" text-anchor="middle" font-size="9" font-weight="700" fill="#39431f" stroke="#F7F4E8" stroke-width="3" paint-order="stroke">${lab.replace(/&/g, '&amp;')}</text>`;
  }).join('');
  const cap = opts.caption || (opts.route ? `${pts.length} stop${pts.length > 1 ? 's' : ''} • ≈ ${km.toFixed(1)} km straight-line${km <= 8 ? ` • ~${Math.round(km * 1000 / WALK_M_PER_MIN)} min if on foot` : ' • includes train / car legs'}` : '');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="w-full block" style="background: linear-gradient(160deg, #F1ECD3, #E3E2B0);">${pads}${path}${pins}</svg>${cap ? `<div class="px-3.5 py-2 text-[11px] font-semibold text-white" style="background: var(--midnight-blue);">🦆 ${cap}</div>` : ''}`;
}

const _lmaps = {}, _pendingMaps = {};
function renderMiniMap(id, pts, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  pts = pts.filter(p => p.lat && p.lng);
  if (!window.L) return renderSvgMap(el, pts, opts);
  if (!el.offsetParent) { _pendingMaps[id] = [pts, opts]; return; }
  delete _pendingMaps[id];
  if (!pts.length) {
    if (_lmaps[id]) { try { _lmaps[id].map.remove(); } catch (e) {} delete _lmaps[id]; }
    el.innerHTML = `<div class="h-28 flex items-center justify-center text-xs text-stone-400 px-6 text-center" style="background: var(--beige);">${opts.empty || 'No mapped places yet'}</div>`;
    return;
  }
  let rec = _lmaps[id];
  if (!rec || !el.contains(rec.box)) {
    if (rec) { try { rec.map.remove(); } catch (e) {} }
    el.innerHTML = '<div class="live-map"></div><div class="live-map-cap"></div>';
    const box = el.firstChild;
    const map = L.map(box, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    rec = _lmaps[id] = { box, map, layer: L.layerGroup().addTo(map) };
    map.setView([pts[0].lat, pts[0].lng], 14);
  }
  rec.layer.clearLayers();
  let n = 0, km = 0;
  pts.forEach((p, i) => {
    const num = p.kind === 'stop' ? ++n : '';
    const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="pin pin-${p.kind || 'spot'}">${num}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) });
    if (p.label) m.bindTooltip(p.label, { direction: 'top', offset: [0, -12] });
    if (p.placeId) m.on('click', () => { const pl = (getActiveTrip().places || []).find(x => x.id === p.placeId); if (pl) openSpotDetailView(pl); });
    m.addTo(rec.layer);
    if (opts.route && i) km += calculateDistanceInKm(pts[i - 1].lat, pts[i - 1].lng, p.lat, p.lng);
  });
  if (opts.route && pts.length > 1) L.polyline(pts.map(p => [p.lat, p.lng]), { color: '#4D5A2E', weight: 4, opacity: .75, dashArray: '8 8' }).addTo(rec.layer);
  rec.fit = () => {
    rec.map.invalidateSize();
    if (pts.length > 1) rec.map.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 16 });
    else rec.map.setView([pts[0].lat, pts[0].lng], 15);
  };
  rec.fit();
  const cap = opts.caption || (opts.route ? `${pts.length} stop${pts.length > 1 ? 's' : ''} • ≈ ${km.toFixed(1)} km straight-line${km <= 8 ? ` • ~${Math.round(km * 1000 / WALK_M_PER_MIN)} min if on foot` : ' • includes train / car legs'}` : '');
  const capEl = el.lastChild; capEl.style.display = cap ? '' : 'none'; capEl.textContent = cap ? '🦆 ' + cap : '';
}

function flushPendingMaps() {
  Object.keys(_pendingMaps).forEach(id => renderMiniMap(id, ..._pendingMaps[id]));
  Object.values(_lmaps).forEach(r => { try { r.fit && r.fit(); } catch (e) {} });
}

function ensureLocation() {
  if (_locWatch !== null || !navigator.geolocation) return;
  _locWatch = navigator.geolocation.watchPosition(pos => {
    const moved = !userLoc.live || calculateDistanceInKm(userLoc.lat, userLoc.lng, pos.coords.latitude, pos.coords.longitude) > 0.03;
    userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, live: true, denied: false };
    if (moved) refreshLocationViews();
  }, () => { userLoc.live = false; userLoc.denied = true; refreshLocationViews(); }, { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 });
}

function refreshLocationViews() {
  if (!document.getElementById('page-master')?.classList.contains('hidden')) renderMasterPlacesList();
  if (!document.getElementById('page-waddle')?.classList.contains('hidden')) renderWaddleView();
  const d = document.getElementById('page-spot-detail');
  if (d && !d.classList.contains('hidden') && window._openSpotId) { const p = (getActiveTrip().places || []).find(x => x.id === window._openSpotId); if (p) openSpotDetailView(p, true); }
}

function navPush(state) { if (_popping) return; try { history.pushState(state, ''); } catch (e) {} }
window.addEventListener('popstate', e => {
  const s = e.state || { v: 'home' };
  _popping = true;
  try {
    if (s.v === 'trip' && getActiveTrip()) {
      document.getElementById('section-home')?.classList.add('hidden');
      document.getElementById('section-trip-dashboard')?.classList.remove('hidden');
      document.getElementById('floating-bottom-nav')?.classList.remove('hidden');
      switchDashboardPage(s.page || 'summary');
      if (s.spot) { const p = getActiveTrip().places.find(x => x.id === s.spot); if (p) openSpotDetailView(p); }
    } else openHomePage();
  } finally { _popping = false; }
});

function saveAppData() {
  appData.currentTripId = activeTripId;
  saveDeviceChecklists();
  const sharedData = JSON.parse(JSON.stringify(appData));
  (sharedData.trips || []).forEach(t => {
    t.sharedChecklist = ((t.checklists && t.checklists.packing) || []).filter(i => i.shared).map(i => { const c = { ...i }; delete c.fileData; return c; });
    delete t.checklists;
  });
  try { localStorage.setItem("lily_pond_image2_data", JSON.stringify(sharedData)); } catch (e) {}
  db.collection("travelHub").doc("sharedTripData").set(sharedData).catch((err) => console.error("Cloud sync error:", err));
}

function getActiveTrip() {
  let trip = appData.trips.find(t => t.id === activeTripId);
  if (!trip) {
    trip = appData.trips[0];
    if (trip) activeTripId = trip.id;
  }
  if (trip) {
    if (!trip.places) trip.places = [];
    trip.places.forEach(p => { if (!p.city && p.id && p.id.startsWith('jkt_')) p.city = 'Jakarta'; });
    if (!trip.itinerary) trip.itinerary = [];
    if (trip.checklists && trip.checklists.packing) trip.checklists.packing.forEach(i => { if (!i.id) i.id = 'd_' + Math.random().toString(36).slice(2, 9); });
    if (!trip.tickets) trip.tickets = [];
    if (!trip.checklists) trip.checklists = { packing: [] };
    if (!trip.expenses) trip.expenses = [];
  }
  return trip;
}

// NAVIGATION FUNCTIONS
function openHomePage(subTab = 'upcoming') {
  navPush({ v: 'home' });
  document.getElementById('section-home')?.classList.remove('hidden');
  document.getElementById('section-trip-dashboard')?.classList.add('hidden');
  document.getElementById('floating-bottom-nav')?.classList.add('hidden');
  switchHomeTab(subTab);
}

function switchHomeTab(tabName) {
  const upcomingView = document.getElementById('home-view-upcoming');
  const allView = document.getElementById('home-view-all');
  const btnUpcoming = document.getElementById('home-tab-upcoming');
  const btnAll = document.getElementById('home-tab-all');

  if (tabName === 'upcoming') {
    upcomingView?.classList.remove('hidden');
    allView?.classList.add('hidden');
    btnUpcoming?.classList.add('text-stone-800', 'bg-white', 'shadow-xs');
    btnUpcoming?.classList.remove('text-stone-500');
    btnAll?.classList.remove('text-stone-800', 'bg-white', 'shadow-xs');
    btnAll?.classList.add('text-stone-500');
  } else {
    upcomingView?.classList.add('hidden');
    allView?.classList.remove('hidden');
    btnAll?.classList.add('text-stone-800', 'bg-white', 'shadow-xs');
    btnAll?.classList.remove('text-stone-500');
    btnUpcoming?.classList.remove('text-stone-800', 'bg-white', 'shadow-xs');
    btnUpcoming?.classList.add('text-stone-500');
    renderAllTripsList();
  }
}

function switchDashboardPage(pageName) {
  const pages = ['summary', 'itinerary', 'waddle', 'master', 'checklists'];
  document.getElementById('page-spot-detail')?.classList.add('hidden');
  pages.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.add('hidden');
    const navBtn = document.getElementById(`nav-${p}`);
    if (navBtn) {
      navBtn.classList.remove('nav-item-active');
      navBtn.classList.add('text-stone-400');
    }
  });

  document.getElementById(`page-${pageName}`)?.classList.remove('hidden');
  const activeNav = document.getElementById(`nav-${pageName}`);
  if (activeNav) {
    activeNav.classList.add('nav-item-active');
    activeNav.classList.remove('text-stone-400');
  }

  const globalTripName = document.getElementById('global-trip-name');
  if (globalTripName) globalTripName.textContent = getActiveTrip()?.name || 'Your trip';
  if (pageName === 'summary') renderSummaryPage();
  if (pageName === 'itinerary') renderItinerary();
  if (pageName === 'master') renderLocationsPage();
  if (pageName === 'waddle') renderWaddleView();
  if (pageName === 'checklists') renderChecklistsAndExpenses();
  navPush({ v: 'trip', page: pageName });
  if (pageName === 'master' || pageName === 'waddle') ensureLocation();
  setTimeout(flushPendingMaps, 40);
}

function openTripDashboard(tripId) {
  activeTripId = tripId;
  saveAppData();
  document.getElementById('section-home')?.classList.add('hidden');
  document.getElementById('section-trip-dashboard')?.classList.remove('hidden');
  document.getElementById('floating-bottom-nav')?.classList.remove('hidden');

  const globalTripName = document.getElementById('global-trip-name'); 
  if (globalTripName) globalTripName.textContent = getActiveTrip()?.name || 'Your trip';
  renderActiveTripDashboard();
  const ti = tripTodayIndex(getActiveTrip()); 
  if (ti) activeItineraryDay = ti;
  switchDashboardPage('summary');
}

function renderHomeViews() {
  renderUpcomingTripsList();
  renderAllTripsList();
}

function isUpcoming(t) {
  const now = new Date(), lim = new Date(); lim.setMonth(lim.getMonth() + 6);
  const s = new Date(t.startDate), e = new Date(t.endDate || t.startDate);
  return (isNaN(e) || e >= now) && (isNaN(s) || s <= lim);
}

function renderUpcomingTripsList() {
  const container = document.getElementById('upcoming-trips-list');
  if (!container) return;
  container.innerHTML = "";
  const list = appData.trips.filter(isUpcoming).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  if (list.length === 0) {
    container.innerHTML = `<p class="text-xs text-stone-400 py-6 w-full text-center">No trips in the next 6 months. Tap + to plan one, or see All Trips.</p>`;
    return;
  }
  list.forEach(t => {
    const days = Math.ceil((new Date(t.startDate) - new Date()) / 864e5);
    const when = isNaN(days) ? 'Date TBD' : days > 0 ? `In ${days} days` : 'Ongoing';
    const card = document.createElement('div');
    card.className = "snap-start flex-shrink-0 w-64 h-44 rounded-3xl overflow-hidden shadow-md cursor-pointer active:scale-[0.98] transition-all";
    card.style.background = t.coverImage
      ? `linear-gradient(rgba(17,54,101,.1), rgba(10,51,35,.85)), url(${t.coverImage}) center/cover`
      : 'linear-gradient(135deg, var(--midnight-blue), var(--muted-teal))';
    card.onclick = () => openTripDashboard(t.id);
    card.innerHTML = `
      <div class="h-full flex flex-col justify-between p-4 text-white">
        <div class="flex justify-between items-start">
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style="background-color: var(--carnival-red);">${t.category || 'Trip'}</span>
          <span class="text-[10px] font-semibold bg-white/25 px-2 py-0.5 rounded-full">${when}</span>
        </div>
        <div>
          <h3 class="font-extrabold text-lg leading-tight">${t.name}</h3>
          <p class="text-[11px] text-white/80 mt-0.5">${t.startDate || 'TBD'} – ${t.endDate || 'TBD'} • ${t.people || ''}</p>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function renderAllTripsList() {
  const container = document.getElementById('all-trips-list');
  if (!container) return;
  container.innerHTML = "";
  const query = (document.getElementById('tripSearchInput')?.value || '').toLowerCase();
  const catFilter = document.getElementById('tripCategoryFilter')?.value || 'ALL';

  const filtered = appData.trips.filter(t => {
    const matchesQuery = t.name.toLowerCase().includes(query);
    const matchesCat = catFilter === 'ALL' || t.category === catFilter;
    return matchesQuery && matchesCat;
  });

  if (!filtered.length) {
    container.innerHTML = `<p class="text-xs text-stone-400 text-center py-8">${appData.trips.length ? 'No trips match your search.' : 'No trips yet. Tap + to plan one.'}</p>`;
    return;
  }
  filtered.forEach(trip => {
    const card = document.createElement('div');
    card.className = "lily-card p-4 flex justify-between items-center cursor-pointer bg-white/90";
    card.onclick = () => openTripDashboard(trip.id);
    card.innerHTML = `
      <div>
        <h4 style="color: var(--olive-green);" class="font-bold text-base">${trip.name}</h4>
        <p class="text-xs text-stone-400">${trip.category} • ${trip.startDate || 'TBD'}</p>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="event.stopPropagation(); confirmDeleteTrip('${trip.id}')" aria-label="Delete trip" class="w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
        <button class="text-xs px-3 py-1.5 rounded-xl font-semibold text-white" style="background-color: var(--rose-pink);">Open ➔</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// SUMMARY DASHBOARD PAGE
function renderSummaryPage() {
  const trip = getActiveTrip();
  if (!trip) return;
  renderTodayCard();

  document.getElementById('sum-trip-title').innerText = trip.name;
  document.getElementById('sum-trip-dates').innerText = `${trip.startDate || 'TBD'} – ${trip.endDate || 'TBD'}`;
  const pEl = document.getElementById('sum-card-people'); if (pEl) pEl.innerText = trip.people || '1 Pax';
  const bEl = document.getElementById('sum-card-budget'); if (bEl) bEl.innerText = trip.budget || 'RM 0';
  const banner = document.getElementById('sum-banner');
  if (banner) banner.style.background = trip.coverImage
    ? `linear-gradient(rgba(77,90,46,.4), rgba(57,67,31,.85)), url(${trip.coverImage}) center/cover`
    : 'linear-gradient(135deg, var(--midnight-blue), var(--dark-green))';

  const packingCount = (trip.checklists?.packing || []).length;
  const packedDone = (trip.checklists?.packing || []).filter(i => i.done).length;
  const packPercent = packingCount > 0 ? Math.round((packedDone / packingCount) * 100) : 100;
  
  const percentEl = document.getElementById('readiness-percent');
  if (percentEl) percentEl.innerText = `${packPercent}%`;
  
  const bar = document.getElementById('readiness-bar-fill');
  if (bar) bar.style.width = `${packPercent}%`;

  const docPreview = document.getElementById('summary-doc-preview');
  if (docPreview) {
    const docItems = (trip.checklists?.packing || []).filter(i => i.category === 'documents' && (i.fileData || i.photoRef));
    if (docItems.length > 0) {
      const topDoc = docItems[0];
      docPreview.innerHTML = `
        <div class="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Uploaded Document</span>
            <h4 style="color: var(--olive-green);" class="font-bold text-xs mt-1">${topDoc.text}</h4>
          </div>
          <img src="${docPhoto(topDoc) || PLACEHOLDER_IMG}" onclick="openImageViewer(this.src)" class="w-12 h-12 object-cover rounded-xl border border-stone-200 cursor-pointer" />
        </div>
      `;
    } else {
      docPreview.innerHTML = `<p class="text-xs text-stone-400 text-center py-2">No document photos attached yet. Add in Checklist → Docs!</p>`;
    }
  }

  renderStarredLocationsSummary();
  renderPostTravelInfographicCard(trip);
}

function renderPostTravelInfographicCard(trip) {
  const card = document.getElementById('post-travel-card');
  if (!card) return;
  const isPast = trip.endDate && new Date(trip.endDate) < new Date();
  if (isPast) {
    card.classList.remove('hidden');
    const spotsCount = (trip.places || []).filter(p => p.starred).length || (trip.places || []).length;
    let totalExp = 0;
    (trip.expenses || []).forEach(e => { totalExp += expToTrip(trip, e) || 0; });
    
    document.getElementById('stat-spots-count').textContent = spotsCount;
    document.getElementById('stat-expenses-total').textContent = fmtMoney(totalExp, tripCur(trip));
    document.getElementById('stat-days-count').textContent = getTotalTripDays(trip);
  } else {
    card.classList.add('hidden');
  }
}

function renderStarredLocationsSummary() {
  const trip = getActiveTrip();
  const container = document.getElementById('summary-starred-spots');
  const snapshotContainer = document.getElementById('summary-tentative-snapshot');

  if (container) {
    const starred = (trip.places || []).filter(p => p.starred === true).slice(0, 4);
    container.innerHTML = "";
    if (starred.length === 0) {
      container.innerHTML = `<p class="col-span-2 text-xs text-stone-400 py-3 text-center">No starred locations yet. Tap ⭐ in Spots!</p>`;
    } else {
      starred.forEach(p => {
        const card = document.createElement('div');
        card.className = "lily-card p-3 flex justify-between items-center text-xs col-span-2 sm:col-span-1 bg-white/80";
        card.innerHTML = `
          <div class="space-y-0.5 overflow-hidden">
            <h5 style="color: var(--olive-green);" class="font-bold text-xs truncate flex items-center gap-1">
              <span class="text-amber-500">★</span>
              <span class="truncate">${p.name}</span>
            </h5>
            <p class="text-stone-500 text-[10px] truncate">${p.city ? p.city + ' • ' : ''}${p.category}</p>
          </div>
          <a href="${p.map || '#'}" target="_blank" class="px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-emerald-50 text-emerald-800 flex-shrink-0 ms-2">Map ➔</a>
        `;
        container.appendChild(card);
      });
    }
  }

  if (snapshotContainer) {
    snapshotContainer.innerHTML = "";
    const starredItin = (trip.itinerary || []).filter(act => act.starred === true).sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
    if (starredItin.length === 0) {
      snapshotContainer.innerHTML = `<p class="text-xs text-stone-400 py-2 text-center">No starred itinerary activities looking forward to.</p>`;
    } else {
      starredItin.forEach(act => {
        const item = document.createElement('div');
        item.className = "flex justify-between items-center text-xs bg-white/80 p-2.5 rounded-2xl border border-stone-200/60";
        item.innerHTML = `
          <div>
            <strong style="color: var(--olive-green);" class="block font-bold text-xs flex items-center gap-1">
              <span class="text-amber-500 text-xs">★</span>
              <span>${act.title}</span>
            </strong>
            <span class="text-stone-400 text-[10px]">${act.time || 'TBD'} • Day ${act.day}</span>
          </div>
        `;
        snapshotContainer.appendChild(item);
      });
    }
  }
}

function getActiveHotelCity(trip) {
  const hotelName = trip.activeHotel || "";
  if (typeof hotelDatabase !== 'undefined' && hotelDatabase) {
    for (const [cityKey, cityHotels] of Object.entries(hotelDatabase)) {
      if (cityHotels.some(h => h.name === hotelName)) {
        return cityKey.toLowerCase();
      }
    }
  }
  return (trip.hotelCity || "bandung").toLowerCase();
}

function executeWaddleSearch() {
  renderWaddleView();
}

function renderWaddleView() {
  const container = document.getElementById('waddleSearchResults');
  const quickHubsContainer = document.getElementById('waddle-quick-hubs');
  if (!container) return;
  
  const trip = getActiveTrip();
  container.innerHTML = "";

  const activeCity = getActiveHotelCity(trip);
  const hotel = getHotelObj(trip);
  const ht = document.getElementById('waddle-hotel-title'); if (ht) ht.innerText = trip.activeHotel || 'No hotel selected';
  const hs = document.getElementById('waddle-hotel-station');
  if (hs) hs.innerText = hotel ? 'Nearest Station: ' + stationLabel(hotel.lat, hotel.lng, activeCity) : 'Choose a hotel to see nearby stations';
  const places = (trip.places || []).filter(p => (p.city || 'jakarta').toLowerCase() === activeCity);

  const stationCounts = {};
  places.forEach(p => {
    if (p.station && p.station !== 'N/A' && p.station !== 'No station nearby') {
      stationCounts[p.station] = (stationCounts[p.station] || 0) + 1;
    }
  });

  const topStations = (hotel ? stationsNear(hotel.lat, hotel.lng, activeCity) : []).map(s => s.name).filter(n => stationCounts[n]).slice(0, 3);

  if (quickHubsContainer) {
    quickHubsContainer.innerHTML = "";
    const hotelChip = document.createElement('button');
    hotelChip.className = `px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all ${selectedWaddleCluster === 'NEAR_HOTEL' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-stone-600 border border-stone-200'}`;
    hotelChip.innerHTML = `<i class="fa-solid fa-hotel me-1"></i>Near Hotel`;
    hotelChip.onclick = () => { selectedWaddleCluster = 'NEAR_HOTEL'; renderWaddleView(); };
    quickHubsContainer.appendChild(hotelChip);

    const meChip = document.createElement('button');
    meChip.className = `px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all ${selectedWaddleCluster === 'NEAR_ME' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-stone-600 border border-stone-200'}`;
    meChip.innerHTML = `<i class="fa-solid fa-location-crosshairs me-1"></i>Near me`;
    meChip.onclick = () => { selectedWaddleCluster = 'NEAR_ME'; ensureLocation(); renderWaddleView(); };
    quickHubsContainer.appendChild(meChip);

    topStations.forEach(stationName => {
      const chip = document.createElement('button');
      chip.className = `px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all ${selectedWaddleCluster === stationName ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-stone-600 border border-stone-200'}`;
      chip.innerText = `🚆 ${stationName}`;
      chip.onclick = () => { selectedWaddleCluster = stationName; renderWaddleView(); };
      quickHubsContainer.appendChild(chip);
    });
  }

  const searchQuery = (document.getElementById('waddleSearchInput')?.value || '').toLowerCase();
  const categoryBox = document.getElementById('waddle-category-filters');
  const categories = [...new Set(places.map(p => p.category || 'Other'))].sort();
  if (categoryBox) {
    const current = window.waddleCategoryFilter || 'ALL';
    categoryBox.innerHTML = '';
    ['ALL', ...categories].forEach(cat => { const b = document.createElement('button'); b.className = `px-3 py-1.5 rounded-full text-[11px] font-bold border ${current === cat ? 'text-white border-transparent' : 'bg-white text-stone-600 border-stone-200'}`; if (current === cat) b.style.backgroundColor = 'var(--midnight-blue)'; b.textContent = cat === 'ALL' ? 'All categories' : cat; b.onclick = () => { window.waddleCategoryFilter = cat; renderWaddleView(); }; categoryBox.appendChild(b); });
  }
  let filtered = (selectedWaddleCluster === 'NEAR_ME' ? (trip.places || []) : places).filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery) || (p.station || '').toLowerCase().includes(searchQuery) || (p.category || '').toLowerCase().includes(searchQuery) || (p.city || '').toLowerCase().includes(searchQuery);
    const matchesCategory = !window.waddleCategoryFilter || window.waddleCategoryFilter === 'ALL' || (p.category || 'Other') === window.waddleCategoryFilter;
    const matchesCluster = selectedWaddleCluster === 'NEAR_ME' ? !!(userLoc.live && p.lat && walkMins(userLoc.lat, userLoc.lng, p.lat, p.lng) <= 40) : selectedWaddleCluster === 'NEAR_HOTEL' ? (!hotel || !p.lat || walkMins(hotel.lat, hotel.lng, p.lat, p.lng) <= 30) : p.station === selectedWaddleCluster;
    return matchesSearch && matchesCategory && matchesCluster;
  });

  const meDist = p => (userLoc.live && p.lat) ? calculateDistanceInKm(userLoc.lat, userLoc.lng, p.lat, p.lng) : 0;
  if (selectedWaddleCluster === 'NEAR_ME') filtered.sort((a, b) => meDist(a) - meDist(b));
  const meNote = selectedWaddleCluster === 'NEAR_ME' && !userLoc.live ? (userLoc.denied ? 'Location is off. Allow it in your browser to see spots near you.' : 'Finding your location…') : '';
  const nearMe = userLoc.live
    ? filtered.filter(p => p.lat).map(p => ({ p, km: meDist(p) })).filter(x => x.km <= 5).sort((a, b) => a.km - b.km).slice(0, 12)
    : [];
  if (userLoc.live) {
    const pts = [{ lat: userLoc.lat, lng: userLoc.lng, label: 'You are here', kind: 'you' },
      ...nearMe.map(x => ({ lat: x.p.lat, lng: x.p.lng, label: x.p.name, kind: 'spot', placeId: x.p.id }))];
    if (hotel && calculateDistanceInKm(userLoc.lat, userLoc.lng, hotel.lat, hotel.lng) <= 5) pts.push({ lat: hotel.lat, lng: hotel.lng, label: trip.activeHotel || 'Hotel', kind: 'hotel' });
    renderMiniMap('waddle-map', pts, { caption: `Around you • ${nearMe.length} spot${nearMe.length === 1 ? '' : 's'} within 5 km` });
  } else {
    renderMiniMap('waddle-map', [...(hotel ? [{ lat: hotel.lat, lng: hotel.lng, label: trip.activeHotel || 'Hotel', kind: 'hotel' }] : []),
      ...filtered.filter(p => p.lat).slice(0, 12).map(p => ({ lat: p.lat, lng: p.lng, label: p.name, kind: 'spot', placeId: p.id }))],
      { caption: userLoc.denied ? 'Location is off, so this shows your hotel area' : 'Finding your location…', empty: 'No mapped spots here yet' });
  }
  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-stone-400 text-center py-6">${meNote || 'No spots found for this filter.'}</p>`;
    return;
  }

  filtered.forEach(p => {
    const div = document.createElement('div');
    div.className = "lily-card p-3.5 text-xs flex justify-between items-center mb-2 bg-white/80 cursor-pointer hover:border-amber-500 transition-all";
    div.onclick = () => openSpotDetailView(p);

    const stationTag = (p.station && p.station !== 'N/A' && p.station !== 'No station nearby')
      ? `<i class="fa-solid fa-train-subway me-1 text-emerald-700"></i>${p.station}`
      : `<i class="fa-solid fa-person-walking me-1 text-emerald-700"></i>${p.walk || 'Short Walk'}`;

    div.innerHTML = `
      <div class="flex items-center space-x-2.5">
        <div class="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
          <i class="fa-solid fa-dove text-sm"></i>
        </div>
        <div>
          <strong style="color: var(--olive-green);" class="text-sm font-bold block">${p.name}</strong>
          <p class="text-stone-500 text-[11px] mt-0.5">${stationTag} • ${p.category}${selectedWaddleCluster === 'NEAR_ME' && userLoc.live && p.lat ? ' • ' + walkMins(userLoc.lat, userLoc.lng, p.lat, p.lng) + ' min walk' : ''}</p>
        </div>
      </div>
      <span class="text-xs font-semibold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800">View ➔</span>
    `;
    container.appendChild(div);
  });
}

function openSpotDetailView(place, silent) {
  window._openSpotId = place.id;
  const container = document.getElementById('page-spot-detail');
  if (!container) return;
  const cur = ['summary', 'itinerary', 'waddle', 'master', 'checklists'].find(p => !document.getElementById('page-' + p)?.classList.contains('hidden'));
  if (cur && !silent) spotReturnPage = cur;
  if (!silent) navPush({ v: 'trip', page: 'master', spot: place.id });
  ['summary', 'itinerary', 'waddle', 'master', 'checklists'].forEach(p => document.getElementById('page-' + p)?.classList.add('hidden'));
  container.classList.remove('hidden');

  const trip = getActiveTrip(), hotel = getHotelObj(trip);
  const imgs = (place.gallery && place.gallery.length) ? place.gallery : [];
  const hasSt = place.station && place.station !== 'N/A' && place.station !== 'No station nearby';
  const meKm = userLoc.live && place.lat ? calculateDistanceInKm(userLoc.lat, userLoc.lng, place.lat, place.lng) : null;
  const meMins = meKm !== null ? Math.round(meKm * 1000 / WALK_M_PER_MIN) : null;
  const dir = place.lat ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}` : (place.map || 'https://maps.google.com/?q=' + encodeURIComponent(place.name));
  const tiles = [
    ['fa-tag', 'Category', place.category || 'Spot'],
    ['fa-train-subway', 'Nearest station', hasSt ? place.station : 'None nearby'],
    ['fa-person-walking', 'From me', meMins !== null ? meMins + ' min walk' : 'Location off'],
    ['fa-route', 'Distance', meKm !== null ? meKm.toFixed(1) + ' km' : 'Location off']
  ].map(([ic, k, v]) => `<div class="flex items-center gap-2.5 rounded-2xl p-3" style="background: var(--beige);"><span class="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0" style="color: var(--muted-teal);"><i class="fa-solid ${ic} text-sm"></i></span><div class="min-w-0"><p class="text-[10px] text-stone-500">${k}</p><p class="text-xs font-bold truncate" style="color: var(--dark-green);">${escapeHtml(v)}</p></div></div>`).join('');

  container.innerHTML = `
    <div class="animate-fadeIn -mx-4 md:mx-auto md:max-w-3xl">
      <div class="relative h-64 md:rounded-3xl overflow-hidden" style="background: linear-gradient(160deg,#E3E2B0,#8A8C41);">
        ${imgs[0] ? `<img id="spot-detail-main-img" src="${imgs[0]}" onclick="openImageViewer(this.src)" class="w-full h-full object-cover cursor-pointer">` : `<div class="w-full h-full flex items-center justify-center text-7xl">${SPOT_EMOJI[place.category] || '📍'}</div>`}
        <button onclick="closeSpotDetail()" aria-label="Back" class="absolute top-3 left-3 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center" style="color: var(--midnight-blue);"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="absolute top-3 right-3 flex gap-2">
          <button onclick="openEditSpotModal('${place.id}')" aria-label="Edit" class="w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center" style="color: var(--midnight-blue);"><i class="fa-solid fa-pen text-sm"></i></button>
          <button onclick="toggleStarSpot('${place.id}'); openSpotDetailView(getActiveTrip().places.find(p => p.id === '${place.id}'));" aria-label="Favourite" class="w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center text-lg">${place.starred ? '<span class="text-amber-500">★</span>' : '<span class="text-stone-400">☆</span>'}</button>
        </div>
        <button onclick="triggerSpotPhotoUpload('${place.id}')" class="absolute bottom-9 right-3 bg-black/55 text-white px-3 py-1.5 rounded-full text-[10px] font-semibold"><i class="fa-solid fa-camera me-1"></i>Add photo</button>
      </div>
      <div class="relative -mt-6 bg-white rounded-t-[1.75rem] md:rounded-3xl md:mt-4 p-5 space-y-4 shadow-sm border border-stone-100">
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0">
            <h2 class="font-extrabold text-xl leading-tight" style="color: var(--dark-green);">${escapeHtml(place.name)}</h2>
            <p class="text-xs text-stone-500 mt-1"><i class="fa-solid fa-location-dot me-1 text-rose-600"></i>${escapeHtml(place.city || '')}${hasSt ? ' • ' + escapeHtml(place.station) : ''}</p>
          </div>
          ${meMins !== null ? `<div class="flex-shrink-0 w-14 py-1.5 rounded-2xl text-center" style="background: var(--beige); color: var(--midnight-blue);"><span class="block text-lg font-extrabold leading-none">${meMins}</span><span class="block text-[9px] font-semibold mt-0.5">min walk</span></div>` : ''}
        </div>
        <div><p class="font-bold text-sm mb-1" style="color: var(--midnight-blue);">About this spot</p>
          <p class="text-xs text-stone-600 leading-relaxed">${place.desc ? escapeHtml(place.desc) : 'A saved spot for your trip. Tap the pencil to update its details, add photos from your visit, or add it to a day in your itinerary.'}</p></div>
        <div><p class="font-bold text-sm mb-2" style="color: var(--midnight-blue);">Details</p><div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2.5">${tiles}</div></div>
        ${imgs.length > 1 ? `<div id="spot-gallery-thumbs" class="flex gap-2 overflow-x-auto pb-1">${imgs.map(u => `<img src="${u}" onclick="document.getElementById('spot-detail-main-img').src=this.src" class="w-14 h-14 object-cover rounded-xl border border-stone-200 cursor-pointer">`).join('')}</div>` : ''}
        <div class="flex gap-2 pt-1">
          <a href="${dir}" target="_blank" rel="noopener" class="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm" style="background-color: var(--midnight-blue);"><i class="fa-solid fa-diamond-turn-right"></i> Get directions</a>
          <button onclick="addSpotToItinerary('${place.id}')" aria-label="Add to itinerary" class="w-14 rounded-2xl border border-stone-200 flex items-center justify-center" style="color: var(--midnight-blue);"><i class="fa-solid fa-calendar-plus"></i></button>
        </div>
      </div>
    </div>`;
  if (!silent) window.scrollTo({ top: 0 });
}

function addSpotToItinerary(placeId) {
  const p = (getActiveTrip().places || []).find(x => x.id === placeId);
  if (!p) return;
  switchDashboardPage('itinerary');
  openItineraryModal();
  const t = document.getElementById('itin-form-title'); if (t && !t.value) t.value = p.name;
  const loc = document.getElementById('itin-form-location'); if (loc && !loc.value) loc.value = p.name;
  const sel = document.getElementById('itin-form-place');
  if (sel) { sel.value = p.id; sel.dispatchEvent(new Event('change', { bubbles: true })); }
}

function closeSpotDetail() {
  if (history.state && history.state.spot) { history.back(); return; }
  switchDashboardPage(spotReturnPage || 'master');
}

function triggerSpotPhotoUpload(placeId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = await uploadImageToFirebase(f, "spot_photos");
    const place = getActiveTrip().places.find(p => p.id === placeId);
    if (place) {
      const finalUrl = url || await new Promise(res => scaleImage(f, 800, res));
      (place.gallery = place.gallery || []).unshift(finalUrl); 
      saveAppData(); 
      openSpotDetailView(place); 
    }
  };
  input.click();
}

// SPOTS PAGE (UPDATED CITY FILTERING)
function renderLocationsPage() { renderMasterPlacesList(); }
function toggleSpotsAllCities() { spotsAllCities = !spotsAllCities; masterCat = 'ALL'; renderMasterPlacesList(); }

function renderMasterPlacesList() {
  const container = document.getElementById('masterPlacesContainer');
  if (!container) return;
  const trip = getActiveTrip();
  
  const currentCity = getActiveHotelCity(trip) || "bandung";
  const cityName = currentCity.charAt(0).toUpperCase() + currentCity.slice(1);
  const q = (document.getElementById('masterSearchInput')?.value || '').trim().toLowerCase();

  const seen = new Set();
  const pool = (trip.places || []).filter(p => spotsAllCities || (p.city || currentCity).toLowerCase() === currentCity.toLowerCase()).filter(p => {
    const k = (p.name || '').trim().toLowerCase() + '|' + (p.city || '').toLowerCase();
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  const note = document.getElementById('spots-city-note');
  if (note) {
    note.innerHTML = `${spotsAllCities ? 'All Cities' : cityName + ' Spots'} • <button onclick="toggleSpotsAllCities()" class="underline font-semibold">${spotsAllCities ? 'Show ' + cityName + ' Only' : 'Show All Cities'}</button>${userLoc.live ? ' • Nearest first' : ''}`;
  }

  const cats = ['ALL', ...new Set(pool.map(p => p.category || 'Other'))];
  if (!cats.includes(masterCat)) masterCat = 'ALL';
  const box = document.getElementById('master-category-chips');
  if (box) {
    box.innerHTML = '';
    cats.forEach(c => {
      const b = document.createElement('button'), on = masterCat === c;
      b.className = `px-4 py-1.5 rounded-full text-[11px] font-bold border flex-shrink-0 ${on ? 'text-white border-transparent' : 'bg-white text-stone-600 border-stone-200'}`;
      if (on) b.style.backgroundColor = 'var(--muted-teal)';
      b.textContent = c === 'ALL' ? 'All' : c;
      b.onclick = () => { masterCat = c; renderMasterPlacesList(); };
      box.appendChild(b);
    });
  }

  const dist = p => (userLoc.live && p.lat) ? calculateDistanceInKm(userLoc.lat, userLoc.lng, p.lat, p.lng) : null;
  const list = pool.filter(p => (masterCat === 'ALL' || (p.category || 'Other') === masterCat) && (!q || (p.name || '').toLowerCase().includes(q) || (p.station || '').toLowerCase().includes(q)))
    .sort((a, b) => { const x = dist(a), y = dist(b); if (x !== null && y !== null) return x - y; if (x !== null) return -1; if (y !== null) return 1; return (a.name || '').localeCompare(b.name || ''); });

  container.innerHTML = '';
  if (list.length === 0) { 
    container.innerHTML = `<p class="text-xs text-stone-400 text-center py-8 col-span-full">No spots found in ${cityName}. Tap <b>+</b> to add a spot in a new or existing city!</p>`; 
    return; 
  }
  
  list.forEach(p => {
    const d = dist(p), img = p.gallery && p.gallery[0];
    const hasSt = p.station && p.station !== 'N/A' && p.station !== 'No station nearby';
    const card = document.createElement('div');
    card.className = 'lily-card p-2.5 flex gap-3 items-center cursor-pointer bg-white';
    card.onclick = () => openSpotDetailView(p);
    card.innerHTML = `
      <div class="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl" style="background: linear-gradient(160deg,#E3E2B0,#C4BA65);">${img ? `<img src="${img}" class="w-full h-full object-cover">` : (SPOT_EMOJI[p.category] || '📍')}</div>
      <div class="min-w-0 flex-1 space-y-0.5">
        <p class="text-[10px] font-extrabold uppercase tracking-wide" style="color: var(--muted-teal);">${escapeHtml(p.category || 'Spot')} • ${escapeHtml(p.city || cityName)}</p>
        <h4 class="font-extrabold text-sm leading-snug" style="color: var(--dark-green);">${escapeHtml(p.name)}</h4>
        <p class="text-[11px] text-stone-500 truncate"><i class="fa-solid ${hasSt ? 'fa-train-subway' : 'fa-person-walking'} me-1"></i>${escapeHtml(hasSt ? p.station : (p.walk || 'No station nearby'))}</p>
        ${d !== null ? `<p class="text-[11px] font-semibold" style="color: var(--muted-teal);"><i class="fa-solid fa-location-arrow me-1"></i>${d.toFixed(1)} km • ~${Math.round(d * 1000 / WALK_M_PER_MIN)} min walk</p>` : ''}
      </div>
      <button onclick="event.stopPropagation(); toggleStarSpot('${p.id}')" class="text-xl px-1 flex-shrink-0" aria-label="Favourite">${p.starred ? '<span class="text-amber-500">★</span>' : '<span class="text-stone-300">☆</span>'}</button>`;
    container.appendChild(card);
  });
}

function toggleStarSpot(placeId) {
  const trip = getActiveTrip();
  const place = (trip.places || []).find(p => p.id === placeId);
  if (place) {
    place.starred = !place.starred;
    saveAppData();
    renderLocationsPage();
    renderWaddleView();
    renderSummaryPage();
  }
}

function unstarAllLocations() {
  const trip = getActiveTrip();
  if (!trip || !trip.places) return;
  if (confirm("Unstar all locations?")) {
    trip.places.forEach(p => p.starred = false);
    saveAppData();
    renderLocationsPage();
    renderWaddleView();
    renderSummaryPage();
  }
}

// ITINERARY TIMELINE
function getTotalTripDays(trip) {
  if (!trip.startDate || !trip.endDate) return 5;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return isNaN(diffDays) || diffDays <= 0 ? 5 : diffDays;
}

function dayParts(trip, d) {
  if (!trip.startDate) return { wd: 'Day', dd: d };
  const dt = new Date(new Date(trip.startDate).getTime() + (d - 1) * 864e5);
  return { wd: dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }), dd: dt.getUTCDate(),
    full: dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }) };
}

function resolveCoord(trip, a) {
  if (a.placeId === 'hotel') { const h = getHotelObj(trip); if (h) return h; }
  const byId = a.placeId && trip.places.find(p => p.id === a.placeId);
  if (byId && byId.lat) return byId;
  const txt = ((a.location || '') + ' ' + (a.title || '')).toLowerCase();
  const pools = [trip.places.filter(p => p.lat), Object.values(hotelDatabase).flat(), Object.values(stationDatabase).flat()];
  for (const pool of pools) { const m = pool.find(x => txt.includes(x.name.toLowerCase())); if (m) return m; }
  return null;
}

function openDocById(id) {
  const d = getActiveTrip().checklists.packing.find(i => i.id === id);
  const ph = d && docPhoto(d);
  if (ph) openImageViewer(ph);
  else { switchDashboardPage('checklists'); selectPackingCategory('documents'); }
}

function renderItinerary() {
  const trip = getActiveTrip();
  const box = document.getElementById('itinerary-timeline-container'), strip = document.getElementById('itin-day-strip');
  if (!box || !strip) return;
  const total = getTotalTripDays(trip);
  if (activeItineraryDay > total) activeItineraryDay = 1;
  const sub = document.getElementById('itin-subtitle');
  if (sub) sub.innerText = `${trip.name} • ${total} days`;

  strip.innerHTML = "";
  for (let d = 1; d <= total; d++) {
    const p = dayParts(trip, d), on = d === activeItineraryDay;
    const b = document.createElement('button');
    b.className = `flex-shrink-0 w-14 py-2 rounded-2xl text-center transition-all ${on ? 'text-white shadow-md' : 'bg-white text-stone-500 border border-stone-200'}`;
    if (on) b.style.backgroundColor = 'var(--midnight-blue)';
    b.innerHTML = `<span class="block text-[10px] font-semibold">${p.wd}</span><span class="block text-lg font-extrabold leading-tight">${p.dd}</span><span class="block text-[9px] opacity-70">Day ${d}</span>${(() => { const w = weatherFor(trip, d); return w ? `<span class="block text-[10px] mt-0.5">${wxIcon(w.code)}${w.max}°</span>` : ''; })()}`;
    if (d === tripTodayIndex(trip)) b.style.boxShadow = '0 0 0 2px var(--carnival-red)';
    b.onclick = () => { activeItineraryDay = d; renderItinerary(); };
    strip.appendChild(b);
  }

  const acts = trip.itinerary.map((a, i) => ({ a, i })).filter(x => x.a.day === activeItineraryDay)
    .sort((x, y) => (x.a.time || '99').localeCompare(y.a.time || '99'));
  const pts = acts.map(({ a }) => { const c = resolveCoord(trip, a); return c ? { lat: c.lat, lng: c.lng, label: a.title, kind: 'stop' } : null; }).filter(Boolean);
  renderMiniMap('itin-map', pts, { route: true, empty: 'Pin activities to a spot or your hotel to see the day on the map' });

  const head = `<p class="font-bold text-sm mb-3" style="color: var(--midnight-blue);">${dayParts(trip, activeItineraryDay).full || 'Day ' + activeItineraryDay}</p>`;
  if (acts.length === 0) { box.innerHTML = head + `<p class="text-xs text-stone-400 py-6 text-center">Nothing planned yet. Tap + Add Activity.</p>`; return; }
  box.innerHTML = head + acts.map(({ a, i }) => {
    const doc = a.docId && trip.checklists.packing.find(x => x.id === a.docId);
    return `
    <div class="flex gap-2">
      <div class="w-12 text-right text-[11px] font-bold text-stone-400 pt-3.5 flex-shrink-0">${a.time || '—'}</div>
      <div class="relative pl-5 pb-4 flex-1 min-w-0 border-l-2 border-dashed ms-1.5" style="border-color: rgba(138,140,65,.4);">
        <span class="absolute -left-[7px] top-4 w-3 h-3 rounded-full bg-white border-2" style="border-color: var(--muted-teal);"></span>
        <div class="lily-card p-3.5 bg-white space-y-1.5">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <p class="font-bold text-sm text-stone-800">${a.title}</p>
              ${a.location ? `<p class="text-[11px] text-stone-500 mt-0.5"><i class="fa-solid fa-location-dot me-1 text-rose-600"></i>${a.location}</p>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick="toggleStarItineraryActivity(${i})">${a.starred ? '<span class="text-amber-500">★</span>' : '<span class="text-stone-300">☆</span>'}</button>
              <button onclick="openEditItineraryModal(${i})" class="text-stone-300 hover:text-stone-600"><i class="fa-solid fa-pen text-[10px]"></i></button>
              <button onclick="deleteItineraryActivity(${i})" class="text-stone-300 hover:text-red-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
          </div>
          ${a.notes ? `<p class="text-[11px] text-stone-400">${a.notes}</p>` : ''}
          ${doc ? `<button onclick="openDocById('${doc.id}')" class="w-full flex items-center gap-2 rounded-xl p-2 text-left" style="background: var(--beige);">
            ${docPhoto(doc) ? `<img src="${docPhoto(doc)}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0">` : '<i class="fa-solid fa-ticket text-stone-500 px-2"></i>'}
            <span class="text-[11px] font-semibold flex-1 truncate" style="color: var(--midnight-blue);">${doc.text}</span>
            <span class="text-[10px] font-bold" style="color: var(--muted-teal);">View</span></button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleStarItineraryActivity(realIdx) {
  const trip = getActiveTrip();
  if (trip.itinerary && trip.itinerary[realIdx]) {
    trip.itinerary[realIdx].starred = !trip.itinerary[realIdx].starred;
    saveAppData();
    renderItinerary();
    renderSummaryPage();
  }
}

function fillItinSelects(selPlace, selDoc) {
  const trip = getActiveTrip(), h = getHotelObj(trip);
  const options = [];
  if (h) options.push({ id: 'hotel', name: h.name, extra: 'Hotel' });
  (trip.places || []).forEach(p => options.push({ id: p.id, name: p.name, extra: p.city || p.category || 'Spot' }));
  (typeof stationDatabase !== 'undefined' ? Object.values(stationDatabase).flat() : []).forEach(s => options.push({ id: '', name: s.name, extra: 'Station' }));
  window.itinLocationOptions = options.filter(o => o.name).filter((o, i, arr) => arr.findIndex(x => x.name.toLowerCase() === o.name.toLowerCase()) === i);
  const placeInput = document.getElementById('itin-form-location');
  const hidden = document.getElementById('itin-form-place');
  const selected = options.find(o => o.id && o.id === selPlace);
  if (placeInput && selected) placeInput.value = selected.name;
  if (hidden) hidden.value = selPlace || '';
  document.getElementById('itin-form-doc').innerHTML = '<option value="">None</option>'
    + (trip.checklists?.packing || []).filter(i => i.category === 'documents').map(i => `<option value="${i.id}" ${i.id === selDoc ? 'selected' : ''}>${i.shared ? '👥 ' : '🔒 '}${i.text}${(i.fileData || i.photoRef) ? ' 📷' : ''}</option>`).join('');
  document.getElementById('itin-form-docfile').value = '';
}

function onItinPlacePick() {
  const loc = document.getElementById('itin-form-location');
  const hidden = document.getElementById('itin-form-place');
  if (!loc || !hidden) return;
  const text = loc.value.trim().toLowerCase();
  const match = (window.itinLocationOptions || []).find(o => (o.name || '').toLowerCase() === text && o.id);
  hidden.value = match ? match.id : '';
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); }

function renderItinLocationPopup() {
  const input = document.getElementById('itin-form-location');
  const popup = document.getElementById('itin-location-popup');
  if (!input || !popup) return;
  const query = input.value.trim().toLowerCase();
  const all = window.itinLocationOptions || [];
  const matches = all.filter(o => !query || `${o.name} ${o.extra || ''}`.toLowerCase().includes(query)).slice(0, 8);
  if (!matches.length) {
    popup.innerHTML = `<div class="location-suggestion-empty">No saved matches — your custom location is fine</div>`;
  } else {
    popup.innerHTML = matches.map((o, i) => `<button type="button" role="option" class="location-suggestion-item" data-location-index="${i}" onmousedown="event.preventDefault(); chooseItinLocation(${i}, this)"><span class="location-suggestion-pin"><i class="fa-solid ${o.extra === 'Hotel' ? 'fa-bed' : o.extra === 'Station' ? 'fa-train' : 'fa-location-dot'}"></i></span><span class="location-suggestion-copy"><span class="location-suggestion-name">${escapeHtml(o.name)}</span><span class="location-suggestion-meta">${escapeHtml(o.extra || 'Saved place')}</span></span><i class="fa-solid fa-arrow-up-left-from-circle location-suggestion-arrow"></i></button>`).join('');
    popup.dataset.count = String(matches.length);
    popup._matches = matches;
  }
  popup.classList.remove('hidden');
}

function chooseItinLocation(index, button) {
  const popup = document.getElementById('itin-location-popup');
  const input = document.getElementById('itin-form-location');
  const hidden = document.getElementById('itin-form-place');
  const item = popup?._matches?.[index];
  if (!item || !input || !hidden) return;
  input.value = item.name;
  hidden.value = item.id || '';
  popup.classList.add('hidden');
}

function handleItinLocationKeydown(event) {
  if (event.key === 'Escape') document.getElementById('itin-location-popup')?.classList.add('hidden');
  if (event.key === 'Enter') {
    const popup = document.getElementById('itin-location-popup');
    if (popup && !popup.classList.contains('hidden') && popup._matches?.length) {
      event.preventDefault(); chooseItinLocation(0);
    }
  }
}

function openItineraryModal(day) {
  editingItineraryIndex = null;
  if (day) activeItineraryDay = day;
  ['title', 'time', 'location', 'notes'].forEach(k => { document.getElementById('itin-form-' + k).value = ''; });
  fillItinSelects('', '');
  document.getElementById('itin-modal-title').innerText = `Day ${activeItineraryDay} • Add Activity`;
  openModal('modal-itinerary');
}

function openEditItineraryModal(idx) {
  const act = getActiveTrip().itinerary[idx];
  if (!act) return;
  editingItineraryIndex = idx;
  activeItineraryDay = act.day;
  ['title', 'time', 'location', 'notes'].forEach(k => { document.getElementById('itin-form-' + k).value = act[k] || ''; });
  fillItinSelects(act.placeId || '', act.docId || '');
  document.getElementById('itin-modal-title').innerText = `Day ${act.day} • Edit Activity`;
  openModal('modal-itinerary');
}

function saveItineraryForm() {
  const v = k => document.getElementById('itin-form-' + k).value.trim();
  if (!v('title')) return alert("Enter activity title!");
  const trip = getActiveTrip();
  const file = document.getElementById('itin-form-docfile').files[0];
  const finish = (data) => {
    let docId = document.getElementById('itin-form-doc').value || null;
    if (data) {
      docId = 'd_' + Date.now();
      savePhotoDoc(docId, data);
      trip.checklists.packing.push({ id: docId, text: v('title') + ' (ticket)', category: 'documents', done: false, important: false, shared: true, photoRef: docId });
    }
    const act = { day: activeItineraryDay, title: v('title'), time: v('time'), location: v('location'), notes: v('notes'),
      starred: false, placeId: (document.getElementById('itin-form-place').value || null), docId };
    if (editingItineraryIndex !== null && trip.itinerary[editingItineraryIndex]) {
      act.starred = trip.itinerary[editingItineraryIndex].starred || false;
      trip.itinerary[editingItineraryIndex] = act;
    } else trip.itinerary.push(act);
    saveAppData(); closeModal('modal-itinerary'); renderItinerary(); renderSummaryPage();
  };
  if (file) scaleImage(file, 1100, finish); else finish(null);
}

function deleteItineraryActivity(realIdx) {
  const trip = getActiveTrip();
  if (trip.itinerary && trip.itinerary[realIdx]) {
    trip.itinerary.splice(realIdx, 1);
    saveAppData();
    renderItinerary();
    renderSummaryPage();
  }
}

// PACKING & EXPENSES SUB-TAB LOGIC
function selectPackingCategory(cat) {
  activePackingCategory = cat;
  const categories = ['clothes', 'toiletries', 'electronics', 'documents'];
  categories.forEach(c => {
    const btn = document.getElementById(`pack-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.classList.add('bg-amber-600', 'text-white', 'shadow-xs');
        btn.classList.remove('text-stone-400');
      } else {
        btn.classList.remove('bg-amber-600', 'text-white', 'shadow-xs');
        btn.classList.add('text-stone-400');
      }
    }
  });
  renderCategorizedPackingList();
}

function renderCategorizedPackingList() {
  const container = document.getElementById('packing-items-container');
  if (!container) return;
  const trip = getActiveTrip();
  container.innerHTML = "";

  const packingQuery = (document.getElementById('packingSearchInput')?.value || '').trim().toLowerCase();
  const items = (trip.checklists.packing || []).filter(item => (item.category || 'clothes') === activePackingCategory && (item.text || '').toLowerCase().includes(packingQuery));

  items.sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));

  if (items.length === 0) {
    container.innerHTML = `<p class="text-xs text-stone-400 text-center py-6">${packingQuery ? 'No matching items. Try another search.' : 'No items in this category yet. Tap “Add” to create one.'}</p>`;
    return;
  }

  items.forEach((item) => {
    const realIdx = trip.checklists.packing.indexOf(item);
    const div = document.createElement('div');
    div.className = "flex flex-col space-y-2 bg-white/90 p-3.5 rounded-2xl border border-stone-200/60";
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <label class="flex items-center space-x-2.5 cursor-pointer">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="togglePackingDone(${realIdx})" class="rounded text-amber-600">
          <span class="${item.done ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}">${item.text}</span>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style="${item.shared ? 'background:#E3E6B8;color:var(--midnight-blue);' : 'background:#f1efe4;color:#8a8a7a;'}">${item.shared ? '👥 Shared' : '🔒 Only me'}</span>
        </label>
        <div class="flex items-center space-x-2">
          <button onclick="togglePackingImportant(${realIdx})" class="focus:outline-none">
            <i class="fa-solid fa-thumbtack ${item.important ? 'text-amber-500' : 'text-stone-300 hover:text-amber-400'} text-xs"></i>
          </button>
          <button onclick="openEditPackingItem(${realIdx})" class="text-stone-300 hover:text-stone-600"><i class="fa-solid fa-pen text-xs"></i></button>
          <button onclick="deletePackingItem(${realIdx})" class="text-stone-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
      ${docPhoto(item) ? `<img src="${docPhoto(item)}" onclick="openImageViewer(this.src)" class="w-full h-32 object-cover rounded-xl border border-stone-100 mt-1 cursor-pointer" />` : ''}
    `;
    container.appendChild(div);
  });
}

function openPackingItemModal() {
  editingPackingIndex = null;
  document.getElementById('pack-form-text').value = "";
  document.getElementById('pack-form-category').value = activePackingCategory;
  document.getElementById('pack-form-file').value = "";
  document.getElementById('pack-form-shared').checked = false;
  document.getElementById('modal-packing-title').innerText = "Add Packing Item";
  toggleDocUploadVisibility();
  openModal('modal-packing');
}

function openEditPackingItem(idx) {
  const it = getActiveTrip().checklists.packing[idx];
  if (!it) return;
  editingPackingIndex = idx;
  document.getElementById('pack-form-text').value = it.text;
  document.getElementById('pack-form-category').value = it.category || 'clothes';
  document.getElementById('pack-form-file').value = "";
  document.getElementById('pack-form-shared').checked = !!it.shared;
  document.getElementById('modal-packing-title').innerText = "Edit Item";
  toggleDocUploadVisibility();
  openModal('modal-packing');
}

function toggleDocUploadVisibility() {
  const cat = document.getElementById('pack-form-category')?.value;
  document.getElementById('pack-doc-upload-container')?.classList.toggle('hidden', cat !== 'documents');
}

function savePackingItemForm() {
  const text = document.getElementById('pack-form-text').value.trim();
  const category = document.getElementById('pack-form-category').value;
  const shared = document.getElementById('pack-form-shared').checked;
  const file = document.getElementById('pack-form-file')?.files?.[0];
  if (!text) return alert("Enter item name!");
  const trip = getActiveTrip();
  if (!trip.checklists.packing) trip.checklists.packing = [];
  const list = trip.checklists.packing;
  
  const finish = async (newData) => {
    let it;
    if (editingPackingIndex !== null && list[editingPackingIndex]) it = list[editingPackingIndex];
    else { it = { id: 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), done: false, important: false, fileData: null }; list.push(it); }
    it.text = text; it.category = category;
    let photo = newData || it.fileData || null;
    if (!photo && it.photoRef) photo = await fetchPhotoNow(it.photoRef);
    if (shared) {
      if (photo) { savePhotoDoc(it.id, photo); it.photoRef = it.id; delete it.fileData; }
    } else {
      if (it.photoRef) { deletePhotoDoc(it.photoRef); delete it.photoRef; }
      it.fileData = photo || null;
    }
    it.shared = shared;
    saveAppData(); closeModal('modal-packing'); selectPackingCategory(category); renderSummaryPage();
  };
  
  if (category === 'documents' && file) {
    uploadImageToFirebase(file, "documents").then(url => {
      if (url) finish(url);
      else scaleImage(file, 1100, finish);
    });
  } else finish(null);
}

function togglePackingDone(idx) {
  const trip = getActiveTrip();
  if (trip.checklists.packing[idx]) {
    trip.checklists.packing[idx].done = !trip.checklists.packing[idx].done;
    saveAppData();
    renderCategorizedPackingList();
    renderSummaryPage();
  }
}

function togglePackingImportant(idx) {
  const trip = getActiveTrip();
  if (trip.checklists.packing[idx]) {
    trip.checklists.packing[idx].important = !trip.checklists.packing[idx].important;
    saveAppData();
    renderCategorizedPackingList();
  }
}

function deletePackingItem(idx) {
  const trip = getActiveTrip();
  const gone = trip.checklists.packing[idx];
  if (gone && gone.photoRef) deletePhotoDoc(gone.photoRef);
  trip.checklists.packing.splice(idx, 1);
  saveAppData();
  renderCategorizedPackingList();
  renderSummaryPage();
}

// EXPENSES LOGIC
function renderChecklistsAndExpenses() {
  renderCategorizedPackingList();
  renderExpenseSplit();

  const trip = getActiveTrip();
  let totalSum = 0;
  const categories = { "Hotel & Stay": 0, "Food & Cafe": 0, "Transport": 0, "Other": 0 };

  (trip.expenses || []).forEach(exp => {
    const amt = expToTrip(trip, exp);
    if (amt === null) return;
    totalSum += amt;
    const cat = exp.category || "Other";
    categories[cat] = (categories[cat] || 0) + amt;
  });

  const totalDisplay = document.getElementById('expense-total-display');
  if (totalDisplay) totalDisplay.innerText = fmtMoney(totalSum, tripCur(trip));

  if (document.getElementById('cat-amount-stay')) document.getElementById('cat-amount-stay').innerText = fmtMoney(categories["Hotel & Stay"], tripCur(trip));
  if (document.getElementById('cat-amount-food')) document.getElementById('cat-amount-food').innerText = fmtMoney(categories["Food & Cafe"], tripCur(trip));
  if (document.getElementById('cat-amount-transport')) document.getElementById('cat-amount-transport').innerText = fmtMoney(categories["Transport"], tripCur(trip));
  if (document.getElementById('cat-amount-other')) document.getElementById('cat-amount-other').innerText = fmtMoney(categories["Other"], tripCur(trip));

  const expListContainer = document.getElementById('expenses-list-container');
  if (expListContainer) {
    expListContainer.innerHTML = "";
    if (trip.expenses.length === 0) {
      expListContainer.innerHTML = `<p class="text-xs text-stone-400 text-center py-4">No expense items logged yet.</p>`;
      return;
    }

    trip.expenses.forEach((exp, idx) => {
      let iconClass = "fa-receipt text-stone-500 bg-stone-100";
      if (exp.category === "Hotel & Stay") iconClass = "fa-hotel text-emerald-800 bg-emerald-100";
      if (exp.category === "Food & Cafe") iconClass = "fa-utensils text-amber-600 bg-amber-100";
      if (exp.category === "Transport") iconClass = "fa-train text-teal-600 bg-teal-100";

      const card = document.createElement('div');
      card.className = "lily-card p-3.5 flex justify-between items-center text-xs bg-white/80";
      card.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center ${iconClass}">
            <i class="fa-solid ${iconClass.split(' ')[0]}"></i>
          </div>
          <div>
            <strong class="font-bold text-stone-800 block text-xs">${exp.title}</strong>
            <span class="text-[10px] text-stone-400">${exp.category || 'Expense'}${exp.paidBy ? ' • paid by ' + escapeHtml(exp.paidBy) : ''}</span>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          ${expAmountHtml(trip, exp)}
          <button onclick="openEditExpenseModal(${idx})" class="text-stone-300 hover:text-stone-600"><i class="fa-solid fa-pen text-[10px]"></i></button>
          <button onclick="deleteExpenseItem(${idx})" class="text-stone-300 hover:text-red-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
        </div>
      `;
      expListContainer.appendChild(card);
    });
  }
}

function expAmountHtml(trip, exp) {
  const tc = tripCur(trip), cur = exp.currency || tc, v = expToTrip(trip, exp);
  const main = `<strong style="color: var(--olive-green);" class="font-extrabold text-xs block text-right">${fmtMoney(exp.amount, cur)}</strong>`;
  if (cur === tc) return `<div>${main}</div>`;
  return `<div>${main}<span class="block text-right text-[10px] ${v === null ? 'font-bold' : 'text-stone-400'}" style="${v === null ? 'color: var(--carnival-red);' : ''}">${v === null ? '⚠ set rate (tap pencil)' : '≈ ' + fmtMoney(v, tc)}</span></div>`;
}

function getMembers(trip) {
  if (trip.members && trip.members.length) return trip.members;
  const n = Math.max(1, parseInt(trip.people) || 1);
  return Array.from({ length: n }, (_, i) => 'Person ' + (i + 1));
}

function computeSettlement(trip) {
  const members = getMembers(trip), bal = {}, tc = tripCur(trip);
  members.forEach(m => { bal[m] = 0; });
  let missing = 0;
  (trip.expenses || []).forEach(e => {
    const amt = expToTrip(trip, e);
    if (amt === null) { missing++; return; }
    if (!e.paidBy || !(e.paidBy in bal)) return;
    const sp = (e.split && e.split.length ? e.split : members).filter(m => m in bal);
    if (!sp.length) return;
    bal[e.paidBy] += amt;
    sp.forEach(m => { bal[m] -= amt / sp.length; });
  });
  (trip.payments || []).forEach(p => {
    if ((p.cur || 'MYR') !== tc) return;
    if (p.from in bal) bal[p.from] += p.amt;
    if (p.to in bal) bal[p.to] -= p.amt;
  });
  const debt = members.filter(m => bal[m] < -0.005).map(m => [m, -bal[m]]).sort((a, b) => b[1] - a[1]);
  const cred = members.filter(m => bal[m] > 0.005).map(m => [m, bal[m]]).sort((a, b) => b[1] - a[1]);
  const tx = []; let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i][1], cred[j][1]);
    tx.push({ from: debt[i][0], to: cred[j][0], amt });
    debt[i][1] -= amt; cred[j][1] -= amt;
    if (debt[i][1] < 0.005) i++;
    if (cred[j][1] < 0.005) j++;
  }
  return { bal, tx, missing };
}

function renderExpenseSplit() {
  const box = document.getElementById('expense-split-container');
  if (!box) return;
  const trip = getActiveTrip(), members = getMembers(trip), tc = tripCur(trip), { bal, tx, missing } = computeSettlement(trip);
  window._tx = tx;
  const rows = members.map(m => {
    const v = bal[m];
    const t = Math.abs(v) < 0.005 ? '<span class="text-stone-400">settled</span>'
      : v > 0 ? `<span class="font-bold" style="color: var(--muted-teal);">gets back ${fmtMoney(v, tc)}</span>`
      : `<span class="font-bold" style="color: var(--carnival-red);">owes ${fmtMoney(-v, tc)}</span>`;
    return `<div class="flex justify-between text-xs py-1.5 border-t border-stone-100 first:border-0"><span class="font-semibold text-stone-700">${escapeHtml(m)}</span>${t}</div>`;
  }).join('');
  const pays = tx.length ? tx.map((t, i) => `<div class="flex items-center gap-2 rounded-xl p-2.5 text-xs" style="background: var(--beige);">
      <span class="font-bold">${escapeHtml(t.from)}</span><i class="fa-solid fa-arrow-right text-stone-400 text-[10px]"></i><span class="font-bold">${escapeHtml(t.to)}</span>
      <span class="ms-auto font-extrabold" style="color: var(--midnight-blue);">${fmtMoney(t.amt, tc)}</span>
      <button onclick="openPaymentModal(${i})" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex-shrink-0" style="background: var(--muted-teal);">Mark paid</button></div>`).join('')
    : `<p class="text-xs text-stone-400">${(trip.expenses || []).length ? 'All settled 🎉' : 'Nothing to settle yet. Choose who paid when you add an expense.'}</p>`;
  const paid = (trip.payments || []).map((p, i) => `<div class="flex items-center gap-2 text-[11px] text-stone-600 py-1">
      <i class="fa-solid fa-circle-check flex-shrink-0" style="color: var(--muted-teal);"></i>
      <span class="min-w-0"><b>${escapeHtml(p.from)}</b> paid <b>${escapeHtml(p.to)}</b> ${fmtMoney(p.amt, p.cur || 'MYR')}</span>
      <span class="text-stone-400 ms-auto flex-shrink-0">${p.at || ''}</span>
      <button onclick="deletePayment(${i})" aria-label="Undo payment" class="text-stone-300 hover:text-red-500 px-1 flex-shrink-0"><i class="fa-solid fa-rotate-left text-[10px]"></i></button></div>`).join('');
  box.innerHTML = `<div class="lily-card p-4 space-y-3 bg-white">
    <div class="flex justify-between items-center gap-2"><h4 class="font-extrabold text-sm" style="color: var(--midnight-blue);">Split &amp; settle up</h4>
      <button onclick="editTravelers()" class="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-stone-100 text-stone-600 flex-shrink-0"><i class="fa-solid fa-user-pen me-1"></i>${members.length} travellers</button></div>
    <p class="text-[11px] text-stone-500">Shown in <b>${CURRENCIES[tc] || tc} (${tc})</b> • <button onclick="openTripModal(activeTripId)" class="underline font-semibold">change currency</button></p>
    ${missing ? `<p class="text-[11px] font-bold rounded-xl p-2.5" style="background: #fdecec; color: var(--carnival-red);">⚠ ${missing} expense${missing > 1 ? 's need' : ' needs'} an exchange rate to ${tc}. Tap its pencil and save to fix.</p>` : ''}
    <div>${rows}</div>
    <p class="text-[10px] font-bold uppercase tracking-wider text-stone-400">Suggested payments</p>
    <div class="space-y-1.5">${pays}</div>
    ${paid ? `<p class="text-[10px] font-bold uppercase tracking-wider text-stone-400 pt-1">Payments made</p><div>${paid}</div>` : ''}
  </div>`;
}

function openPaymentModal(i) {
  const t = (window._tx || [])[i];
  if (!t) return;
  _payIdx = i;
  const tc = tripCur(getActiveTrip());
  document.getElementById('pay-text').innerHTML = `<b>${escapeHtml(t.from)}</b> paid <b>${escapeHtml(t.to)}</b>`;
  document.getElementById('pay-cur').textContent = CURRENCIES[tc] || tc;
  document.getElementById('pay-amount').value = (Math.round(t.amt * 100) / 100).toString();
  openModal('modal-payment');
}

function savePayment() {
  const t = (window._tx || [])[_payIdx], amt = parseFloat(document.getElementById('pay-amount').value);
  if (!t) return;
  if (!(amt > 0)) return alert("Enter the amount that was paid.");
  const trip = getActiveTrip();
  if (!trip.payments) trip.payments = [];
  trip.payments.push({ id: 'pay_' + Date.now(), from: t.from, to: t.to, amt: Math.round(amt * 100) / 100, cur: tripCur(trip), at: todayIso() });
  saveAppData(); closeModal('modal-payment'); renderChecklistsAndExpenses();
}

function deletePayment(i) {
  const trip = getActiveTrip();
  if (!trip.payments || !trip.payments[i] || !confirm("Undo this payment record?")) return;
  trip.payments.splice(i, 1);
  saveAppData(); renderChecklistsAndExpenses();
}

let _travelerRows = [];
function editTravelers() {
  _travelerRows = getMembers(getActiveTrip()).map(n => ({ orig: n, name: n }));
  renderTravelerRows();
  openModal('modal-travelers');
}

function renderTravelerRows() {
  const box = document.getElementById('travelers-list');
  if (!box) return;
  box.innerHTML = '';
  _travelerRows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `<span class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style="background: var(--muted-teal);">${i + 1}</span>
      <input type="text" value="${escapeHtml(r.name)}" placeholder="Name" maxlength="24" style="font-size:16px" class="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5 text-stone-800">
      <button type="button" aria-label="Remove traveller" class="p-2 text-stone-300 hover:text-red-500 flex-shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>`;
    row.querySelector('input').oninput = e => { r.name = e.target.value; };
    row.querySelector('button').onclick = () => { if (_travelerRows.length > 1) { _travelerRows.splice(i, 1); renderTravelerRows(); } };
    box.appendChild(row);
  });
}

function addTravelerRow() {
  _travelerRows.push({ orig: null, name: '' });
  renderTravelerRows();
  const inputs = document.querySelectorAll('#travelers-list input');
  inputs[inputs.length - 1]?.focus();
}

function saveTravelers() {
  const trip = getActiveTrip();
  const rows = _travelerRows.map(r => ({ orig: r.orig, name: r.name.trim() })).filter(r => r.name);
  if (!rows.length) return alert("Add at least one traveller.");
  const names = rows.map(r => r.name);
  if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return alert("Each traveller needs a different name.");
  const map = {};
  rows.forEach(r => { if (r.orig) map[r.orig] = r.name; });
  (trip.expenses || []).forEach(e => {
    if (e.paidBy) e.paidBy = map[e.paidBy] || null;
    if (e.split) e.split = e.split.map(s => map[s]).filter(Boolean);
  });
  trip.members = names;
  trip.people = names.length + ' Pax';
  saveAppData();
  closeModal('modal-travelers');
  renderChecklistsAndExpenses(); renderSummaryPage(); renderHomeViews();
}

function fillExpenseWho(paidBy, split) {
  const members = getMembers(getActiveTrip());
  const sel = document.getElementById('exp-form-paidby');
  sel.innerHTML = '<option value="">Not assigned</option>' + members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  sel.value = members.includes(paidBy) ? paidBy : '';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  expSplitSel = new Set((split && split.length ? split : members).filter(m => members.includes(m)));
  renderExpenseSplitChips(members);
}

function renderExpenseSplitChips(members) {
  const box = document.getElementById('exp-form-split');
  box.innerHTML = '';
  members.forEach(m => {
    const on = expSplitSel.has(m), b = document.createElement('button');
    b.type = 'button';
    b.className = `px-3 py-1.5 rounded-full text-[11px] font-bold border ${on ? 'text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'}`;
    if (on) b.style.backgroundColor = 'var(--muted-teal)';
    b.textContent = m;
    b.onclick = () => { if (on) expSplitSel.delete(m); else expSplitSel.add(m); renderExpenseSplitChips(members); };
    box.appendChild(b);
  });
}

function expFormSetup(exp) {
  const trip = getActiveTrip(), tc = tripCur(trip);
  const sel = document.getElementById('exp-form-currency');
  sel.innerHTML = Object.keys(CURRENCIES).map(c => `<option value="${c}">${c} (${CURRENCIES[c]})</option>`).join('');
  _expSetup = true;
  sel.value = (exp && exp.currency) || tc;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  _expSetup = false;
  const keep = exp && exp.currency && exp.currency !== tc && exp.rateCur === tc && exp.rate > 0;
  document.getElementById('exp-form-rate').value = keep ? exp.rate : '';
  updateRateUI(true);
}

function updateRateUI(autofetch) {
  const tc = tripCur(getActiveTrip()), cur = document.getElementById('exp-form-currency').value;
  const diff = cur !== tc;
  document.getElementById('exp-rate-box').classList.toggle('hidden', !diff);
  if (!diff) return;
  document.getElementById('exp-rate-from').textContent = cur;
  document.getElementById('exp-rate-to').textContent = tc;
  if (autofetch && !document.getElementById('exp-form-rate').value) fetchRate(cur, tc);
  updateRatePreview();
}

async function fetchRate(from, to) {
  const note = document.getElementById('exp-rate-note');
  note.textContent = 'Getting today’s rate…';
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const j = await r.json(), v = j.rates && j.rates[to];
    if (!v) throw new Error('no rate');
    const inp = document.getElementById('exp-form-rate');
    if (document.getElementById('exp-form-currency').value === from && !inp.value) inp.value = String(+v.toPrecision(6));
    note.textContent = 'Today’s rate filled in. Change it if you used a different one (e.g. a money changer).';
  } catch (e) { note.textContent = 'Couldn’t get a rate (offline?). Type the rate you used.'; }
  updateRatePreview();
}

function updateRatePreview() {
  const trip = getActiveTrip(), tc = tripCur(trip);
  const amt = parseFloat(document.getElementById('exp-form-amount').value), rate = parseFloat(document.getElementById('exp-form-rate').value);
  document.getElementById('exp-rate-preview').textContent = (amt > 0 && rate > 0) ? '≈ ' + fmtMoney(amt * rate, tc) : '';
}

function onExpCurrencyChange() {
  if (_expSetup) return;
  document.getElementById('exp-form-rate').value = '';
  updateRateUI(true);
}

function openExpenseModal() {
  editingExpenseIndex = null;
  document.getElementById('exp-form-idx').value = "-1";
  document.getElementById('exp-form-title').value = "";
  document.getElementById('exp-form-amount').value = "";
  document.getElementById('exp-form-category').value = "Hotel & Stay";
  fillExpenseWho('', null);
  expFormSetup(null);
  document.getElementById('modal-expense-title').innerText = "Add Expense";
  openModal('modal-expense');
}

function openEditExpenseModal(idx) {
  const exp = getActiveTrip().expenses[idx];
  if (!exp) return;
  editingExpenseIndex = idx;
  document.getElementById('exp-form-idx').value = idx;
  document.getElementById('exp-form-title').value = exp.title || "";
  document.getElementById('exp-form-amount').value = exp.amount || "";
  document.getElementById('exp-form-category').value = exp.category || "Hotel & Stay";
  fillExpenseWho(exp.paidBy || '', exp.split);
  expFormSetup(exp);
  document.getElementById('modal-expense-title').innerText = "Edit Expense";
  openModal('modal-expense');
}

function saveExpenseForm() {
  const title = document.getElementById('exp-form-title').value.trim();
  const amount = document.getElementById('exp-form-amount').value.trim();
  const category = document.getElementById('exp-form-category').value;
  const paidBy = document.getElementById('exp-form-paidby').value || null;
  const currency = document.getElementById('exp-form-currency').value;
  if (!title || !amount) return alert("Enter title and amount!");
  const trip = getActiveTrip(), tc = tripCur(trip);
  let rate = 1;
  if (currency !== tc) {
    rate = parseFloat(document.getElementById('exp-form-rate').value);
    if (!(rate > 0)) return alert(`Enter the exchange rate (1 ${currency} = how many ${tc}?).`);
  }
  const split = getMembers(trip).filter(m => expSplitSel.has(m));
  if (paidBy && !split.length) return alert("Pick at least one person to split between.");
  if (!trip.expenses) trip.expenses = [];
  const exp = { title, amount, category, paidBy, split, currency, rate, rateCur: tc };
  if (editingExpenseIndex !== null && trip.expenses[editingExpenseIndex]) trip.expenses[editingExpenseIndex] = exp;
  else trip.expenses.push(exp);
  saveAppData();
  closeModal('modal-expense');
  renderChecklistsAndExpenses();
}

function deleteExpenseItem(idx) {
  const trip = getActiveTrip();
  if (confirm("Delete expense item?")) {
    trip.expenses.splice(idx, 1);
    saveAppData();
    renderChecklistsAndExpenses();
  }
}

function switchChecklistSubTab(tab) {
  ['packing', 'expenses'].forEach(t => {
    document.getElementById(`checklist-sub-${t}`)?.classList.add('hidden');
    const btn = document.getElementById(`checktab-${t}`);
    if (btn) {
      btn.classList.remove('text-stone-800', 'bg-white', 'shadow-xs', 'font-bold');
      btn.classList.add('text-stone-500', 'font-semibold');
    }
  });

  document.getElementById(`checklist-sub-${tab}`)?.classList.remove('hidden');
  const activeBtn = document.getElementById(`checktab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('text-stone-800', 'bg-white', 'shadow-xs', 'font-bold');
    activeBtn.classList.remove('text-stone-500', 'font-semibold');
  }
}

// HOTEL SELECTION LOGIC
function populateHotelCityDropdown(selectedCity = "bandung") {
  const citySelect = document.getElementById('hotel-city-dropdown');
  if (!citySelect) return;
  citySelect.innerHTML = "";
  initHotelDatabase();

  Object.keys(hotelDatabase).forEach(cityKey => {
    const opt = document.createElement('option');
    opt.value = cityKey;
    opt.text = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
    if (cityKey === selectedCity) opt.selected = true;
    citySelect.appendChild(opt);
  });
  populateHotelNameDropdown();
}

function populateHotelNameDropdown(selectedHotelName = "") {
  const citySelect = document.getElementById('hotel-city-dropdown');
  const hotelSelect = document.getElementById('hotel-name-dropdown');
  if (!citySelect || !hotelSelect) return;

  const selectedCity = citySelect.value.toLowerCase();
  hotelSelect.innerHTML = "";

  initHotelDatabase();
  const hotels = hotelDatabase[selectedCity] || [];
  hotels.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.name;
    opt.text = h.name;
    if (h.name === selectedHotelName) opt.selected = true;
    hotelSelect.appendChild(opt);
  });
  onHotelSelectionChange();
}

function onHotelSelectionChange() {
  const citySelect = document.getElementById('hotel-city-dropdown');
  const hotelSelect = document.getElementById('hotel-name-dropdown');
  const previewLabel = document.getElementById('hotel-form-preview-station');
  if (!citySelect || !hotelSelect || !previewLabel) return;

  const city = citySelect.value;
  const hotelName = hotelSelect.value;
  const hotels = hotelDatabase[city] || [];
  const found = hotels.find(h => h.name === hotelName);

  if (found) {
    previewLabel.innerText = stationLabel(found.lat, found.lng, city);
  }
}

function openHotelModal() {
  const trip = getActiveTrip();
  let initialCity = getActiveHotelCity(trip);
  populateHotelCityDropdown(initialCity);
  populateHotelNameDropdown(trip.activeHotel || "");
  openModal('modal-hotel');
}

function saveHotelForm() {
  const citySelect = document.getElementById('hotel-city-dropdown');
  const hotelSelect = document.getElementById('hotel-name-dropdown');
  const previewLabel = document.getElementById('hotel-form-preview-station');
  if (!hotelSelect) return;

  const trip = getActiveTrip();
  trip.activeHotel = hotelSelect.value;
  trip.hotelCity = citySelect ? citySelect.value : "bandung";
  trip.hotelStation = previewLabel ? previewLabel.innerText : "No station nearby";

  saveAppData();
  closeModal('modal-hotel');
  renderActiveTripDashboard();
}

// TRIPS MANAGEMENT MODALS
let _deleteTripId = null;
function confirmDeleteTrip(id) {
  const t = appData.trips.find(x => x.id === (id || document.getElementById('trip-form-id').value));
  if (!t) return;
  _deleteTripId = t.id;
  document.getElementById('delete-trip-name').textContent = t.name;
  closeModal('modal-trip');
  openModal('modal-delete-trip');
}

function deleteTripNow() {
  const id = _deleteTripId;
  if (!id) return;
  const doomed = appData.trips.find(t => t.id === id);
  ((doomed && doomed.checklists && doomed.checklists.packing) || []).forEach(i => { if (i.photoRef) deletePhotoDoc(i.photoRef); });
  appData.trips = appData.trips.filter(t => t.id !== id);
  try { localStorage.removeItem(checklistStorageKey(id)); } catch (e) {}
  if (activeTripId === id) activeTripId = appData.trips.length ? appData.trips[0].id : null;
  _deleteTripId = null;
  saveAppData();
  closeModal('modal-delete-trip');
  renderHomeViews();
  if (document.getElementById('section-home').classList.contains('hidden')) openHomePage('upcoming');
}

function setTripCurrencyField(code) {
  const s = document.getElementById('trip-form-currency');
  s.innerHTML = Object.keys(CURRENCIES).map(c => `<option value="${c}">${c} (${CURRENCIES[c]})</option>`).join('');
  s.value = code;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}

function openTripModal(tripIdToEdit = null) {
  const targetId = tripIdToEdit || activeTripId;
  const trip = appData.trips.find(t => t.id === targetId);

  if (tripIdToEdit && trip) {
    document.getElementById('modal-trip-title').innerText = "Edit Trip";
    document.getElementById('trip-form-id').value = trip.id;
    document.getElementById('trip-form-title').value = trip.name || '';
    document.getElementById('trip-form-start-date').value = trip.startDate || '';
    document.getElementById('trip-form-end-date').value = trip.endDate || '';
    document.getElementById('trip-form-category').value = trip.category || 'Vacation';
    document.getElementById('trip-form-people').value = trip.people || '';
    document.getElementById('trip-form-budget').value = trip.budget || '';
    setTripCurrencyField(tripCur(trip));
  } else {
    document.getElementById('modal-trip-title').innerText = "Add New Trip";
    document.getElementById('trip-form-id').value = '';
    document.getElementById('trip-form-title').value = '';
    document.getElementById('trip-form-start-date').value = '';
    document.getElementById('trip-form-end-date').value = '';
    document.getElementById('trip-form-people').value = '';
    document.getElementById('trip-form-budget').value = '';
    setTripCurrencyField('MYR');
  }
  document.getElementById('trip-form-cover').value = '';
  document.getElementById('trip-delete-btn')?.classList.toggle('hidden', !(tripIdToEdit && trip));
  openModal('modal-trip');
}

function saveTripForm() {
  const f = document.getElementById('trip-form-cover')?.files?.[0];
  if (f) {
    uploadImageToFirebase(f, "covers").then(url => {
      pendingCover = url;
      if (!pendingCover) scaleImage(f, 900, d => { pendingCover = d; saveTripFormCore(); });
      else saveTripFormCore();
    });
  } else { pendingCover = null; saveTripFormCore(); }
}

function saveTripFormCore() {
  const id = document.getElementById('trip-form-id').value;
  const title = document.getElementById('trip-form-title').value.trim();
  if (!title) return alert("Enter Trip Name!");

  if (id) {
    const trip = appData.trips.find(t => t.id === id);
    if (trip) {
      trip.name = title;
      trip.startDate = document.getElementById('trip-form-start-date').value;
      trip.endDate = document.getElementById('trip-form-end-date').value;
      trip.category = document.getElementById('trip-form-category').value;
      trip.people = document.getElementById('trip-form-people').value;
      trip.budget = document.getElementById('trip-form-budget').value;
      const oldCur = tripCur(trip);
      (trip.expenses || []).forEach(e => { if (!e.currency) { e.currency = oldCur; e.rate = 1; e.rateCur = oldCur; } });
      trip.currency = document.getElementById('trip-form-currency').value || 'MYR';
      if (pendingCover) trip.coverImage = pendingCover;
    }
  } else {
    const newTripId = "trip_" + Date.now();
    appData.trips.push({
      id: newTripId,
      name: title,
      startDate: document.getElementById('trip-form-start-date').value || "2026-11-21",
      endDate: document.getElementById('trip-form-end-date').value || "2026-11-26",
      category: document.getElementById('trip-form-category').value || "Vacation",
      people: document.getElementById('trip-form-people').value || "1 Pax",
      budget: document.getElementById('trip-form-budget').value || "RM 0",
      currency: document.getElementById('trip-form-currency').value || 'MYR',
      activeHotel: "The Papandayan Hotel",
      hotelCity: "bandung",
      hotelStation: "Bandung Station (23 min walk)",
      places: typeof getAllMasterLocations === 'function' ? getAllMasterLocations() : [],
      itinerary: [],
      checklists: { packing: [] },
      expenses: [],
      coverImage: pendingCover
    });
    activeTripId = newTripId;
  }

  saveAppData();
  closeModal('modal-trip');
  renderHomeViews();
  openTripDashboard(activeTripId);
}

function fillSpotForm(p) {
  const set = (k, v) => { document.getElementById('spot-form-' + k).value = v; };
  set('id', p.id || ''); set('name', p.name || ''); set('city', p.city || 'Bandung'); set('category', p.category || 'Attraction');
  set('station', p.station || ''); set('walk', p.walk || ''); set('lat', p.lat || ''); set('lng', p.lng || '');
}
function openMasterSpotModal() {
  editingPlaceId = null; fillSpotForm({});
  document.getElementById('modal-spot-title').innerText = "Add Location Spot";
  openModal('modal-master-spot');
}
function openEditSpotModal(placeId) {
  const place = (getActiveTrip().places || []).find(p => p.id === placeId);
  if (!place) return;
  editingPlaceId = placeId; fillSpotForm(place);
  document.getElementById('modal-spot-title').innerText = "Edit Location Spot";
  openModal('modal-master-spot');
}

function getSpotCoords() {
  let a = document.getElementById('spot-form-lat').value.trim(), b = document.getElementById('spot-form-lng').value.trim();
  if (a.includes(',') && !b) [a, b] = a.split(',').map(s => s.trim());
  const lat = parseFloat(a), lng = parseFloat(b);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}

async function findSpotCoords() {
  const name = document.getElementById('spot-form-name').value.trim(), city = document.getElementById('spot-form-city').value;
  if (!name) return alert("Enter the spot name first.");
  const tip = "Paste the coordinates from Google Maps instead (long-press the spot, tap the numbers).";
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name + ', ' + city + ', Indonesia')}`);
    const j = await r.json();
    if (!j[0]) return alert("Couldn't find that place. " + tip);
    document.getElementById('spot-form-lat').value = (+j[0].lat).toFixed(6);
    document.getElementById('spot-form-lng').value = (+j[0].lon).toFixed(6);
  } catch (e) { alert("Couldn't reach the map service. " + tip); }
}

function copySpotLine() {
  const f = k => document.getElementById('spot-form-' + k).value.trim(), c = getSpotCoords();
  const name = f('name');
  if (!name) return alert("Enter the spot name first.");
  const line = `{ id: "${editingPlaceId || 'new_' + Date.now()}", name: "${name}", category: "${f('category')}", lat: ${c ? c.lat : 'null'}, lng: ${c ? c.lng : 'null'}, station: "${f('station') || 'No station nearby'}", walk: "${f('walk')}", map: "https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name).replace(/%20/g, '+')}", starred: false },`;
  if (navigator.clipboard) navigator.clipboard.writeText(line).then(() => alert("Copied! Paste it into the right city and category in location.js.")).catch(() => prompt("Copy this line:", line));
  else prompt("Copy this line:", line);
}

function saveMasterSpotForm() {
  const f = k => document.getElementById('spot-form-' + k).value.trim();
  const name = f('name'), city = f('city'), c = getSpotCoords();
  if (!name) return alert("Enter spot name!");
  const trip = getActiveTrip();
  const station = f('station') || (c ? ((stationsNear(c.lat, c.lng, city.toLowerCase())[0] || {}).name || 'No station nearby') : 'Near Hotel Area');
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  if (editingPlaceId) {
    const p = trip.places.find(x => x.id === editingPlaceId);
    if (p) Object.assign(p, { name, city, category: f('category'), station, walk: f('walk'), map, ...(c || {}) });
  } else {
    trip.places.push({ id: "p_" + Date.now(), name, city, category: f('category'), station, walk: f('walk'), map, starred: false, gallery: [], lat: c ? c.lat : null, lng: c ? c.lng : null });
  }
  saveAppData(); closeModal('modal-master-spot');
  renderLocationsPage(); renderWaddleView(); renderSummaryPage();
}

function renderActiveTripDashboard() {
  if (!getActiveTrip()) return;
  setTimeout(() => { const t = getActiveTrip(); if (t) loadWeather(t); }, 0);
  renderSummaryPage();
  renderLocationsPage();
  renderWaddleView();
  renderItinerary();
  renderChecklistsAndExpenses();
}

function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// Custom Rounded Dropdowns initialization
(function initRoundedDropdowns() {
  const SELECTOR = 'select:not([data-custom-dropdown-ready])';

  function setup(select) {
    if (!select || select.dataset.customDropdownReady === 'true') return;
    select.dataset.customDropdownReady = 'true';
    const wrap = document.createElement('div');
    wrap.className = 'custom-select-wrap';
    if (select.id === 'masterCategoryFilter') wrap.classList.add('custom-select-master-filter');
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('custom-select-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.className = 'custom-select-current';
    const chevron = document.createElement('span');
    chevron.className = 'custom-select-chevron';
    chevron.innerHTML = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    trigger.append(label, chevron);
    wrap.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu hidden';
    menu.setAttribute('role', 'listbox');
    wrap.appendChild(menu);

    function syncLabel() {
      const option = select.options[select.selectedIndex];
      label.textContent = option ? option.textContent.trim() : 'Choose an option';
      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-label', label.textContent);
      wrap.classList.toggle('is-disabled', select.disabled);
    }
    function close() {
      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
      wrap.classList.remove('is-open');
    }
    function renderOptions() {
      menu.innerHTML = '';
      Array.from(select.options).forEach((option, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-select-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(index === select.selectedIndex));
        item.disabled = option.disabled || (option.parentElement && option.parentElement.disabled);
        item.textContent = option.textContent.trim();
        if (index === select.selectedIndex) item.classList.add('is-selected');
        item.addEventListener('click', () => {
          if (item.disabled) return;
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncLabel();
          close();
          trigger.focus();
        });
        menu.appendChild(item);
      });
      if (!select.options.length) {
        const empty = document.createElement('div');
        empty.className = 'custom-select-empty';
        empty.textContent = 'No options available';
        menu.appendChild(empty);
      }
    }
    trigger.addEventListener('click', () => {
      if (select.disabled) return;
      const opening = menu.classList.contains('hidden');
      document.querySelectorAll('.custom-select-menu:not(.hidden)').forEach(other => {
        other.classList.add('hidden');
        const otherWrap = other.closest('.custom-select-wrap');
        otherWrap?.classList.remove('is-open');
        otherWrap?.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (opening) {
        renderOptions();
        menu.classList.remove('hidden');
        trigger.setAttribute('aria-expanded', 'true');
        wrap.classList.add('is-open');
        const selected = menu.querySelector('.is-selected');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
      } else close();
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowDown' && menu.classList.contains('hidden')) {
        event.preventDefault(); trigger.click();
      }
    });
    select.addEventListener('change', syncLabel);
    syncLabel();
  }

  function init() {
    document.querySelectorAll(SELECTOR).forEach(setup);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  new MutationObserver(() => init()).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target.closest('.custom-select-wrap')) return;
    document.querySelectorAll('.custom-select-menu:not(.hidden)').forEach(menu => {
      menu.classList.add('hidden');
      const wrap = menu.closest('.custom-select-wrap');
      wrap?.classList.remove('is-open');
      wrap?.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
    });
  });
})();
