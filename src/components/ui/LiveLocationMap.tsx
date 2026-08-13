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

  // Custom DivIcon definitions for crisp UI without broken asset links
  const createSchoolIcon = () =>
    L.divIcon({
      className: 'custom-school-icon',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-[#023246] text-white shadow-xl ring-4 ring-white border border-slate-300 transform -translate-x-1/2 -translate-y-1/2">
          <span class="text-xl">🏫</span>
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
          isInside ? 'bg-emerald-500' : 'bg-red-500'
        } text-white shadow-2xl ring-4 ring-white border border-slate-200 transform -translate-x-1/2 -translate-y-1/2 animate-bounce">
          <span class="text-lg">📍</span>
          <span class="absolute -top-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${
              isInside ? 'bg-emerald-400' : 'bg-red-400'
            } opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 ${
              isInside ? 'bg-emerald-600' : 'bg-red-600'
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
        zoomControl: true,
        attributionControl: false,
      });

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
      schoolMarker.bindPopup('<b>🏫 Lokasi Utama Sekolah</b><br/>Pusat Geofence Presensi');
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
        color: isInside ? '#10B981' : '#EF4444',
        fillColor: isInside ? '#10B981' : '#EF4444',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6, 6',
      });
    } else {
      const circle = L.circle([schoolLat, schoolLng], {
        radius: allowedRadius,
        color: isInside ? '#10B981' : '#EF4444',
        fillColor: isInside ? '#10B981' : '#EF4444',
        fillOpacity: 0.15,
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
        userMarker.bindPopup('<b>📍 Lokasi Saya (Real-time)</b>');
        userMarkerRef.current = userMarker;
      }

      if (accuracy && accuracy > 0) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([userLat, userLng]);
          accuracyCircleRef.current.setRadius(accuracy);
        } else {
          const accCircle = L.circle([userLat, userLng], {
            radius: accuracy,
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.1,
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

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-md ${className}`}>
      <div ref={containerRef} style={{ height, width: '100%' }} className="z-0 bg-slate-100" />

      {/* Recenter Quick Action Floating Button */}
      <button
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-white/90 backdrop-blur-md hover:bg-white text-slate-800 text-xs font-bold rounded-xl shadow-lg border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
        title="Pusatkan Peta ke Lokasi Saya"
      >
        <span>🎯</span> Recenter
      </button>

      {/* Legend & Distance Badge */}
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-white/95 backdrop-blur-md text-[11px] font-bold rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-2 text-slate-700">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#023246]"></span> Sekolah
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Anda
        </span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600 font-mono">
          ⭕ {allowedRadius}m
        </span>
        {userLat && userLng && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
            (() => {
              const R = 6371000;
              const dLat = ((userLat - schoolLat) * Math.PI) / 180;
              const dLng = ((userLng - schoolLng) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((schoolLat * Math.PI) / 180) *
                  Math.cos((userLat * Math.PI) / 180) *
                  Math.sin(dLng / 2) *
                  Math.sin(dLng / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const dist = Math.round(R * c);
              return dist <= allowedRadius
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-red-100 text-red-800 border border-red-300';
            })()
          }`}>
            {(() => {
              const R = 6371000;
              const dLat = ((userLat - schoolLat) * Math.PI) / 180;
              const dLng = ((userLng - schoolLng) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((schoolLat * Math.PI) / 180) *
                  Math.cos((userLat * Math.PI) / 180) *
                  Math.sin(dLng / 2) *
                  Math.sin(dLng / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const dist = Math.round(R * c);
              return dist <= allowedRadius ? `🟢 Safe (${dist}m)` : `🔴 Out (${dist}m)`;
            })()}
          </span>
        )}
      </div>
    </div>
  );
};
