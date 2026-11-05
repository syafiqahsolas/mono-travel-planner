/**
 * Waddl TRAVEL HUB - APP.JS
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
let storage = null;
try { storage = firebase.storage(); } catch (e) { console.warn('Firebase Storage is not available', e); }

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
const SPOT_EMOJI = { Attraction: '🏛️', Coffee: '☕', Food: '🍜', 'Shopping Mall': '🛍️', Airport: '✈️', Transit: '🚆' };
const WALK_M_PER_MIN = 80;
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E888A"/><stop offset="1" stop-color="#113665"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/></svg>');

// Firebase Storage Upload Helper Function
async function uploadImageToFirebase(file, folder = "user_uploads") {
  if (!storage) return null;
  try {
    let body = file, type = file.type || 'image/jpeg';
    try { const b = await scaleToBlob(file, 1600, 0.82); if (b) { body = b; type = 'image/jpeg'; } } catch (e) {}
    const ref = storage.ref().child(`${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
    const snap = await ref.put(body, { contentType: type, contentDisposition: 'attachment; filename="lily-pond-photo.jpg"' });   // so a tap on the link saves the photo
    return await snap.ref.getDownloadURL();
  } catch (err) {
    console.error("Firebase Storage Upload Error:", err);
    return null;
  }
}
// Phone photos are 3-8 MB: shrink before uploading (about 300 KB each)
function scaleToBlob(file, maxDim, q) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onerror = () => resolve(null);
    r.onload = e => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const k = Math.min(1, maxDim / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => resolve(b), 'image/jpeg', q);
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
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
// One tap saves a photo: data photos directly; cloud photos via a blob (if CORS is set) or as a forced download
async function downloadPhoto(src, name) {
  if (String(src || '').startsWith('photo:')) src = await fetchPhotoNow(String(src).slice(6));
  if (!src) return;
  name = name || ('lily-pond-' + new Date().toISOString().slice(0, 10) + '.jpg');
  const click = (href, useName) => { const a = document.createElement('a'); a.href = href; if (useName) a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
  if (String(src).startsWith('data:')) return click(src, true);
  try {
    const r = await fetch(src); if (!r.ok) throw new Error('HTTP ' + r.status);
    const u = URL.createObjectURL(await r.blob()); click(u, true); setTimeout(() => URL.revokeObjectURL(u), 3000); return;
  } catch (e) {}
  try { if (storage && String(src).includes('firebasestorage')) await storage.refFromURL(src).updateMetadata({ contentDisposition: `attachment; filename="${name}"` }); } catch (e) {}
  click(src + (src.includes('?') ? '&' : '?') + 'dl=' + Date.now(), false);
}
function downloadViewerImage(e) {
  const dl = document.getElementById('image-viewer-dl');
  e.preventDefault(); e.stopPropagation();
  downloadPhoto((dl && dl.dataset.src) || '');
  return false;
}
function downloadGalleryPhoto(id, i) { const p = (getActiveTrip().places || []).find(x => x.id === id); if (p && p.gallery && p.gallery[i]) downloadPhoto(p.gallery[i], `lily-pond-${slugOf(p.name)}-${i + 1}.jpg`); }
async function downloadAllGallery(id) {
  const p = (getActiveTrip().places || []).find(x => x.id === id);
  if (!p || !p.gallery) return;
  for (let i = 0; i < p.gallery.length; i++) { await downloadPhoto(p.gallery[i], `lily-pond-${slugOf(p.name)}-${i + 1}.jpg`); await new Promise(r => setTimeout(r, 600)); }
}
function openImageViewer(src) {
  document.getElementById('image-viewer-img').src = src;
  const dl = document.getElementById('image-viewer-dl');
  if (dl) { dl.dataset.src = src; dl.href = src; dl.setAttribute('download', 'lily-pond-' + new Date().toISOString().slice(0, 10) + '.jpg'); }
  openModal('modal-image');
}

// Open-Meteo Weather Integration
const WX = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌧️', 57: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️', 80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️', 95: '⛈️', 96: '⛈️', 99: '⛈️' };
const wxIcon = c => WX[c] || '🌡️';
let _wx = {};
function todayIso(tz) { return nowIn(tz || DEVICE_TZ).date; }
function tripDayIso(trip, n) { return new Date(new Date(trip.startDate).getTime() + (n - 1) * 864e5).toISOString().slice(0, 10); }
function tripTodayIndex(trip) {
  if (!trip || !trip.startDate) return 0;
  const n = Math.round((new Date(todayIso(tzOf(trip))) - new Date(trip.startDate)) / 864e5) + 1;
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
    const saved = localStorage.getItem(CACHE_KEY);
    if (!saved) { hadCache = false; try { if (!localStorage.getItem(HASH_KEY)) baselineHashes(); } catch (e) {} return; }
    hadCache = true;
    appData = JSON.parse(saved); appData.deletedTrips = appData.deletedTrips || {}; hydrateDeviceChecklists();
    const lt = localStorage.getItem(ACTIVE_KEY); if (lt && appData.trips.some(t => t.id === lt)) activeTripId = lt;
    renderNowCard(); renderHomeViews(); setTimeout(renderActiveTripDashboard, 0);
  } catch (e) { console.warn('No saved copy yet', e); }
}

// INITIALIZATION
// ================= TIME ZONES =================
const DEVICE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur'; } catch (e) { return 'Asia/Kuala_Lumpur'; } })();
const TIMEZONES = [['Asia/Jakarta', 'Jakarta / Bandung (WIB, UTC+7)'], ['Asia/Makassar', 'Bali / Makassar (WITA, UTC+8)'], ['Asia/Kuala_Lumpur', 'Malaysia (UTC+8)'], ['Asia/Singapore', 'Singapore (UTC+8)'], ['Asia/Bangkok', 'Thailand / Vietnam (UTC+7)'], ['Asia/Tokyo', 'Japan (UTC+9)'], ['Asia/Seoul', 'South Korea (UTC+9)'], ['Asia/Hong_Kong', 'Hong Kong (UTC+8)'], ['Australia/Sydney', 'Sydney'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris / Central Europe'], ['America/New_York', 'New York'], ['America/Los_Angeles', 'Los Angeles']];
const ID_TZ = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak'];
const tzOf = trip => (trip && trip.tz) || 'Asia/Jakarta';
function nowIn(tz, d = new Date()) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour) * 60 + (+p.minute), label: `${p.hour}:${p.minute}` };
}
function tzOffsetMin(tz, d = new Date()) {
  const n = nowIn(tz, d), [y, m, dd] = n.date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, dd, Math.floor(n.min / 60), n.min % 60) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}
function tzDiffLabel(tz) {
  const diff = (tzOffsetMin(tz) - tzOffsetMin(DEVICE_TZ)) / 60;
  if (!diff) return 'same time as your phone';
  const a = Math.abs(diff);
  return `${a} hour${a === 1 ? '' : 's'} ${diff < 0 ? 'behind' : 'ahead of'} your phone`;
}
function tzShort(tz) { try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName').value; } catch (e) { return ''; } }
function setTripTzField(code) {
  const s = document.getElementById('trip-form-tz');
  s.innerHTML = TIMEZONES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  s.value = code; s.dispatchEvent(new Event('change', { bubbles: true }));
}

// ================= SUN (works offline) =================
function sunTimes(lat, lng, dateISO, tz) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const [Y, Mo, D] = dateISO.split('-').map(Number);
  const N = Math.floor((Date.UTC(Y, Mo - 1, D) - Date.UTC(Y, 0, 0)) / 864e5);
  const lngH = lng / 15, off = tzOffsetMin(tz, new Date(Date.UTC(Y, Mo - 1, D, 12))) / 60;
  const calc = rising => {
    const t = N + ((rising ? 6 : 18) - lngH) / 24, M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634; L = ((L % 360) + 360) % 360;
    let RA = deg * Math.atan(0.91764 * Math.tan(L * rad)); RA = ((RA % 360) + 360) % 360;
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90; RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad), cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;
    const H = (rising ? 360 - deg * Math.acos(cosH) : deg * Math.acos(cosH)) / 15;
    const T = H + RA - 0.06571 * t - 6.622;
    return ((((T - lngH + off) % 24) + 24) % 24) * 60;
  };
  const rise = calc(true), set = calc(false);
  return rise === null || set === null ? null : { rise, set };
}
const fmtMin = m => { m = Math.round(m); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const timeToMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
function tripCenter(trip) {
  const h = getHotelObj(trip); if (h) return { lat: h.lat, lng: h.lng };
  const p = (trip.places || []).find(x => x.lat && x.lng); return p ? { lat: p.lat, lng: p.lng } : null;
}

// ================= TRAVEL TIME + PACE =================
function travelMins(km) { return km <= 1.2 ? Math.max(1, Math.round(km * 1000 / WALK_M_PER_MIN)) : Math.round(km / 22 * 60) + 5; }
const PACE = { none: { l: 'Free day', c: '#CFCDBD', t: '#39431f' }, relaxed: { l: 'Relaxed', c: '#C4BA65', t: '#39431f' }, balanced: { l: 'Balanced', c: '#8A8C41', t: '#fff' }, packed: { l: 'Packed', c: '#E9767F', t: '#fff' } };
function dayStats(trip, d) {
  const acts = (trip.itinerary || []).filter(a => a.day === d).sort((x, y) => (x.time || '99').localeCompare(y.time || '99'));
  let km = 0, prev = null;
  acts.forEach(a => { const c = resolveCoord(trip, a); if (c) { if (prev) km += calculateDistanceInKm(prev.lat, prev.lng, c.lat, c.lng); prev = c; } });
  const score = acts.length + km * 0.5;
  return { n: acts.length, km, pace: !acts.length ? 'none' : score < 3.5 ? 'relaxed' : score < 7 ? 'balanced' : 'packed' };
}

// ================= WHERE AM I (last known, instant) =================
function myLoc() {
  if (userLoc.live) return userLoc;
  try { const s = JSON.parse(localStorage.getItem('lily_last_loc') || 'null'); if (s && Date.now() - s.t < 6 * 3600e3) return s; } catch (e) {}
  return null;
}

// ================= "NEXT 30 MINUTES" (drawn from the saved copy, no network) =================
function pickLiveTrip() {
  const trips = appData.trips || [];
  const live = t => { if (!t.startDate || !t.endDate) return false; const d = nowIn(tzOf(t)).date; return d >= t.startDate && d <= t.endDate; };
  return trips.find(t => t.id === activeTripId && live(t)) || trips.find(live) || null;
}
function renderNowCard() {
  const box = document.getElementById('now-card');
  if (!box) return;
  const trip = pickLiveTrip();
  if (!trip) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const tz = tzOf(trip), now = nowIn(tz), total = getTotalTripDays(trip);
  const dayN = Math.round((new Date(now.date) - new Date(trip.startDate)) / 864e5) + 1;
  const acts = (trip.itinerary || []).map((a, i) => ({ a, i, m: timeToMin(a.time) })).filter(x => x.a.day === dayN && x.m !== null && !x.a.done).sort((x, y) => x.m - y.m);
  let list = acts.filter(x => x.m >= now.min - 10 && x.m <= now.min + 30), heading = 'Next 30 minutes';
  if (!list.length) {
    const nxt = acts.find(x => x.m > now.min);
    if (nxt) { list = [nxt]; heading = `Nothing for 30 minutes • next at ${fmtMin(nxt.m)}`; } else heading = acts.length ? 'All done for today 🎉' : 'Nothing planned today';
  }
  const me = myLoc();
  const rows = list.map(({ a, i, m }) => {
    const wait = m - now.min, when = wait <= 0 ? 'NOW' : wait >= 60 ? `in ${Math.floor(wait / 60)}h ${String(wait % 60).padStart(2, '0')}m` : `in ${wait} min`;
    const c = resolveCoord(trip, a);
    let leave = '';
    if (c && me) {
      const km = calculateDistanceInKm(me.lat, me.lng, c.lat, c.lng), mins = travelMins(km), by = m - mins - 5;
      const late = by <= now.min;
      leave = `<p class="text-xs font-bold mt-1" style="color: ${late ? '#FFC9CD' : '#E3E2B0'};">${late ? '⏱ Leave now' : '⏱ Leave by ' + fmtMin(by)} • ≈ ${mins} min ${km <= 1.2 ? 'walk' : 'by car'} • ${km.toFixed(1)} km</p>`;
    }
    const dir = c ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` : (a.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location)}` : '');
    const doc = a.docId && (trip.checklists?.packing || []).find(x => x.id === a.docId);
    const btn = 'px-3 py-2 rounded-xl text-[11px] font-bold bg-white/15 hover:bg-white/25';
    return `<div class="now-row rounded-2xl p-3 bg-white/10">
      <div class="flex justify-between items-start gap-3">
        <div class="min-w-0"><p class="text-[11px] font-extrabold tracking-wide" style="color: #E3E2B0;">${fmtMin(m)} • ${when}</p>
          <p class="text-lg font-extrabold leading-tight">${escapeHtml(a.title)}</p>
          ${a.location ? `<p class="text-xs opacity-80 mt-0.5"><i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(a.location)}</p>` : ''}${leave}</div>
      </div>
      <div class="flex flex-wrap gap-2 mt-2.5">
        ${dir ? `<a href="${dir}" target="_blank" rel="noopener" class="${btn}"><i class="fa-solid fa-diamond-turn-right me-1"></i>Directions</a>` : ''}
        ${doc ? `<button onclick="openDocById('${doc.id}')" class="${btn}"><i class="fa-solid fa-ticket me-1"></i>Ticket</button>` : ''}
        ${a.location || a.title ? `<button onclick="openDriverForActivity('${trip.id}', ${i})" class="${btn}"><i class="fa-solid fa-taxi me-1"></i>Show driver</button>` : ''}
      </div></div>`;
  }).join('');
  const diff = tzDiffLabel(tz);
  box.classList.remove('hidden');
  box.innerHTML = `<div class="rounded-3xl p-4 text-white shadow-md space-y-3" style="background: linear-gradient(160deg, var(--midnight-blue), var(--dark-green));">
    <div class="flex justify-between items-start gap-3">
      <div><p class="text-[10px] font-extrabold uppercase tracking-widest opacity-80">🦆 Right now • ${escapeHtml(trip.name)} • Day ${dayN} of ${total}</p>
        <p class="text-4xl font-extrabold leading-none mt-1">${now.label} <span class="text-xs font-semibold opacity-80">${tzShort(tz)}</span></p>
        ${diff !== 'same time as your phone' ? `<p class="text-[11px] opacity-80 mt-1">Local time there • ${diff}</p>` : ''}</div>
      <button onclick="openTodayFromNow('${trip.id}', ${dayN})" class="text-[11px] font-bold px-3 py-2 rounded-xl bg-white/15 flex-shrink-0">Full day ›</button>
    </div>
    <p class="text-[11px] font-extrabold uppercase tracking-wider opacity-80">${heading}</p>
    ${rows ? `<div class="space-y-2">${rows}</div>` : ''}
  </div>`;
}
function openTodayFromNow(tripId, dayN) { openTripDashboard(tripId); activeItineraryDay = dayN; switchDashboardPage('itinerary'); }

// ================= SHOW TO DRIVER =================
function openDriverCard(name, detail) {
  const trip = getActiveTrip(), id = trip && ID_TZ.includes(tzOf(trip));
  const phrase = (a, b) => `<div class="rounded-2xl bg-white/10 px-4 py-3"><p class="text-xl font-extrabold">${a}</p><p class="text-xs opacity-70">${b}</p></div>`;
  document.getElementById('driver-body').innerHTML = `<p class="text-lg opacity-80 mb-2">${id ? 'Tolong antar saya ke:' : 'Please take me to:'}</p>
    <h2 class="text-4xl md:text-6xl font-extrabold leading-tight break-words">${escapeHtml(name)}</h2>
    ${detail ? `<p class="text-xl mt-3 opacity-80">${escapeHtml(detail)}</p>` : ''}
    ${id ? `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-8">${phrase('Pakai argo, ya', 'Please use the meter')}${phrase('Berhenti di sini, ya', 'Please stop here')}${phrase('Pelan-pelan, ya', 'Slowly, please')}</div><p class="text-2xl font-extrabold mt-8">Terima kasih 🙏</p>` : ''}`;
  openModal('modal-driver');
}
function openDriverForActivity(tripId, i) {
  const t = (appData.trips || []).find(x => x.id === tripId), a = t && t.itinerary[i];
  if (!a) return;
  if (t.id !== activeTripId) activeTripId = t.id;
  openDriverCard(a.location || a.title, a.location && a.location !== a.title ? a.title : '');
}
function openDriverForSpot(id) { const p = (getActiveTrip().places || []).find(x => x.id === id); if (p) openDriverCard(p.name, p.city || ''); }

// ================= EMERGENCY & LOCAL INFO (Malaysian traveller) =================
const LOCAL_INFO = {
  Indonesia: {
    emergency: [['General emergency', '112', '112'], ['Police', '110', '+62110'], ['Ambulance / medical', '118 or 119', '+62119'], ['Fire', '113', '+62113'], ['Search & rescue', '115', '+62115'], ['Natural disaster help', '129', '+62129']],
    embassy: { name: 'Embassy of Malaysia, Jakarta', address: 'Jl. H.R. Rasuna Said Kav. X/6, No. 1–3, Kuningan, Jakarta Selatan 12950', phone: '+62 21 522 4947', tel: '+62215224947', after: '+62 813 8081 3036', afterTel: '+6281380813036', email: 'mwjakarta@kln.gov.my' },
    facts: [['💱', 'Money', 'Indonesian rupiah (IDR). Keep some cash for markets and small warungs.'], ['🔌', 'Plugs', 'Type C / F sockets, 230 V. Malaysian (UK-style) plugs need an adapter.'], ['🚗', 'Driving', 'Traffic keeps to the left, like Malaysia.'], ['💧', 'Water', 'Stick to bottled or boiled water.'], ['📱', 'Getting around', 'Grab and Gojek ride-hailing are common. Use the app price, or agree the fare first.']],
    source: 'Numbers: Indonesia Tourism (indonesia.travel). Embassy: kln.gov.my and Wisma Putra notices. Checked 2 Nov 2026. Please confirm before relying on them.'
  }
};
const TZ_COUNTRY = { 'Asia/Jakarta': 'Indonesia', 'Asia/Makassar': 'Indonesia', 'Asia/Jayapura': 'Indonesia', 'Asia/Pontianak': 'Indonesia' };
function openEmergency() {
  const trip = pickLiveTrip() || getActiveTrip() || (appData.trips || [])[0];
  const tz = tzOf(trip), info = LOCAL_INFO[TZ_COUNTRY[tz]];
  const body = document.getElementById('emergency-body');
  let html = '';
  if (info) {
    html += `<div class="grid grid-cols-2 gap-2">${info.emergency.map(([l, n, tel]) => `<a href="tel:${tel}" class="rounded-2xl p-3 text-white text-center shadow-sm" style="background: var(--carnival-red);"><span class="block text-3xl font-extrabold leading-none">${n}</span><span class="block text-[11px] font-semibold mt-1 opacity-90">${l}</span></a>`).join('')}</div>
      <p class="text-[10px] text-stone-500">From a Malaysian SIM the buttons dial with +62. Tap to call.</p>
      <div class="lily-card p-4 bg-white space-y-2"><p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: var(--muted-teal);">🇲🇾 Malaysian help</p>
        <p class="font-extrabold text-sm" style="color: var(--midnight-blue);">${info.embassy.name}</p>
        <p class="text-xs text-stone-600">${info.embassy.address}</p>
        <div class="flex flex-wrap gap-2 pt-1">
          <a href="tel:${info.embassy.tel}" class="px-3 py-2 rounded-xl text-[11px] font-bold text-white" style="background: var(--midnight-blue);"><i class="fa-solid fa-phone me-1"></i>${info.embassy.phone}</a>
          <a href="tel:${info.embassy.afterTel}" class="px-3 py-2 rounded-xl text-[11px] font-bold text-white" style="background: var(--muted-teal);"><i class="fa-solid fa-phone-volume me-1"></i>After hours ${info.embassy.after}</a>
          <a href="mailto:${info.embassy.email}" class="px-3 py-2 rounded-xl text-[11px] font-bold bg-stone-100 text-stone-700"><i class="fa-solid fa-envelope me-1"></i>${info.embassy.email}</a>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.embassy.name)}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl text-[11px] font-bold bg-stone-100 text-stone-700"><i class="fa-solid fa-map-location-dot me-1"></i>Map</a>
        </div></div>
      <div class="lily-card p-4 bg-white space-y-2"><p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: var(--muted-teal);">Good to know</p>
        ${info.facts.map(([e, k, v]) => `<p class="text-xs text-stone-700"><span class="me-1">${e}</span><b>${k}:</b> ${v}</p>`).join('')}
        <p class="text-xs text-stone-700"><span class="me-1">🕐</span><b>Time:</b> ${nowIn(tz).label} ${tzShort(tz)} there • ${tzDiffLabel(tz)}.</p></div>
      <p class="text-[10px] text-stone-400">${info.source}</p>`;
  } else {
    html += `<div class="lily-card p-4 bg-white text-xs text-stone-600">I don't have built-in emergency numbers for this destination yet. Use the notes below to save the local emergency number, your embassy and your insurer's 24-hour line.</div>`;
  }
  html += `<div class="lily-card p-4 bg-white space-y-2"><p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: var(--muted-teal);">👥 Trip notes (shared with everyone)</p>
      <textarea id="emg-shared-notes" onchange="saveEmergencyNotes()" rows="3" placeholder="Hotel phone, insurance 24-hour line, group meeting point…" style="font-size:16px" class="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3 text-stone-800"></textarea></div>
    <div class="lily-card p-4 bg-white space-y-2"><p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: var(--muted-teal);">🔒 My medical info (only on this phone)</p>
      <textarea id="emg-private-notes" onchange="saveEmergencyPrivate()" rows="3" placeholder="Blood type, allergies, medication, policy number…" style="font-size:16px" class="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3 text-stone-800"></textarea></div>`;
  body.innerHTML = html;
  window._emgTripId = trip ? trip.id : null;
  if (trip) {
    document.getElementById('emg-shared-notes').value = trip.emergencyNotes || '';
    try { document.getElementById('emg-private-notes').value = localStorage.getItem('lily_private_note_' + trip.id) || ''; } catch (e) {}
  }
  openModal('modal-emergency');
}
function saveEmergencyNotes() { const t = (appData.trips || []).find(x => x.id === window._emgTripId); if (t) { t.emergencyNotes = document.getElementById('emg-shared-notes').value; saveAppData(); } }
function saveEmergencyPrivate() { try { localStorage.setItem('lily_private_note_' + window._emgTripId, document.getElementById('emg-private-notes').value); } catch (e) {} }

// ================= CITIES (Spots shows only the city you are in) =================
const placeCity = p => (p.city || '').trim() || 'Jakarta';
function tripCities(trip) {
  const m = new Map();
  (trip.places || []).forEach(p => { const c = placeCity(p); if (!m.has(c.toLowerCase())) m.set(c.toLowerCase(), c); });
  return [...m.values()].sort();
}
function hotelCityKey(trip) {
  const hotelName = trip.activeHotel || '';
  if (hotelName && typeof hotelDatabase !== 'undefined' && hotelDatabase) {
    for (const [cityKey, cityHotels] of Object.entries(hotelDatabase)) if (cityHotels.some(h => h.name === hotelName)) return cityKey.toLowerCase();
  }
  return (trip.hotelCity || '').toLowerCase();
}
function currentCityInfo(trip) {
  const cities = tripCities(trip);
  if (!cities.length) return { city: '', src: '' };
  const find = n => cities.find(c => c.toLowerCase() === String(n || '').toLowerCase());
  try { const s = JSON.parse(localStorage.getItem('lily_spots_city_' + trip.id) || 'null'); if (s && Date.now() - s.t < 12 * 3600e3 && find(s.c)) return { city: find(s.c), src: 'your choice' }; } catch (e) {}
  const me = myLoc();
  if (me) {
    let best = null, bd = 1e9;
    (trip.places || []).forEach(p => { if (p.lat && p.lng) { const d = calculateDistanceInKm(me.lat, me.lng, p.lat, p.lng); if (d < bd) { bd = d; best = placeCity(p); } } });
    if (best && bd < 80 && find(best)) return { city: find(best), src: 'your location' };
  }
  const hc = find(hotelCityKey(trip));
  return hc ? { city: hc, src: 'your hotel' } : { city: cities[0], src: '' };
}
const currentCity = trip => currentCityInfo(trip).city;
function setSpotsCity(c) {
  const t = getActiveTrip();
  try { localStorage.setItem('lily_spots_city_' + t.id, JSON.stringify({ c, t: Date.now() })); } catch (e) {}
  masterCat = 'ALL'; renderMasterPlacesList(); renderWaddleView();
}
const tripTz = tzOf;
function renderCityChips(cities, city) {
  const box = document.getElementById('spots-city-chips');
  if (!box) return;
  box.innerHTML = '';
  cities.forEach(c => {
    const b = document.createElement('button'), on = c.toLowerCase() === city.toLowerCase();
    b.className = `px-4 py-1.5 rounded-full text-[11px] font-extrabold border flex-shrink-0 ${on ? 'text-white border-transparent' : 'bg-white text-stone-600 border-stone-200'}`;
    if (on) b.style.backgroundColor = 'var(--midnight-blue)';
    b.innerHTML = `<i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(c)}`;
    b.onclick = () => setSpotsCity(c);
    box.appendChild(b);
  });
  const add = document.createElement('button');
  add.className = 'px-4 py-1.5 rounded-full text-[11px] font-extrabold border border-dashed border-stone-300 text-stone-600 flex-shrink-0';
  add.innerHTML = '<i class="fa-solid fa-plus me-1"></i>New city';
  add.onclick = () => openMasterSpotModal(true);
  box.appendChild(add);
}
function seedPlacesFor(name) {
  if (typeof getAllMasterLocations !== 'function') return [];
  const n = (name || '').toLowerCase();
  const base = getAllMasterLocations().filter(m => n.includes((m.city || '').toLowerCase()));
  return [...base, ...transitSeedPlaces(new Set(base.map(m => (m.city || '').toLowerCase())))];
}
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function airportToPlace(a) {
  return { id: 'apt_' + a.code, name: `${a.name} (${a.code})`, category: 'Airport', code: a.code, city: a.city, lat: a.lat, lng: a.lng, station: '', walk: '', map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name)}`, starred: false };
}
// Train / MRT / LRT stations and airports for the cities a trip already uses
function transitSeedPlaces(cities) {
  const out = [];
  if (typeof stationDatabase !== 'undefined') Object.entries(stationDatabase).forEach(([key, list]) => {
    if (cities.has(key.toLowerCase())) list.forEach(st => out.push({ id: `trn_${key}_${slugOf(st.name)}`, name: st.name, category: 'Transit', transitType: st.category, city: key.charAt(0).toUpperCase() + key.slice(1), lat: st.lat, lng: st.lng, station: '', walk: '', map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.name)}`, starred: false }));
  });
  if (typeof airportDatabase !== 'undefined') airportDatabase.forEach(a => { if (a.seedFor && cities.has(a.seedFor.toLowerCase())) out.push(airportToPlace(a)); });
  return out;
}
function syncTransitSpots(trip) {
  if (!trip.places) trip.places = [];
  let changed = false;
  transitSeedPlaces(new Set(trip.places.map(p => placeCity(p).toLowerCase()))).forEach(s => { if (!trip.places.some(p => p.id === s.id)) { trip.places.push(s); changed = true; } });
  return changed;
}

window.onload = function() {
  initHotelDatabase();
  showInstallCard(); updateOnlinePill();
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
  const ref = db.collection("travelHub").doc("sharedTripData");
  ref.onSnapshot({ includeMetadataChanges: true }, (doc) => {
    const fromCache = !!(doc.metadata && doc.metadata.fromCache);
    // "Not in the cache" is NOT "doesn't exist". Never write starter data because of it.
    if (fromCache && !doc.exists) { if (!cloudReady) setSyncState(isDirty() ? 'waiting' : 'idle'); return; }
    // A cached copy may be old: show it, but wait for the server before trusting or saving anything.
    if (fromCache && !cloudReady) { if (!hadCache) { adoptShared(doc.data()); renderEverything(); } return; }
    if (!doc.exists) {                                  // the server confirms there is nothing yet: create it
      cloudReady = true; if (!hadCache) baselineHashes(); setDirty(true); return pushToCloud();
    }
    const remote = doc.data(), key = contentKey(remote), first = !cloudReady;
    cloudReady = true;
    if (!first && key === lastRemoteKey && !isDirty()) return;       // metadata-only change
    lastRemoteKey = key;
    let haveBaseline = false; try { haveBaseline = !!localStorage.getItem(HASH_KEY); } catch (e) {}
    if (first && hadCache && !haveBaseline && contentKey(shareableData()) !== key) return offerVersionChoice(shareableData(), remote);
    if (isDirty()) {                                    // keep your unsaved edits, add what others changed
      const local = shareableData(); stampChanges(local);
      const merged = mergeShared(remote, local);
      adoptShared(merged);
      if (contentKey(merged) !== key) { scheduleCloudPush(0); } else { setDirty(false); setSyncState('saved'); }
    } else adoptShared(remote);
    if (first && !isDirty()) { const e0 = syncState; if (e0 !== 'error') setSyncState('idle'); }
    const prevTrip = activeTripId, viewing = !document.getElementById('section-trip-dashboard')?.classList.contains('hidden');
    let trip = getActiveTrip();
    if (trip && syncMasterLocations(trip)) saveAppData();
    renderEverything();
    if (viewing && !(appData.trips || []).some(t => t.id === prevTrip)) openHomePage();
  }, (error) => {
    setSyncState('error', 'Could not read from the cloud (' + ((error && (error.code || error.message)) || 'unknown') + '). Showing the copy saved on this phone. If this keeps happening, check your Firestore rules.');
    renderEverything();
  });
}

function syncMasterLocations(trip) {
  if (typeof getAllMasterLocations !== 'function') return false;
  let changed = false;
  const mine = new Set((trip.places || []).map(p => placeCity(p).toLowerCase()));   // only cities this trip already uses
  getAllMasterLocations().forEach(m => {
    const p = trip.places.find(x => x.id === m.id);
    if (!p) { if (mine.has(String(m.city || '').toLowerCase())) { trip.places.push({ ...m }); changed = true; } }
    else if (!p.lat && m.lat) { p.lat = m.lat; p.lng = m.lng; changed = true; }
  });
  if (syncTransitSpots(trip)) changed = true;
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
    try { localStorage.setItem('lily_last_loc', JSON.stringify({ lat: userLoc.lat, lng: userLoc.lng, t: Date.now() })); } catch (e) {}
    if (moved) refreshLocationViews();
  }, () => { userLoc.live = false; userLoc.denied = true; refreshLocationViews(); }, { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 });
}

function refreshLocationViews() {
  renderNowCard();
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

// ================= DATA SAFETY =================
// Every edit is saved on this phone first, then merged into the cloud copy. A cloud copy is never
// overwritten by an older one, "not found in cache" is never treated as "empty", and failures are shown.
const CACHE_KEY = 'lily_pond_image2_data', HASH_KEY = 'lily_sync_hashes', DIRTY_KEY = 'lily_cloud_dirty', ACTIVE_KEY = 'lily_active_trip', BACKUP_KEY = 'lily_backup_before_cloud';
const MAX_DOC_BYTES = 950000;   // Firestore refuses documents over 1 MiB
let cloudReady = false, hadCache = false, syncTimer = null, syncBusy = false, syncState = 'idle', syncMsg = '', lastSavedAt = 0, lastRemoteKey = '', _vc = null, _pendingRestore = null;
const stable = o => Array.isArray(o) ? '[' + o.map(stable).join(',') + ']' : (o && typeof o === 'object') ? '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}' : JSON.stringify(o);
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
const isDirty = () => { try { return localStorage.getItem(DIRTY_KEY) === '1'; } catch (e) { return false; } };
function setDirty(v) { try { if (v) localStorage.setItem(DIRTY_KEY, '1'); else localStorage.removeItem(DIRTY_KEY); } catch (e) {} }
function contentKey(d) { return stable((d.trips || []).map(t => { const c = { ...t }; delete c._ts; return c; })); }

// What goes to the cloud: everything except private checklist items (they stay on this phone)
function shareableData() {
  const d = JSON.parse(JSON.stringify(appData));
  (d.trips || []).forEach(t => {
    t.sharedChecklist = ((t.checklists && t.checklists.packing) || []).filter(i => i.shared).map(i => { const c = { ...i }; if (!String(c.fileData || '').startsWith('http')) delete c.fileData; return c; });
    delete t.checklists;
  });
  d.deletedTrips = appData.deletedTrips || {};
  return d;
}
function baselineHashes() {
  const h = {};
  (shareableData().trips || []).forEach(t => { h[t.id] = {}; Object.keys(t).forEach(k => { if (k !== '_ts') h[t.id][k] = hashStr(stable(t[k])); }); });
  try { localStorage.setItem(HASH_KEY, JSON.stringify(h)); } catch (e) {}
}
// Stamp the sections you changed since the last time we matched the cloud (no baseline = stamp nothing)
function stampChanges(shared) {
  let h = null; try { h = JSON.parse(localStorage.getItem(HASH_KEY) || 'null'); } catch (e) {}
  if (!h) return;
  const now = Date.now();
  (shared.trips || []).forEach(t => {
    const th = h[t.id], ts = t._ts || (t._ts = {});
    Object.keys(t).forEach(k => { if (k !== '_ts' && (!th || th[k] !== hashStr(stable(t[k])))) ts[k] = now; });
  });
}
// Combine two copies section by section; the most recent edit of each section wins, the cloud wins ties
function mergeShared(remote, local) {
  const dead = { ...(remote.deletedTrips || {}) };
  Object.entries(local.deletedTrips || {}).forEach(([k, v]) => { dead[k] = Math.max(dead[k] || 0, v); });
  Object.keys(dead).forEach(k => { if (Date.now() - dead[k] > 90 * 864e5) delete dead[k]; });
  const out = { ...remote, ...local, deletedTrips: dead, trips: [] };
  const ids = [];
  [...(remote.trips || []), ...(local.trips || [])].forEach(t => { if (!ids.includes(t.id)) ids.push(t.id); });
  ids.forEach(id => {
    if (dead[id]) return;
    const r = (remote.trips || []).find(t => t.id === id), l = (local.trips || []).find(t => t.id === id);
    if (!r || !l) return out.trips.push(r || l);
    const m = {}, ts = {};
    new Set([...Object.keys(r), ...Object.keys(l)]).forEach(k => {
      if (k === '_ts') return;
      const tr = (r._ts || {})[k] || 0, tl = (l._ts || {})[k] || 0, useLocal = (k in l) && (tl > tr || !(k in r));
      m[k] = useLocal ? l[k] : r[k]; ts[k] = useLocal ? tl : tr;
    });
    m._ts = ts; out.trips.push(m);
  });
  return out;
}
function adoptShared(shared) {
  appData = JSON.parse(JSON.stringify(shared));
  appData.deletedTrips = appData.deletedTrips || {};
  hydrateDeviceChecklists();
  const lt = (() => { try { return localStorage.getItem(ACTIVE_KEY); } catch (e) { return null; } })();
  if (lt && appData.trips.some(t => t.id === lt)) activeTripId = lt;
  else if (!appData.trips.some(t => t.id === activeTripId)) activeTripId = appData.trips[0] ? appData.trips[0].id : null;
  baselineHashes();
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(shareableData())); } catch (e) {}
}
function renderEverything() { try { renderHomeViews(); renderNowCard(); renderActiveTripDashboard(); } catch (e) { console.warn(e); } }

function saveAppData() {
  appData.currentTripId = activeTripId;
  try { localStorage.setItem(ACTIVE_KEY, activeTripId || ''); } catch (e) {}
  saveDeviceChecklists();
  const shared = shareableData();
  stampChanges(shared);
  (shared.trips || []).forEach(st => { const lt = (appData.trips || []).find(x => x.id === st.id); if (lt && st._ts) lt._ts = st._ts; });
  shared.updatedAt = Date.now();
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(shared)); } catch (e) {}
  setDirty(true);
  scheduleCloudPush(400);
}
function scheduleCloudPush(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(pushToCloud, ms == null ? 400 : ms); if (cloudReady && navigator.onLine) setSyncState('saving'); }

// Move any photos stored inside the trip data into their own cloud documents (each photo gets its own 1 MB)
async function slimInlinePhotos() {
  let moved = 0;
  for (const t of (appData.trips || [])) for (const p of (t.places || [])) {
    if (!Array.isArray(p.gallery) || !p.gallery.some(u => typeof u === 'string' && u.startsWith('data:'))) continue;
    const out = [];
    for (const u of p.gallery) {
      if (typeof u === 'string' && u.startsWith('data:')) {
        const id = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        try { await Promise.race([db.collection('travelHub').doc('photo_' + id).set({ data: u }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]); _photoCache[id] = u; out.push('photo:' + id); moved++; }
        catch (e) { out.push(u); }
      } else out.push(u);
    }
    p.gallery = out;
  }
  return moved;
}
async function pushToCloud() {
  if (syncBusy) return scheduleCloudPush(800);
  if (!isDirty()) return;
  if (_vc) return setSyncState('choice');
  if (!cloudReady) return setSyncState('waiting');
  if (!navigator.onLine) return setSyncState('offline');
  syncBusy = true; setSyncState('saving');
  try {
    if (await slimInlinePhotos()) { saveDeviceChecklists(); }
    const shared = shareableData(); stampChanges(shared);
    (shared.trips || []).forEach(st => { const lt = (appData.trips || []).find(x => x.id === st.id); if (lt && st._ts) lt._ts = st._ts; });
    const ref = db.collection('travelHub').doc('sharedTripData');
    let merged = null;
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      merged = snap.exists ? mergeShared(snap.data(), shared) : shared;
      merged.updatedAt = Date.now();
      const size = new Blob([JSON.stringify(merged)]).size;
      if (size > MAX_DOC_BYTES) throw Object.assign(new Error('too-large'), { code: 'too-large', size });
      tx.set(ref, merged);
    });
    const changedByOthers = contentKey(merged) !== contentKey(shared);
    adoptShared(merged); lastRemoteKey = contentKey(merged);
    setDirty(false); lastSavedAt = Date.now(); setSyncState('saved');
    if (changedByOthers) renderEverything();
  } catch (e) { handleSyncError(e); }
  finally { syncBusy = false; }
}
function handleSyncError(e) {
  const code = (e && e.code) || '', raw = (e && e.message) || String(e);
  let msg;
  if (code === 'too-large') msg = `Your trip data is too big to save (${Math.round((e.size || 0) / 1024)} KB, the limit is about 950 KB). Photos kept inside it are usually the cause. Delete some photos or large items, then tap Retry.`;
  else if (code === 'permission-denied') msg = "The cloud refused the save. In the Firebase console, open Firestore Database → Rules and allow read and write on the 'travelHub' collection (test-mode rules expire after 30 days).";
  else if (['unavailable', 'aborted', 'deadline-exceeded', 'failed-precondition', 'cancelled'].includes(code) || !navigator.onLine) { setSyncState('offline', 'Waiting for a connection. Your changes are safe on this phone and will upload automatically.'); setTimeout(() => { if (isDirty()) scheduleCloudPush(0); }, 30000); return; }
  else msg = 'Saving to the cloud failed: ' + raw;
  setSyncState('error', msg);
}
function setSyncState(s, msg) {
  syncState = s; if (msg !== undefined) syncMsg = msg;
  const el = document.getElementById('sync-pill');
  if (!el) return;
  clearTimeout(window._pillTimer);
  const base = 'fixed top-2 right-2 z-[70] px-3 py-1.5 rounded-full text-[11px] font-bold border shadow-sm ';
  const set = (cls, txt, style) => { el.className = base + cls; el.textContent = txt; el.setAttribute('style', style || ''); };
  if (s === 'saving') set('bg-white text-stone-600 border-stone-200', '☁ Saving…');
  else if (s === 'saved') { set('bg-white text-stone-600 border-stone-200', '✓ Saved'); window._pillTimer = setTimeout(() => el.classList.add('hidden'), 1800); }
  else if (s === 'offline') set('bg-amber-50 text-amber-800 border-amber-200', '📴 Will save when online');
  else if (s === 'error') set('text-white border-transparent', '⚠ Not saved to cloud • tap', 'background: var(--carnival-red);');
  else if (s === 'choice') set('text-white border-transparent', '⚠ Choose a version', 'background: var(--carnival-red);');
  else el.classList.add('hidden');
}
window.addEventListener('online', () => { if (isDirty()) scheduleCloudPush(0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && isDirty()) scheduleCloudPush(0); });
setInterval(() => { if (isDirty() && !syncBusy && syncState !== 'error') scheduleCloudPush(0); }, 45000);

// ---- Photos kept as separate documents are referenced as "photo:ID" ----
function imgUrl(u, fallback) {
  if (!String(u).startsWith('photo:')) return u;
  const id = String(u).slice(6);
  if (_photoCache[id]) return _photoCache[id];
  if (!_photoLoading[id]) { _photoLoading[id] = true; fetchPhotoNow(id).then(d => { delete _photoLoading[id]; if (d) refreshPhotoViews(); }); }
  return fallback === undefined ? PLACEHOLDER_IMG : fallback;
}
function refreshPhotoViews() {
  try {
    const d = document.getElementById('page-spot-detail');
    if (d && !d.classList.contains('hidden') && window._openSpotId) { const p = (getActiveTrip().places || []).find(x => x.id === window._openSpotId); if (p) openSpotDetailView(p, true); }
    else if (!document.getElementById('page-master')?.classList.contains('hidden')) renderMasterPlacesList();
  } catch (e) {}
}

// ---- Backup & restore ----
function loadDevicePacking() {
  const out = {};
  (appData.trips || []).forEach(t => { out[t.id] = ((t.checklists && t.checklists.packing) || []).filter(i => !i.shared); });
  return out;
}
function exportBackup() {
  const payload = { app: 'waddl', version: 1, exportedAt: new Date().toISOString(), shared: shareableData(), device: loadDevicePacking() };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  a.download = 'waddl-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function downloadSavedBackup() {
  try { const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'waddl', version: 1, exportedAt: b.at, shared: b.data, device: {} })], { type: 'application/json' }));
    a.download = 'waddl-phone-version-' + String(b.at).slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
function pickBackupFile() { document.getElementById('sync-restore-file').click(); }
function onBackupChosen(input) {
  const f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const p = JSON.parse(r.result);
      if (!p || !p.shared || !Array.isArray(p.shared.trips)) throw new Error('not a backup');
      _pendingRestore = p;
      document.getElementById('sync-restore-info').innerHTML = `<b>${p.shared.trips.length} trip${p.shared.trips.length === 1 ? '' : 's'}</b> from ${escapeHtml(String(p.exportedAt || '').slice(0, 10))}:<br>${summarizeShared(p.shared).map(escapeHtml).join('<br>')}`;
      document.getElementById('sync-restore-confirm').classList.remove('hidden');
    } catch (e) { alert("That file isn't a Waddl backup."); }
  };
  r.readAsText(f);
}
async function confirmRestore() {
  const p = _pendingRestore; if (!p) return;
  document.getElementById('sync-restore-confirm').classList.add('hidden');
  const dead = { ...(appData.deletedTrips || {}), ...(p.shared.deletedTrips || {}) };
  try { const snap = await db.collection('travelHub').doc('sharedTripData').get(); if (snap.exists) (snap.data().trips || []).forEach(t => { if (!p.shared.trips.some(x => x.id === t.id)) dead[t.id] = Date.now(); }); } catch (e) {}
  p.shared.trips.forEach(t => delete dead[t.id]);
  const now = Date.now();
  p.shared.trips.forEach(t => { t._ts = t._ts || {}; Object.keys(t).forEach(k => { if (k !== '_ts') t._ts[k] = now; }); });
  p.shared.deletedTrips = dead;
  appData = JSON.parse(JSON.stringify(p.shared));
  Object.entries(p.device || {}).forEach(([id, items]) => { try { localStorage.setItem(checklistStorageKey(id), JSON.stringify({ packing: items })); } catch (e) {} });
  hydrateDeviceChecklists();
  if (!appData.trips.some(t => t.id === activeTripId)) activeTripId = appData.trips[0] ? appData.trips[0].id : null;
  _pendingRestore = null; saveAppData(); closeModal('modal-sync'); renderEverything();
}
function summarizeShared(d) { return (d.trips || []).map(t => `${t.name}: ${(t.itinerary || []).length} activities, ${(t.expenses || []).length} expenses, ${(t.places || []).length} spots`); }
function openSyncModal() {
  const states = { saved: lastSavedAt ? 'All changes are saved to the cloud. Last saved ' + new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.' : 'Everything is up to date.', saving: 'Saving…', waiting: 'Checking what the cloud holds before saving…', offline: syncMsg || "You're offline. Changes are kept on this phone and will upload when you're back online.", error: syncMsg, choice: 'Choose which version to keep first.', idle: isDirty() ? 'Some changes have not reached the cloud yet.' : 'Everything is up to date.' };
  document.getElementById('sync-status-text').textContent = states[syncState] || states.idle;
  document.getElementById('sync-restore-confirm').classList.add('hidden');
  document.getElementById('sync-phone-backup').classList.toggle('hidden', !localStorage.getItem(BACKUP_KEY));
  openModal('modal-sync');
}
function retrySync() { setSyncState('saving'); scheduleCloudPush(0); closeModal('modal-sync'); }

// ---- First run after an update: phone and cloud disagree ----
function offerVersionChoice(local, remote) {
  _vc = { local, remote };
  const col = (title, d) => `<div class="rounded-2xl p-3 bg-stone-50 border border-stone-200"><p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: var(--muted-teal);">${title}</p>${summarizeShared(d).map(l => `<p class="text-[11px] text-stone-700 mt-1">${escapeHtml(l)}</p>`).join('') || '<p class="text-[11px] text-stone-400 mt-1">No trips</p>'}</div>`;
  document.getElementById('vc-body').innerHTML = col('📱 This phone', local) + col('☁ Cloud', remote);
  setSyncState('choice'); openModal('modal-version-choice');
}
function keepPhoneVersion() {
  const { local, remote } = _vc; _vc = null;
  closeModal('modal-version-choice');
  adoptShared(remote);                                 // the cloud becomes the baseline...
  appData = JSON.parse(JSON.stringify(local)); appData.deletedTrips = appData.deletedTrips || {}; hydrateDeviceChecklists();
  lastRemoteKey = contentKey(remote);
  saveAppData();                                       // ...so everything that differs counts as your newer edit
  renderEverything();
}
function useCloudVersion() {
  const { local, remote } = _vc; _vc = null;
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), data: local })); } catch (e) {}
  closeModal('modal-version-choice');
  adoptShared(remote); lastRemoteKey = contentKey(remote); setDirty(false); setSyncState('saved'); renderEverything();
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

function tripStats(trip) {
  const total = getTotalTripDays(trip), acts = trip.itinerary || [], tc = tripCur(trip);
  const visited = new Set();
  acts.forEach(a => { if (a.done && a.placeId) visited.add(a.placeId); });
  (trip.places || []).forEach(p => { if (p.visited) visited.add(p.id); });
  let km = 0; for (let d = 1; d <= total; d++) km += dayStats(trip, d).km;
  let spent = 0; const byCat = {};
  (trip.expenses || []).forEach(e => { const v = expToTrip(trip, e); if (v !== null) { spent += v; const c = e.category || 'Other'; byCat[c] = (byCat[c] || 0) + v; } });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const people = Math.max(1, getMembers(trip).length);
  return { total, acts: acts.length, done: acts.filter(a => a.done).length, spots: visited.size, km, spent, perPerson: spent / people, people, top, tc,
    photos: (trip.places || []).reduce((n, p) => n + (p.gallery || []).length, 0), cities: tripCities(trip) };
}
function renderPostTravelInfographicCard(trip) {
  try { initConverter(trip); } catch (e) {}
  const card = document.getElementById('post-travel-card');
  if (!card || !trip) return;
  const now = nowIn(tzOf(trip)).date;
  if (!trip.startDate || now < trip.startDate) { card.classList.add('hidden'); return; }
  const s = tripStats(trip), over = trip.endDate && now > trip.endDate, set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  card.classList.remove('hidden');
  set('stat-title', over ? 'Trip completed! 🎉' : 'Your trip so far');
  set('stat-days', s.total); set('stat-done', `${s.done}/${s.acts}`); set('stat-spots', s.spots);
  set('stat-km', `${s.km.toFixed(0)} km`); set('stat-spent', fmtMoney(s.spent, s.tc)); set('stat-pp', fmtMoney(s.perPerson, s.tc));
  set('stat-extra', [s.top ? `Biggest spend: ${s.top[0]}` : '', s.photos ? `${s.photos} photo${s.photos === 1 ? '' : 's'}` : '', s.cities.length ? s.cities.join(' • ') : ''].filter(Boolean).join('  •  '));
}
function drawTripCard(trip) {
  const s = tripStats(trip), W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#F1ECD3'); bg.addColorStop(1, '#C4BA65'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(77,90,46,.10)';
  [[150, 1190, 190], [940, 210, 140], [910, 1130, 120], [170, 250, 100]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.textAlign = 'center'; g.fillStyle = '#4D5A2E'; g.font = '700 38px system-ui, sans-serif'; g.fillText('🦆  TRIP MEMORY  🪷', W / 2, 105);
  g.font = '800 78px system-ui, sans-serif';
  const words = String(trip.name || 'My trip').split(' '), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 900 && cur) { lines.push(cur); cur = w; } else cur = t; });
  lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 230 + i * 92));
  const y0 = 230 + Math.min(lines.length, 3) * 92;
  g.font = '600 38px system-ui, sans-serif'; g.fillStyle = '#5b6637';
  g.fillText(`${trip.startDate || ''} – ${trip.endDate || ''}`, W / 2, y0 + 20);
  if (s.cities.length) g.fillText(s.cities.join('  •  '), W / 2, y0 + 72);
  const tiles = [['Days', String(s.total)], ['Activities done', `${s.done}/${s.acts}`], ['Spots visited', String(s.spots)], ['Distance planned', `${s.km.toFixed(0)} km`], ['Total spent', fmtMoney(s.spent, s.tc)], [`Per person (${s.people})`, fmtMoney(s.perPerson, s.tc)]];
  tiles.forEach(([label, val], i) => {
    const x = 70 + (i % 2) * 490, y = 480 + Math.floor(i / 2) * 230;
    g.fillStyle = 'rgba(255,255,255,.88)'; rr(x, y, 450, 200, 36); g.fill();
    g.fillStyle = '#4D5A2E'; let fs = 84; g.font = `800 ${fs}px system-ui, sans-serif`;
    while (g.measureText(val).width > 400 && fs > 30) { fs -= 4; g.font = `800 ${fs}px system-ui, sans-serif`; }
    g.fillText(val, x + 225, y + 105); g.font = '600 32px system-ui, sans-serif'; g.fillStyle = '#6b7340'; g.fillText(label, x + 225, y + 160);
  });
  g.fillStyle = '#4D5A2E'; g.font = '700 36px system-ui, sans-serif';
  g.fillText([s.top ? `Biggest spend: ${s.top[0]}` : '', s.photos ? `${s.photos} photos` : ''].filter(Boolean).join('   •   '), W / 2, 1220);
  g.font = '600 30px system-ui, sans-serif'; g.fillStyle = '#6b7340'; g.fillText('Made with Waddl 🦆', W / 2, 1290);
  return c;
}
function downloadTripCard() {
  const t = getActiveTrip();
  drawTripCard(t).toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = 'trip-memory-' + String(t.name || 'trip').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
function shareTripCard() {
  const t = getActiveTrip();
  drawTripCard(t).toBlob(async b => {
    const f = new File([b], 'trip-memory.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: t.name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    downloadTripCard();
  }, 'image/png');
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
  return hotelCityKey(trip) || (currentCity(trip) || 'jakarta').toLowerCase();
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
  const imgs = (place.gallery && place.gallery.length) ? place.gallery.map(u => imgUrl(u)) : [];
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
        <div id="spot-about-box">${spotAboutHtml(place, false)}</div>
        <div><p class="font-bold text-sm mb-2" style="color: var(--midnight-blue);">Details</p><div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2.5">${tiles}</div></div>
        <div id="spot-gallery-box">${spotGalleryHtml(place)}</div>
        <div class="flex gap-2 pt-1">
          <a href="${dir}" target="_blank" rel="noopener" class="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm" style="background-color: var(--midnight-blue);"><i class="fa-solid fa-diamond-turn-right"></i> Get directions</a>
          <button onclick="addSpotToItinerary('${place.id}')" aria-label="Add to itinerary" class="w-14 rounded-2xl border border-stone-200 flex items-center justify-center" style="color: var(--midnight-blue);"><i class="fa-solid fa-calendar-plus"></i></button>
          <button onclick="openDriverForSpot('${place.id}')" aria-label="Show to driver" class="w-14 rounded-2xl border border-stone-200 flex items-center justify-center" style="color: var(--midnight-blue);"><i class="fa-solid fa-taxi"></i></button>
          <button onclick="toggleVisitedSpot('${place.id}')" aria-label="Mark visited" class="w-14 rounded-2xl border flex items-center justify-center font-bold ${place.visited ? 'text-white border-transparent' : 'border-stone-200'}" style="${place.visited ? 'background: var(--muted-teal);' : 'color: var(--midnight-blue);'}"><i class="fa-solid fa-circle-check"></i></button>
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

function spotAboutHtml(place, editing) {
  const head = `<div class="flex items-center justify-between mb-1"><p class="font-bold text-sm" style="color: var(--midnight-blue);">About this spot • our thoughts</p>${editing ? '' : `<button onclick="startEditAbout('${place.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600"><i class="fa-solid fa-pen me-1"></i>Edit</button>`}</div>`;
  if (editing) return head + `<textarea id="spot-about-input" rows="5" maxlength="1500" placeholder="Our thoughts: what to order, best time to go, tips…" style="font-size:16px" class="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3 text-stone-800">${escapeHtml(place.desc || '')}</textarea>
    <div class="flex justify-end gap-2 mt-2"><button onclick="cancelAbout('${place.id}')" class="px-3.5 py-2 bg-stone-100 text-stone-600 rounded-2xl text-xs font-medium">Cancel</button><button onclick="saveAbout('${place.id}')" class="px-4 py-2 rounded-2xl text-xs font-semibold text-white" style="background-color: var(--midnight-blue);">Save</button></div>`;
  return head + (place.desc ? `<p class="text-xs text-stone-600 leading-relaxed whitespace-pre-line">${escapeHtml(place.desc)}</p>` : `<p class="text-xs text-stone-400 leading-relaxed">No notes yet. Tap Edit to add what you thought, tips, or what to order. Everyone on the trip sees it.</p>`);
}
function spotAboutBox(id, editing) { const p = (getActiveTrip().places || []).find(x => x.id === id), b = document.getElementById('spot-about-box'); if (p && b) { b.innerHTML = spotAboutHtml(p, editing); if (editing) document.getElementById('spot-about-input')?.focus(); } }
function startEditAbout(id) { spotAboutBox(id, true); }
function cancelAbout(id) { spotAboutBox(id, false); }
function saveAbout(id) {
  const p = (getActiveTrip().places || []).find(x => x.id === id);
  if (!p) return;
  p.desc = document.getElementById('spot-about-input').value.trim();
  saveAppData(); spotAboutBox(id, false);
}
function toggleVisitedSpot(id) {
  const p = (getActiveTrip().places || []).find(x => x.id === id);
  if (!p) return;
  p.visited = !p.visited; saveAppData(); openSpotDetailView(p, true); renderSummaryPage();
}
function toggleActivityDone(i) {
  const a = getActiveTrip().itinerary[i];
  if (!a) return;
  a.done = !a.done; saveAppData(); renderItinerary(); renderSummaryPage(); renderNowCard();
}

function spotGalleryHtml(place) {
  const imgs = (place.gallery || []).map(u => imgUrl(u)), manage = window._galleryManage === place.id;
  return `<div class="flex items-center justify-between mb-2"><p class="font-bold text-sm" style="color: var(--midnight-blue);">Photo gallery${imgs.length ? ' (' + imgs.length + ')' : ''}</p>
    <div class="flex gap-2">${imgs.length > 1 ? `<button onclick="downloadAllGallery('${place.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600"><i class="fa-solid fa-download me-1"></i>Save all</button>` : ''}${imgs.length ? `<button onclick="toggleGalleryManage('${place.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600">${manage ? 'Done' : 'Manage'}</button>` : ''}
    <button onclick="triggerSpotPhotoUpload('${place.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style="background: var(--muted-teal);"><i class="fa-solid fa-camera me-1"></i>Add</button></div></div>
    <p id="spot-upload-status" class="text-[11px] font-semibold mb-1 hidden" style="color: var(--muted-teal);"></p>
    ${imgs.length ? `<div class="grid grid-cols-3 gap-2">${imgs.map((u, i) => `<div class="relative aspect-square"><img src="${u}" onclick="openImageViewer(this.src)" loading="lazy" class="w-full h-full object-cover rounded-xl border border-stone-200 cursor-pointer">${!manage ? `<button onclick="downloadGalleryPhoto('${place.id}', ${i})" aria-label="Download photo" class="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full text-white flex items-center justify-center shadow" style="background: rgba(57,67,31,.85);"><i class="fa-solid fa-download text-xs"></i></button>` : ''}${manage ? `<button onclick="deleteGalleryPhoto('${place.id}', ${i})" aria-label="Delete photo" class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shadow" style="background: var(--carnival-red);"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('')}</div>
    <p class="text-[10px] text-stone-400 mt-2">Tap a photo to open it, then press Download to keep it.</p>` : `<p class="text-xs text-stone-400">No photos yet. Add the ones you take here. Anyone on the trip can open them and download.</p>`}`;
}
function toggleGalleryManage(id) { window._galleryManage = window._galleryManage === id ? null : id; const p = (getActiveTrip().places || []).find(x => x.id === id), b = document.getElementById('spot-gallery-box'); if (p && b) b.innerHTML = spotGalleryHtml(p); }
function deleteGalleryPhoto(id, i) {
    const p = (getActiveTrip().places || []).find(x => x.id === id);
    if (!p || !p.gallery || !p.gallery[i]) return;

    showCustomConfirm("Delete this photo for everyone?", () => {
        const url = p.gallery[i];
        p.gallery.splice(i, 1);
        if (String(url).startsWith('photo:')) deletePhotoDoc(String(url).slice(6));
        try { if (storage && String(url).includes('firebasestorage')) storage.refFromURL(url).delete().catch(() => {}); } catch (e) {}
        saveAppData();
        openSpotDetailView(p, true);
    });
}

function showCustomConfirm(message, onConfirm) {
  const existing = document.getElementById('custom-confirm-modal');
  if (existing) existing.remove();

  const modalHTML = `
    <div id="custom-confirm-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-100">
        <div class="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 text-xl">
          🗑️
        </div>
        <h3 class="text-lg font-bold text-[#253149] mb-1">Delete Photo</h3>
        <p class="text-gray-600 text-sm mb-6">${message}</p>
        <div class="flex space-x-3">
          <button id="confirm-cancel" class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors">
            Cancel
          </button>
          <button id="confirm-ok" class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#6253B0] hover:bg-[#52439c] rounded-2xl transition-colors shadow-md">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('confirm-cancel').onclick = () => {
    document.getElementById('custom-confirm-modal').remove();
  };
  
  document.getElementById('confirm-ok').onclick = () => {
    document.getElementById('custom-confirm-modal').remove();
    onConfirm();
  };
}
function triggerSpotPhotoUpload(placeId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
  input.onchange = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 12);
    const place = (getActiveTrip().places || []).find(p => p.id === placeId);
    if (!files.length || !place) return;
    const st = document.getElementById('spot-upload-status'), added = [];
    for (let n = 0; n < files.length; n++) {
      if (st) { st.classList.remove('hidden'); st.textContent = `Processing photo ${n + 1} of ${files.length}...`; }
      
      const data = await new Promise(res => scaleImage(files[n], 800, res));   // shrunk, then kept as its own cloud document
      if (data) { const pid = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); savePhotoDoc(pid, data); added.push('photo:' + pid); }
    }
    place.gallery = [...added, ...(place.gallery || [])];
    saveAppData(); openSpotDetailView(place, true); renderSummaryPage();
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
  
  const cities = tripCities(trip), info = currentCityInfo(trip), city = info.city;
  const q = (document.getElementById('masterSearchInput')?.value || '').trim().toLowerCase();
  renderCityChips(cities, city);

  // only the city you are in; hide accidental duplicates (same name in same city)
  const seen = new Set();
  const pool = (trip.places || []).filter(p => placeCity(p).toLowerCase() === city.toLowerCase()).filter(p => {
    const k = (p.name || '').trim().toLowerCase();
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  const note = document.getElementById('spots-city-note');
  if (note) note.innerHTML = city ? `Showing <b>${escapeHtml(city)}</b>${info.src ? ' (from ' + info.src + ')' : ''}${userLoc.live ? ' • nearest first' : ''}` : 'No spots yet. Tap + to add your first one and choose its city.';

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
    container.innerHTML = `<p class="text-xs text-stone-400 text-center py-8 col-span-full">No spots found${city ? ' in ' + escapeHtml(city) : ''}. Tap <b>+</b> to add a spot in a new or existing city!</p>`; 
    return; 
  }
  
  list.forEach(p => {
    const d = dist(p), img = p.gallery && p.gallery[0] ? imgUrl(p.gallery[0], '') : null;
    const hasSt = p.station && p.station !== 'N/A' && p.station !== 'No station nearby';
    const card = document.createElement('div');
    card.className = 'lily-card p-2.5 flex gap-3 items-center cursor-pointer bg-white';
    card.onclick = () => openSpotDetailView(p);
    card.innerHTML = `
      <div class="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl" style="background: linear-gradient(160deg,#E3E2B0,#C4BA65);">${img ? `<img src="${img}" class="w-full h-full object-cover">` : (SPOT_EMOJI[p.category] || '📍')}</div>
      <div class="min-w-0 flex-1 space-y-0.5">
        <p class="text-[10px] font-extrabold uppercase tracking-wide" style="color: var(--muted-teal);">${escapeHtml(p.category || 'Spot')} • ${escapeHtml(p.city || city)}</p>
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
  const d = [getActiveTrip(), ...(appData.trips || [])].map(t => t && t.checklists && t.checklists.packing.find(i => i.id === id)).find(Boolean);
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
  if (sub) sub.innerText = `${trip.name} • ${total} days • times are local (${tzShort(tzOf(trip))}, ${tzDiffLabel(tzOf(trip))})`;

  strip.innerHTML = "";
  for (let d = 1; d <= total; d++) {
    const p = dayParts(trip, d), on = d === activeItineraryDay;
    const b = document.createElement('button');
    b.className = `flex-shrink-0 w-14 py-2 rounded-2xl text-center transition-all ${on ? 'text-white shadow-md' : 'bg-white text-stone-500 border border-stone-200'}`;
    if (on) b.style.backgroundColor = 'var(--midnight-blue)';
    b.innerHTML = `<span class="block text-[10px] font-semibold">${p.wd}</span><span class="block text-lg font-extrabold leading-tight">${p.dd}</span><span class="block text-[9px] opacity-70">Day ${d}</span>${(() => { const w = weatherFor(trip, d); return w ? `<span class="block text-[10px] mt-0.5">${wxIcon(w.code)}${w.max}°</span>` : ''; })()}`;
    if (d === tripTodayIndex(trip)) b.style.boxShadow = '0 0 0 2px var(--carnival-red)';
    const pst = dayStats(trip, d);
    b.insertAdjacentHTML('beforeend', `<span class="block h-1 rounded-full mt-1 mx-2" style="background:${PACE[pst.pace].c}; box-shadow: 0 0 0 1px rgba(255,255,255,.55);"></span>`);
    b.onclick = () => { activeItineraryDay = d; renderItinerary(); };
    strip.appendChild(b);
  }

  const acts = trip.itinerary.map((a, i) => ({ a, i })).filter(x => x.a.day === activeItineraryDay)
    .sort((x, y) => (x.a.time || '99').localeCompare(y.a.time || '99'));
  const pts = acts.map(({ a }) => { const c = resolveCoord(trip, a); return c ? { lat: c.lat, lng: c.lng, label: a.title, kind: 'stop' } : null; }).filter(Boolean);
  renderMiniMap('itin-map', pts, { route: true, empty: 'Pin activities to a spot or your hotel to see the day on the map' });

  const dayFull = dayParts(trip, activeItineraryDay).full || 'Day ' + activeItineraryDay;
  const cen = pts[0] || tripCenter(trip);
  let sun = null;
  try { if (cen && trip.startDate) sun = sunTimes(cen.lat, cen.lng, tripDayIso(trip, activeItineraryDay), tzOf(trip)); } catch (e) {}
  const st = dayStats(trip, activeItineraryDay), pc = PACE[st.pace];
  const head = `<div class="mb-3 space-y-1.5"><p class="font-bold text-sm" style="color: var(--midnight-blue);">${dayFull}</p>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
      <span class="px-2 py-0.5 rounded-full font-bold" style="background:${pc.c};color:${pc.t};">${pc.l}</span>
      <span>${st.n} activit${st.n === 1 ? 'y' : 'ies'}</span>${st.km ? `<span>≈ ${st.km.toFixed(1)} km</span>` : ''}
      ${sun ? `<span>🌅 ${fmtMin(sun.rise)}</span><span>🌇 ${fmtMin(sun.set)}</span><span>📸 golden hour ${fmtMin(sun.set - 60)}</span>` : ''}</div></div>`;
  if (acts.length === 0) { box.innerHTML = head + `<p class="text-xs text-stone-400 py-6 text-center">Nothing planned yet. Tap + Add Activity.</p>`; return; }
  const conn = idx => {
    const cur = acts[idx], nxt = acts[idx + 1];
    if (!nxt) return '';
    const c1 = resolveCoord(trip, cur.a), c2 = resolveCoord(trip, nxt.a);
    if (!c1 || !c2) return '';
    const km = calculateDistanceInKm(c1.lat, c1.lng, c2.lat, c2.lng), mins = travelMins(km), walk = km <= 1.2;
    const g1 = timeToMin(cur.a.time), g2 = timeToMin(nxt.a.time), tight = g1 !== null && g2 !== null && (g2 - g1) < mins + 30;
    return `<div class="flex gap-2"><div class="w-12 flex-shrink-0"></div><div class="ms-1.5 pl-5 pb-3 border-l-2 border-dashed" style="border-color: rgba(138,140,65,.4);"><span class="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full" style="${tight ? 'background:#fdecec;color:var(--carnival-red);' : 'background:var(--beige);color:var(--muted-teal);'}"><i class="fa-solid ${walk ? 'fa-person-walking' : 'fa-car-side'}"></i>≈ ${mins} min ${walk ? 'walk' : 'by car'} • ${km.toFixed(1)} km${tight ? ' • ⚠ tight: starts only ' + (g2 - g1) + ' min apart' : ''}</span></div></div>`;
  };
  box.innerHTML = head + acts.map(({ a, i }, idx) => {
    const doc = a.docId && trip.checklists.packing.find(x => x.id === a.docId);
    const am = timeToMin(a.time), cc = resolveCoord(trip, a);
    const dark = sun && cc && cc.category === 'Attraction' && am !== null && (am >= sun.set - 15 || am < sun.rise)
      ? `<p class="text-[11px] font-semibold" style="color: var(--carnival-red);">${am < sun.rise ? '☀️ Sunrise is at ' + fmtMin(sun.rise) : '🌙 Sunset is at ' + fmtMin(sun.set) + '. This will be after dark.'}</p>` : '';
    return `
    <div class="flex gap-2">
      <div class="w-12 text-right text-[11px] font-bold text-stone-400 pt-3.5 flex-shrink-0">${a.time || '—'}</div>
      <div class="relative pl-5 pb-4 flex-1 min-w-0 border-l-2 border-dashed ms-1.5" style="border-color: rgba(138,140,65,.4);">
        <button onclick="toggleActivityDone(${i})" aria-label="Mark as done" class="absolute -left-[9px] top-3.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white" style="border-color: var(--muted-teal); background: ${a.done ? 'var(--muted-teal)' : '#fff'};">${a.done ? '✓' : ''}</button>
        <div class="lily-card p-3.5 bg-white space-y-1.5">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <p class="font-bold text-sm ${a.done ? 'line-through text-stone-400' : 'text-stone-800'}">${escapeHtml(a.title)}</p>
              ${a.location ? `<p class="text-[11px] text-stone-500 mt-0.5"><i class="fa-solid fa-location-dot me-1 text-rose-600"></i>${escapeHtml(a.location)}</p>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick="openDriverForActivity('${trip.id}', ${i})" aria-label="Show to driver" class="text-stone-300 hover:text-stone-600"><i class="fa-solid fa-taxi text-[11px]"></i></button>
              <button onclick="toggleStarItineraryActivity(${i})">${a.starred ? '<span class="text-amber-500">★</span>' : '<span class="text-stone-300">☆</span>'}</button>
              <button onclick="openEditItineraryModal(${i})" class="text-stone-300 hover:text-stone-600"><i class="fa-solid fa-pen text-[10px]"></i></button>
              <button onclick="deleteItineraryActivity(${i})" class="text-stone-300 hover:text-red-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
          </div>
          ${dark}
          ${a.notes ? `<p class="text-[11px] text-stone-400">${escapeHtml(a.notes)}</p>` : ''}
          ${doc ? `<button onclick="openDocById('${doc.id}')" class="w-full flex items-center gap-2 rounded-xl p-2 text-left" style="background: var(--beige);">
            ${docPhoto(doc) ? `<img src="${docPhoto(doc)}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0">` : '<i class="fa-solid fa-ticket text-stone-500 px-2"></i>'}
            <span class="text-[11px] font-semibold flex-1 truncate" style="color: var(--midnight-blue);">${escapeHtml(doc.text)}</span>
            <span class="text-[10px] font-bold" style="color: var(--muted-teal);">View</span></button>` : ''}
        </div>
      </div>
    </div>${conn(idx)}`;
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
      if (String(data).startsWith('http')) trip.checklists.packing.push({ id: docId, text: v('title') + ' (ticket)', category: 'documents', done: false, important: false, shared: true, fileData: data });
      else { savePhotoDoc(docId, data); trip.checklists.packing.push({ id: docId, text: v('title') + ' (ticket)', category: 'documents', done: false, important: false, shared: true, photoRef: docId }); }
    }
    const act = { day: activeItineraryDay, title: v('title'), time: v('time'), location: v('location'), notes: v('notes'),
      starred: false, placeId: (document.getElementById('itin-form-place').value || null), docId };
    if (editingItineraryIndex !== null && trip.itinerary[editingItineraryIndex]) {
      act.starred = trip.itinerary[editingItineraryIndex].starred || false;
      act.done = trip.itinerary[editingItineraryIndex].done || false;
      trip.itinerary[editingItineraryIndex] = act;
    } else trip.itinerary.push(act);
    saveAppData(); closeModal('modal-itinerary'); renderItinerary(); renderSummaryPage();
  };
  if (file) uploadImageToFirebase(file, 'tickets').then(url => { if (url) finish(url); else scaleImage(file, 1100, finish); }); else finish(null);
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
      if (photo && String(photo).startsWith('http')) { if (it.photoRef) { deletePhotoDoc(it.photoRef); delete it.photoRef; } it.fileData = photo; }
      else if (photo) { savePhotoDoc(it.id, photo); it.photoRef = it.id; delete it.fileData; }
    } else {
      if (it.photoRef) { deletePhotoDoc(it.photoRef); delete it.photoRef; }
      it.fileData = photo || null;
    }
    it.shared = shared;
    saveAppData(); closeModal('modal-packing'); selectPackingCategory(category); renderSummaryPage();
  };
  
  if (category === 'documents' && file) {
    if (shared) {   // only shared photos go to the cloud; private ones never leave this phone
      uploadImageToFirebase(file, "documents").then(url => { if (url) finish(url); else scaleImage(file, 1100, finish); });
    } else scaleImage(file, 1100, finish);
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
  appData.deletedTrips = { ...(appData.deletedTrips || {}), [id]: Date.now() };   // so an older copy can't bring it back
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
    setTripTzField(tripTz(trip));
  } else {
    document.getElementById('modal-trip-title').innerText = "Add New Trip";
    document.getElementById('trip-form-id').value = '';
    document.getElementById('trip-form-title').value = '';
    document.getElementById('trip-form-start-date').value = '';
    document.getElementById('trip-form-end-date').value = '';
    document.getElementById('trip-form-people').value = '';
    document.getElementById('trip-form-budget').value = '';
    setTripCurrencyField('MYR');
    setTripTzField('Asia/Jakarta');
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
      if (!pendingCover) scaleImage(f, 640, d => { pendingCover = d; saveTripFormCore(); });
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
      trip.tz = document.getElementById('trip-form-tz').value || 'Asia/Jakarta';
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
      tz: document.getElementById('trip-form-tz').value || 'Asia/Jakarta',
      activeHotel: "",
      hotelCity: "",
      hotelStation: "",
      places: seedPlacesFor(title),
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
  set('id', p.id || ''); set('name', p.name || ''); set('city', p.city || currentCity(getActiveTrip()) || '');
  const dl = document.getElementById('spot-city-list'); if (dl) dl.innerHTML = tripCities(getActiveTrip()).map(c => `<option value="${escapeHtml(c)}">`).join(''); set('category', p.category || 'Attraction');
  set('station', p.station || ''); set('walk', p.walk || ''); set('lat', p.lat || ''); set('lng', p.lng || '');
}
function openMasterSpotModal(newCity) {
  editingPlaceId = null; fillSpotForm({});
  if (newCity === true) document.getElementById('spot-form-city').value = '';
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

function parseCoordsText(t) {
  t = String(t || '').trim();
  if (!t) return null;
  const m = t.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    || t.match(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i) || t.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function getSpotCoords() {
  const a = document.getElementById('spot-form-lat').value.trim(), b = document.getElementById('spot-form-lng').value.trim();
  if (a && !b) { const p = parseCoordsText(a); if (p) return p; }
  const lat = parseFloat(a), lng = parseFloat(b);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}
function geoMsg(t) { const m = document.getElementById('spot-geo-msg'); if (m) m.textContent = t || ''; }
function setSpotCoords(lat, lng) { document.getElementById('spot-form-lat').value = (+lat).toFixed(6); document.getElementById('spot-form-lng').value = (+lng).toFixed(6); }
function normalizeSpotCoords() {
  const a = document.getElementById('spot-form-lat').value.trim();
  if (!a || document.getElementById('spot-form-lng').value.trim()) return;
  const p = parseCoordsText(a);
  if (p) { setSpotCoords(p.lat, p.lng); geoMsg('Coordinates read from what you pasted ✓'); }
  else if (/^https?:/i.test(a)) geoMsg(/goo\.gl|maps\.app/i.test(a) ? "Short links don't contain the position. Open the link in Maps, then copy the long address or the numbers." : "Couldn't find coordinates in that link. Try the long Google Maps link, or paste the numbers.");
}
async function geoSearch(q) {
  const out = []; let err = '';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    (await r.json()).forEach(x => out.push({ name: x.name || String(x.display_name).split(',')[0], sub: x.display_name, lat: +x.lat, lng: +x.lon }));
  } catch (e) { err = 'OpenStreetMap: ' + e.message; }
  if (!out.length) {
    try {
      const r = await fetch(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ((await r.json()).features || []).forEach(f => { const p = f.properties || {}; out.push({ name: p.name || q, sub: [p.street, p.city || p.county, p.state, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }); });
    } catch (e) { err += (err ? ' | ' : '') + 'Photon: ' + e.message; }
  }
  return { out, err };
}
function findSpotCoords() {
  const name = document.getElementById('spot-form-name').value.trim(), city = (document.getElementById('spot-form-city').value || '').trim();
  const box = document.getElementById('spot-geo-results');
  if (box) box.innerHTML = '';
  if (!name) return geoMsg('Type the spot name first.');
  geoMsg('Searching…');
  return (async () => {
    let r = await geoSearch(city ? `${name}, ${city}` : name);
    if (!r.out.length && city) r = await geoSearch(name);
    if (!r.out.length) return geoMsg(r.err ? `Couldn't reach the map search (${r.err}). You can paste a Google Maps link into Latitude, or tap "I'm here now".` : 'No match. Try a shorter name, or paste a Google Maps link into Latitude.');
    geoMsg('Tap the right place:');
    r.out.forEach(x => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'w-full text-left rounded-xl p-2.5 bg-stone-50 border border-stone-200';
      const t = document.createElement('span'); t.className = 'block text-xs font-bold text-stone-800'; t.textContent = x.name;
      const s = document.createElement('span'); s.className = 'block text-[10px] text-stone-500 truncate'; s.textContent = x.sub;
      b.append(t, s);
      b.onclick = () => { setSpotCoords(x.lat, x.lng); geoMsg('Coordinates filled ✓'); box.innerHTML = ''; };
      box.appendChild(b);
    });
  })();
}
function useHereForSpot() {
  if (!navigator.geolocation) return geoMsg("This device can't share its location.");
  geoMsg('Getting your position…');
  navigator.geolocation.getCurrentPosition(p => { setSpotCoords(p.coords.latitude, p.coords.longitude); geoMsg("Filled with where you are right now ✓"); }, () => geoMsg('Location is off. Allow it in your browser, then try again.'), { enableHighAccuracy: true, timeout: 12000 });
}
function setSelectValue(id, v) { const s = document.getElementById(id); if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } }
function fillFromAirportCode() {
  const a = typeof findAirport === 'function' ? findAirport(document.getElementById('spot-form-code').value) : null;
  if (!a) return geoMsg('No airport with that code in my list. Try CGK, KUL, SIN, HND… or use Find coordinates.');
  document.getElementById('spot-form-name').value = `${a.name} (${a.code})`;
  document.getElementById('spot-form-city').value = a.city;
  setSelectValue('spot-form-category', 'Airport');
  setSpotCoords(a.lat, a.lng);
  geoMsg(`Filled in ${a.code} ✓ Save to add it to Spots.`);
}
document.addEventListener('change', e => { if (e.target && e.target.id === 'spot-form-lat') normalizeSpotCoords(); });


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
  const name = f('name'), c = getSpotCoords();
  let city = f('city');
  if (!name) return alert("Enter spot name!");
  if (!city) return alert("Enter the city (for example Bandung or Tokyo).");
  const trip = getActiveTrip();
  city = tripCities(trip).find(x => x.toLowerCase() === city.toLowerCase()) || city;
  const station = f('station') || (c ? ((stationsNear(c.lat, c.lng, city.toLowerCase())[0] || {}).name || 'No station nearby') : 'Near Hotel Area');
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  if (editingPlaceId) {
    const p = trip.places.find(x => x.id === editingPlaceId);
    if (p) Object.assign(p, { name, city, category: f('category'), station, walk: f('walk'), map, ...(c || {}) });
  } else {
    trip.places.push({ id: "p_" + Date.now(), name, city, category: f('category'), station, walk: f('walk'), map, starred: false, gallery: [], lat: c ? c.lat : null, lng: c ? c.lng : null });
  }
  try { localStorage.setItem('lily_spots_city_' + trip.id, JSON.stringify({ c: city, t: Date.now() })); } catch (e) {}
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


// ---- Instant launch: draw the "next 30 minutes" card from the saved copy before the cloud answers ----
try { loadCachedAppData(); } catch (e) {}
setInterval(() => { if (!document.hidden) renderNowCard(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNowCard(); });
try { navigator.permissions && navigator.permissions.query({ name: 'geolocation' }).then(r => { if (r.state === 'granted') ensureLocation(); }).catch(() => {}); } catch (e) {}


// ================= SHARE THE PLAN AS TEXT =================
function buildPlanText(trip, scope, links) {
  const total = getTotalTripDays(trip), L = [], doneMark = a => a.done ? ' ✓' : '';
  L.push(`🪷 ${trip.name}`);
  const range = `${trip.startDate || ''}${trip.endDate ? ' – ' + trip.endDate : ''}`.trim();
  if (range) L.push(`📅 ${range}${trip.people ? ' • ' + trip.people : ''}`);
  if (trip.activeHotel) L.push(`🏨 ${trip.activeHotel}`);
  const days = scope === 'all' ? Array.from({ length: total }, (_, i) => i + 1) : [Number(scope)];
  days.forEach(d => {
    const acts = (trip.itinerary || []).filter(a => a.day === d).sort((x, y) => (x.time || '99').localeCompare(y.time || '99'));
    const full = trip.startDate ? dayParts(trip, d).full : '';
    L.push('', `*Day ${d}${full ? ' • ' + full : ''}*`);
    if (!acts.length) L.push('Free day');
    acts.forEach(a => {
      let line = `${a.time || '--:--'}  ${a.title}`;
      if (a.location && a.location !== a.title) line += ` — ${a.location}`;
      L.push(line + doneMark(a));
      if (a.notes) L.push(`   📝 ${a.notes}`);
      const doc = a.docId && (trip.checklists?.packing || []).find(x => x.id === a.docId);
      if (doc) L.push(`   🎫 ${doc.text}`);
      const c = links ? resolveCoord(trip, a) : null;
      if (c) L.push(`   📍 https://maps.google.com/?q=${c.lat},${c.lng}`);
    });
  });
  L.push('', 'Made with Waddl 🪷');
  return L.join('\n');
}
function openSharePlan() {
  const trip = getActiveTrip(), sel = document.getElementById('plan-scope'), total = getTotalTripDays(trip);
  sel.innerHTML = '<option value="all">Whole trip</option>' + Array.from({ length: total }, (_, i) => `<option value="${i + 1}">Day ${i + 1}${trip.startDate ? ' • ' + dayParts(trip, i + 1).full : ''}</option>`).join('');
  sel.value = String(activeItineraryDay || 'all') === 'all' ? 'all' : String(activeItineraryDay);
  if (!sel.value) sel.value = 'all';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('plan-links').checked = true;
  document.getElementById('plan-status').textContent = '';
  refreshPlanText();
  openModal('modal-share-plan');
}
function refreshPlanText() {
  document.getElementById('plan-text').value = buildPlanText(getActiveTrip(), document.getElementById('plan-scope').value, document.getElementById('plan-links').checked);
}
function planStatus(t) { document.getElementById('plan-status').textContent = t; }
async function copyPlanText() {
  const text = document.getElementById('plan-text').value;
  try { await navigator.clipboard.writeText(text); planStatus('Copied ✓ Paste it into any chat.'); }
  catch (e) { const ta = document.getElementById('plan-text'); ta.select(); try { document.execCommand('copy'); planStatus('Copied ✓ Paste it into any chat.'); } catch (e2) { planStatus('Press and hold the text to copy it.'); } }
}
async function sharePlanText() {
  const text = document.getElementById('plan-text').value, t = getActiveTrip();
  if (navigator.share) { try { await navigator.share({ title: t.name, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyPlanText();
}
function whatsappPlan() { window.open('https://wa.me/?text=' + encodeURIComponent(document.getElementById('plan-text').value), '_blank', 'noopener'); }

// ================= QUICK PRICE CONVERTER =================
const LOCAL_CUR = { 'Asia/Jakarta': 'IDR', 'Asia/Makassar': 'IDR', 'Asia/Jayapura': 'IDR', 'Asia/Pontianak': 'IDR', 'Asia/Kuala_Lumpur': 'MYR', 'Asia/Singapore': 'SGD', 'Asia/Bangkok': 'THB', 'Asia/Tokyo': 'JPY', 'Asia/Seoul': 'KRW', 'Asia/Hong_Kong': 'HKD', 'Australia/Sydney': 'AUD', 'Europe/London': 'GBP', 'Europe/Paris': 'EUR', 'America/New_York': 'USD', 'America/Los_Angeles': 'USD' };
let _convTrip = null, _convSeq = 0, _convTimer = null;
function parseAmount(t) {
  const m = String(t || '').trim().toLowerCase().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(k|rb|ribu|jt|juta|m)?$/);   // 45k, 45rb, 1.5jt all work
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (['k', 'rb', 'ribu'].includes(m[2])) n *= 1e3; else if (['jt', 'juta', 'm'].includes(m[2])) n *= 1e6;
  return n;
}
async function getRate(from, to) {
  if (from === to) return { rate: 1, date: '', live: true };
  const key = from + '>' + to; let cache = {};
  try { cache = JSON.parse(localStorage.getItem('lily_rates') || '{}'); } catch (e) {}
  if (!(cache[key] && Date.now() - cache[key].t < 6 * 3600e3)) {
    try {
      const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.rates && j.rates[to]) { cache[key] = { rate: j.rates[to], date: j.date, t: Date.now() }; try { localStorage.setItem('lily_rates', JSON.stringify(cache)); } catch (e) {} }
    } catch (e) {}
  }
  let c = cache[key];
  if (!c && cache[to + '>' + from]) { const rv = cache[to + '>' + from]; c = { rate: 1 / rv.rate, date: rv.date, t: rv.t }; }   // swapped direction works offline too
  return c ? { rate: c.rate, date: c.date, live: Date.now() - c.t < 6 * 3600e3 } : null;
}
function initConverter(trip) {
  const from = document.getElementById('conv-from'), to = document.getElementById('conv-to');
  if (!from || !to || !trip) return;
  if (!from.options.length) {
    const opts = Object.keys(CURRENCIES).map(c => `<option value="${c}">${c} (${CURRENCIES[c]})</option>`).join('');
    from.innerHTML = opts; to.innerHTML = opts;
  }
  if (_convTrip === trip.id) return;
  _convTrip = trip.id;
  const home = tripCur(trip); let local = LOCAL_CUR[tzOf(trip)] || 'USD';
  if (local === home) local = home === 'USD' ? 'EUR' : 'USD';
  setSelectValue('conv-from', local); setSelectValue('conv-to', home);
  runConverter();
}
function runConverter() { clearTimeout(_convTimer); _convTimer = setTimeout(convertNow, 200); }
async function convertNow() {
  const seq = ++_convSeq, out = document.getElementById('conv-result'), note = document.getElementById('conv-note');
  if (!out) return;
  const amt = parseAmount(document.getElementById('conv-amount').value), from = document.getElementById('conv-from').value, to = document.getElementById('conv-to').value;
  if (amt === null) { out.textContent = '—'; note.textContent = document.getElementById('conv-amount').value.trim() ? 'Type a number, like 45000 or 45k.' : 'Type a price to convert it.'; return; }
  const r = await getRate(from, to);
  if (seq !== _convSeq) return;
  if (!r) { out.textContent = '—'; note.textContent = 'No rate saved yet. Connect to the internet once to load it.'; return; }
  out.textContent = `${fmtMoney(amt, from)} = ${fmtMoney(amt * r.rate, to)}`;
  note.textContent = from === to ? 'Same currency.' : `1 ${from} = ${+r.rate.toPrecision(5)} ${to} • ${r.live ? 'today’s rate' : 'saved rate' + (r.date ? ' from ' + r.date : '') + ' (offline)'}`;
}
function swapConverter() {
  const f = document.getElementById('conv-from').value, t = document.getElementById('conv-to').value;
  setSelectValue('conv-from', t); setSelectValue('conv-to', f); runConverter();
}
function convToExpense() {
  const amt = parseAmount(document.getElementById('conv-amount').value), from = document.getElementById('conv-from').value;
  openExpenseModal();
  if (amt !== null) {
    document.getElementById('exp-form-amount').value = String(amt);
    if (from !== document.getElementById('exp-form-currency').value) setSelectValue('exp-form-currency', from);
    updateRatePreview();
  }
}
