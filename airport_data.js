/**
 * LILY POND TRAVEL HUB - AIRPORT_DATA.JS
 * Airports you can add to Spots (type the code in the Add Spot form, e.g. CGK or KUL).
 * Coordinates are approximate (good for maps and distances). seedFor = the city whose trips get it automatically.
 */
const airportDatabase = [
  // Indonesia
  { code: "CGK", name: "Soekarno–Hatta International Airport", city: "Jakarta", country: "Indonesia", lat: -6.1256, lng: 106.6559, tz: "Asia/Jakarta", seedFor: "Jakarta" },
  { code: "HLP", name: "Halim Perdanakusuma Airport", city: "Jakarta", country: "Indonesia", lat: -6.2666, lng: 106.8909, tz: "Asia/Jakarta", seedFor: "Jakarta" },
  { code: "BDO", name: "Husein Sastranegara Airport", city: "Bandung", country: "Indonesia", lat: -6.9006, lng: 107.5763, tz: "Asia/Jakarta", seedFor: "Bandung" },
  { code: "KJT", name: "Kertajati International Airport", city: "Majalengka", country: "Indonesia", lat: -6.6484, lng: 108.1672, tz: "Asia/Jakarta" },
  { code: "YIA", name: "Yogyakarta International Airport", city: "Yogyakarta", country: "Indonesia", lat: -7.9007, lng: 110.0573, tz: "Asia/Jakarta" },
  { code: "SUB", name: "Juanda International Airport", city: "Surabaya", country: "Indonesia", lat: -7.3798, lng: 112.7868, tz: "Asia/Jakarta" },
  { code: "DPS", name: "Ngurah Rai International Airport", city: "Bali", country: "Indonesia", lat: -8.7482, lng: 115.1675, tz: "Asia/Makassar" },
  // Malaysia
  { code: "KUL", name: "Kuala Lumpur International Airport (KLIA)", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lng: 101.7099, tz: "Asia/Kuala_Lumpur" },
  { code: "SZB", name: "Sultan Abdul Aziz Shah Airport (Subang)", city: "Kuala Lumpur", country: "Malaysia", lat: 3.1306, lng: 101.5493, tz: "Asia/Kuala_Lumpur" },
  { code: "PEN", name: "Penang International Airport", city: "Penang", country: "Malaysia", lat: 5.2971, lng: 100.2770, tz: "Asia/Kuala_Lumpur" },
  { code: "LGK", name: "Langkawi International Airport", city: "Langkawi", country: "Malaysia", lat: 6.3297, lng: 99.7287, tz: "Asia/Kuala_Lumpur" },
  { code: "JHB", name: "Senai International Airport", city: "Johor Bahru", country: "Malaysia", lat: 1.6413, lng: 103.6700, tz: "Asia/Kuala_Lumpur" },
  { code: "BKI", name: "Kota Kinabalu International Airport", city: "Kota Kinabalu", country: "Malaysia", lat: 5.9372, lng: 116.0510, tz: "Asia/Kuala_Lumpur" },
  { code: "KCH", name: "Kuching International Airport", city: "Kuching", country: "Malaysia", lat: 1.4847, lng: 110.3470, tz: "Asia/Kuala_Lumpur" },
  // Rest of Asia
  { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", lat: 1.3644, lng: 103.9915, tz: "Asia/Singapore" },
  { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", lat: 13.6900, lng: 100.7501, tz: "Asia/Bangkok" },
  { code: "DMK", name: "Don Mueang International Airport", city: "Bangkok", country: "Thailand", lat: 13.9126, lng: 100.6067, tz: "Asia/Bangkok" },
  { code: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", country: "Vietnam", lat: 10.8188, lng: 106.6520, tz: "Asia/Bangkok" },
  { code: "HAN", name: "Noi Bai International Airport", city: "Hanoi", country: "Vietnam", lat: 21.2212, lng: 105.8072, tz: "Asia/Bangkok" },
  { code: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", country: "Philippines", lat: 14.5086, lng: 121.0194, tz: "Asia/Singapore" },
  { code: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong", lat: 22.3080, lng: 113.9185, tz: "Asia/Hong_Kong" },
  { code: "TPE", name: "Taiwan Taoyuan International Airport", city: "Taipei", country: "Taiwan", lat: 25.0777, lng: 121.2328, tz: "Asia/Singapore" },
  { code: "HND", name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan", lat: 35.5494, lng: 139.7798, tz: "Asia/Tokyo" },
  { code: "NRT", name: "Narita International Airport", city: "Tokyo", country: "Japan", lat: 35.7720, lng: 140.3929, tz: "Asia/Tokyo" },
  { code: "KIX", name: "Kansai International Airport", city: "Osaka", country: "Japan", lat: 34.4347, lng: 135.2440, tz: "Asia/Tokyo" },
  { code: "ICN", name: "Incheon International Airport", city: "Seoul", country: "South Korea", lat: 37.4602, lng: 126.4407, tz: "Asia/Seoul" },
  // Elsewhere
  { code: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia", lat: -33.9399, lng: 151.1753, tz: "Australia/Sydney" },
  { code: "LHR", name: "London Heathrow Airport", city: "London", country: "United Kingdom", lat: 51.4700, lng: -0.4543, tz: "Europe/London" },
  { code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "United Arab Emirates", lat: 25.2532, lng: 55.3657, tz: "Asia/Dubai" }
];

// Find by code (CGK) or by part of the name/city (heathrow, tokyo)
function findAirport(q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return null;
  return airportDatabase.find(a => a.code.toLowerCase() === s)
    || airportDatabase.find(a => (a.name + ' ' + a.city).toLowerCase().includes(s)) || null;
}
