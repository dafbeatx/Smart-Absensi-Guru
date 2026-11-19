export const DIFFICULTY_CONFIG = {
  mudah: {
    id: 'mudah',
    label: 'Mudah',
    ghostSpeed: 3.1,
    hideDuration: 6.0,
    sightRange: 13.5,
    sightConeDeg: 46,
    desc: 'Hantu lambat • Jeda lemari 6,0 dtk'
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    ghostSpeed: 4.15,
    hideDuration: 5.0,
    sightRange: 16.5,
    sightConeDeg: 52,
    desc: 'Kecepatan sedang • Jeda lemari 5,0 dtk'
  },
  sulit: {
    id: 'sulit',
    label: 'Sulit',
    ghostSpeed: 5.1,
    hideDuration: 3.5,
    sightRange: 20.0,
    sightConeDeg: 58,
    desc: 'Hantu agresif • Jeda lemari 3,5 dtk'
  }
};

// Mansion 36m (x: -18..18) x 32m (z: -16..16) dibagi 9 ruangan (3x3 sel: 12m x 10.67m)
export const MANSION_BOUNDS = {
  minX: -18,
  maxX: 18,
  minZ: -16,
  maxZ: 16,
  wallHeight: 4.2,
  doorWidth: 2.8
};

export const ROOMS = [
  { id: 'nw', name: 'Kamar Tidur Utama', wing: 'Sayap Barat', minX: -18, maxX: -6, minZ: -16, maxZ: -5.33 },
  { id: 'nc', name: 'Lorong Utara & Galeri', wing: 'Area Tengah', minX: -6, maxX: 6, minZ: -16, maxZ: -5.33 },
  { id: 'ne', name: 'Dapur Tua & Gudang', wing: 'Sayap Timur', minX: 6, maxX: 18, minZ: -16, maxZ: -5.33 },

  { id: 'cw', name: 'Ruang Kerja Tua', wing: 'Sayap Barat', minX: -18, maxX: -6, minZ: -5.33, maxZ: 5.33 },
  { id: 'cc', name: 'Lorong Silang Tengah', wing: 'Area Tengah', minX: -6, maxX: 6, minZ: -5.33, maxZ: 5.33 },
  { id: 'ce', name: 'Ruang Makan', wing: 'Sayap Timur', minX: 6, maxX: 18, minZ: -5.33, maxZ: 5.33 },

  { id: 'sw', name: 'Ruang Tamu Barat', wing: 'Sayap Barat', minX: -18, maxX: -6, minZ: 5.33, maxZ: 16 },
  { id: 'sc', name: 'Serambi Utama', wing: 'Area Tengah', minX: -6, maxX: 6, minZ: 5.33, maxZ: 16 },
  { id: 'se', name: 'Ruang Keluarga Timur', wing: 'Sayap Timur', minX: 6, maxX: 18, minZ: 5.33, maxZ: 16 }
];

export function getRoomAt(x, z) {
  for (const r of ROOMS) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      return r;
    }
  }
  return ROOMS[7]; // Serambi Utama fallback
}

// 12 Laci 2x Ketuk (4 per sayap: Barat, Tengah, Timur)
export const DRAWER_SPOTS = [
  // Sayap Barat (index 0..3)
  { id: 'd_nw_1', wing: 'Sayap Barat', room: 'Kamar Tidur Utama', x: -16.2, z: -13.5, rotY: Math.PI / 2 },
  { id: 'd_cw_1', wing: 'Sayap Barat', room: 'Ruang Kerja Tua', x: -16.2, z: -2.5, rotY: Math.PI / 2 },
  { id: 'd_cw_2', wing: 'Sayap Barat', room: 'Ruang Kerja Tua', x: -12.0, z: 4.1, rotY: Math.PI },
  { id: 'd_sw_1', wing: 'Sayap Barat', room: 'Ruang Tamu Barat', x: -16.2, z: 12.2, rotY: Math.PI / 2 },

  // Area Tengah (index 4..7)
  { id: 'd_nc_1', wing: 'Area Tengah', room: 'Lorong Utara & Galeri', x: -4.6, z: -14.2, rotY: 0 },
  { id: 'd_nc_2', wing: 'Area Tengah', room: 'Lorong Utara & Galeri', x: 4.6, z: -14.2, rotY: 0 },
  { id: 'd_cc_1', wing: 'Area Tengah', room: 'Lorong Silang Tengah', x: -4.6, z: -3.8, rotY: Math.PI / 2 },
  { id: 'd_sc_1', wing: 'Area Tengah', room: 'Serambi Utama', x: 4.5, z: 11.5, rotY: -Math.PI / 2 },

  // Sayap Timur (index 8..11)
  { id: 'd_ne_1', wing: 'Sayap Timur', room: 'Dapur Tua & Gudang', x: 16.2, z: -13.0, rotY: -Math.PI / 2 },
  { id: 'd_ce_1', wing: 'Sayap Timur', room: 'Ruang Makan', x: 16.2, z: -1.8, rotY: -Math.PI / 2 },
  { id: 'd_ce_2', wing: 'Sayap Timur', room: 'Ruang Makan', x: 11.5, z: 4.1, rotY: Math.PI },
  { id: 'd_se_1', wing: 'Sayap Timur', room: 'Ruang Keluarga Timur', x: 16.2, z: 12.4, rotY: -Math.PI / 2 }
];

