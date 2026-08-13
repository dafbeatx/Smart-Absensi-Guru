import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LiveLocationMapProps {
  userLat?: number | null;
  userLng?: number | null;
  schoolLat?: number;
  schoolLng?: number;
  allowedRadius?: number;
  accuracy?: number | null;
  interactive?: boolean;
  onSelectLocation?: (coords: { lat: number; lng: number }) => void;
  height?: string;
  className?: string;
}

// Calculate Haversine distance in meters
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  userLat,
  userLng,
  schoolLat = -6.2088,
  schoolLng = 106.8456,
  allowedRadius = 100,
  accuracy,
  interactive = false,
  onSelectLocation,
  height = '280px',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const schoolMarkerRef = useRef<L.Marker | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);

  // Custom DivIcon with SVG icons for ultra-crisp UI
  const createSchoolIcon = () =>
    L.divIcon({
      className: 'custom-school-icon',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-[#023246] text-white shadow-lg ring-4 ring-white border border-[#DDD9D0] transform -translate-x-1/2 -translate-y-1/2">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0H9m4 0V7m0 0h4m-4 0H9" />
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

  const createUserIcon = (isInside: boolean) =>
    L.divIcon({
      className: 'custom-user-icon',
      html: `
        <div class="relative flex items-center justify-center w-9 h-9 rounded-full ${
          isInside ? 'bg-[#287A52]' : 'bg-[#B64040]'
        } text-white shadow-xl ring-4 ring-white border border-[#DDD9D0] transform -translate-x-1/2 -translate-y-1/2">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="absolute -top-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${
              isInside ? 'bg-emerald-400' : 'bg-red-400'
            } opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 ${
              isInside ? 'bg-[#287A52]' : 'bg-[#B64040]'
            }"></span>
          </span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Map if not already initialized
    if (!mapRef.current) {
      const initialLat = userLat || schoolLat;
      const initialLng = userLng || schoolLng;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      // Add Zoom Control at top-right corner to prevent overlapping top-left legend overlay
      L.control.zoom({ position: 'topright' }).addTo(map);

      // OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Attribution
      L.control
        .attribution({ prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors')
        .addTo(map);

      mapRef.current = map;

      // Handle map click if interactive (Admin location picker)
      if (interactive && onSelectLocation) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          onSelectLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
    }

    const map = mapRef.current;

    // Update School Marker & Geofence Circle
    if (schoolMarkerRef.current) {
      schoolMarkerRef.current.setLatLng([schoolLat, schoolLng]);
    } else {
      const schoolMarker = L.marker([schoolLat, schoolLng], { icon: createSchoolIcon() }).addTo(map);
      schoolMarker.bindPopup('<b>🏫 Pintu Utama Sekolah</b><br/>Pusat Geofence Presensi');
      schoolMarkerRef.current = schoolMarker;
    }

    // Check if user is inside radius
    let isInside = true;
    if (userLat && userLng) {
      const dist = map.distance([userLat, userLng], [schoolLat, schoolLng]);
      isInside = dist <= allowedRadius;
    }

    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setLatLng([schoolLat, schoolLng]);
      geofenceCircleRef.current.setRadius(allowedRadius);
      geofenceCircleRef.current.setStyle({
        color: isInside ? '#287A52' : '#B64040',
        fillColor: isInside ? '#287A52' : '#B64040',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 6',
      });
    } else {
      const circle = L.circle([schoolLat, schoolLng], {
        radius: allowedRadius,
        color: isInside ? '#287A52' : '#B64040',
        fillColor: isInside ? '#287A52' : '#B64040',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 6',
      }).addTo(map);
      geofenceCircleRef.current = circle;
    }

    // Update User Marker & Accuracy Circle
    if (userLat && userLng) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLng]);
        userMarkerRef.current.setIcon(createUserIcon(isInside));
      } else {
        const userMarker = L.marker([userLat, userLng], { icon: createUserIcon(isInside) }).addTo(map);
        userMarker.bindPopup('<b>📍 Lokasi Saya (Real-Time)</b>');
        userMarkerRef.current = userMarker;
      }

      if (accuracy && accuracy > 0) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([userLat, userLng]);
          accuracyCircleRef.current.setRadius(accuracy);
        } else {
          const accCircle = L.circle([userLat, userLng], {
            radius: accuracy,
            color: '#2457A6',
            fillColor: '#2457A6',
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(map);
          accuracyCircleRef.current = accCircle;
        }
      }

      // Re-fit bounds to include both user and school
      const bounds = L.latLngBounds([[schoolLat, schoolLng]]);
      bounds.extend([userLat, userLng]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    } else {
      map.setView([schoolLat, schoolLng], 17);
    }

    // Invalidate map size after render to fix Leaflet container sizing
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      // Map cleanup on unmount
    };
  }, [userLat, userLng, schoolLat, schoolLng, allowedRadius, accuracy, interactive, onSelectLocation]);

  const handleRecenter = () => {
    if (mapRef.current) {
      if (userLat && userLng) {
        mapRef.current.setView([userLat, userLng], 18, { animate: true });
      } else {
        mapRef.current.setView([schoolLat, schoolLng], 17, { animate: true });
      }
    }
  };

  const calculatedDistance = userLat && userLng
    ? calculateHaversineDistance(userLat, userLng, schoolLat, schoolLng)
    : null;
  const isInsideSafeZone = calculatedDistance !== null ? calculatedDistance <= allowedRadius : true;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-[#DDD9D0] shadow-xs ${className}`}>
      <div ref={containerRef} style={{ height, width: '100%' }} className="z-0 bg-slate-100" />

      {/* Recenter Quick Action Floating Button */}
      <button
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 text-xs font-bold rounded-xl shadow-sm border border-[#DDD9D0] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
        title="Pusatkan Peta ke Lokasi Saya"
      >
        <svg className="w-4 h-4 text-[#023246]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8 4c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8 8 3.58 8 8z" />
        </svg>
        <span>Recenter</span>
      </button>

      {/* Legend & Distance Header Overlay */}
      <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-85px)] px-3 py-1.5 bg-white/95 backdrop-blur-md text-[11px] font-bold rounded-xl shadow-xs border border-[#DDD9D0] flex flex-wrap items-center gap-2 text-slate-700">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#023246]" /> Sekolah
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#287A52]" /> Anda
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-600 font-mono">
          ⭕ {allowedRadius}m
        </span>
        {calculatedDistance !== null && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
            isInsideSafeZone
              ? 'bg-emerald-50 text-[#287A52] border border-emerald-200'
              : 'bg-red-50 text-[#B64040] border border-red-200'
          }`}>
            {isInsideSafeZone ? `🟢 Safe (${calculatedDistance}m)` : `🔴 Out (${calculatedDistance}m)`}
          </span>
        )}
      </div>
    </div>
  );
};