// 9 Lemari Pakaian Berjalusi (1 di setiap ruangan)
export const CLOSET_SPOTS = [
  { id: 'c_nw', room: 'Kamar Tidur Utama', x: -11.5, z: -14.7, rotY: 0 },
  { id: 'c_nc', room: 'Lorong Utara & Galeri', x: 0.0, z: -14.7, rotY: 0 },
  { id: 'c_ne', room: 'Dapur Tua & Gudang', x: 11.5, z: -14.7, rotY: 0 },

  { id: 'c_cw', room: 'Ruang Kerja Tua', x: -16.7, z: 1.8, rotY: Math.PI / 2 },
  { id: 'c_cc', room: 'Lorong Silang Tengah', x: 4.7, z: 2.2, rotY: -Math.PI / 2 },
  { id: 'c_ce', room: 'Ruang Makan', x: 16.7, z: 2.0, rotY: -Math.PI / 2 },

  { id: 'c_sw', room: 'Ruang Tamu Barat', x: -11.5, z: 14.7, rotY: Math.PI },
  { id: 'c_sc', room: 'Serambi Utama', x: -4.7, z: 11.8, rotY: Math.PI / 2 },
  { id: 'c_se', room: 'Ruang Keluarga Timur', x: 11.5, z: 14.7, rotY: Math.PI }
];

// Titik Navigasi Rute Aman (Waypoints pusat setiap ruangan + pintu penghubung)
export const NAV_NODES = [
  { id: 'nw', x: -12, z: -10.5 },
  { id: 'nc', x: 0, z: -10.5 },
  { id: 'ne', x: 12, z: -10.5 },
  { id: 'cw', x: -12, z: 0 },
  { id: 'cc', x: 0, z: 0 },
  { id: 'ce', x: 12, z: 0 },
  { id: 'sw', x: -12, z: 10.5 },
  { id: 'sc', x: 0, z: 10.5 },
  { id: 'se', x: 12, z: 10.5 }
];

export const NAV_EDGES = {
  nw: ['nc', 'cw'],
  nc: ['nw', 'ne', 'cc'],
  ne: ['nc', 'ce'],
  cw: ['nw', 'cc', 'sw'],
  cc: ['nc', 'cw', 'ce', 'sc'],
  ce: ['ne', 'cc', 'se'],
  sw: ['cw', 'sc'],
  sc: ['cc', 'sw', 'se'],
  se: ['ce', 'sc']
};

const BEST_TIME_STORAGE = 'rumah_sunyi_best_times_v2';

export function getBestTimes() {
  try {
    const raw = localStorage.getItem(BEST_TIME_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { mudah: null, normal: null, sulit: null };
}

export function saveBestTime(diffId, seconds) {
  const current = getBestTimes();
  const prev = current[diffId];
  let isNewRecord = false;
  if (prev === null || seconds < prev) {
    current[diffId] = seconds;
    isNewRecord = true;
    try {
      localStorage.setItem(BEST_TIME_STORAGE, JSON.stringify(current));
    } catch (_) {}
  }
  return { isNewRecord, best: current[diffId] };
}

export function formatTime(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return '--:--.--';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
