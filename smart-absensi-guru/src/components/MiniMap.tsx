import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SchoolGeofence } from '../types';

interface MiniMapProps {
  geofence: SchoolGeofence;
  isInsideRadius: boolean;
  distanceMeter: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({ geofence, isInsideRadius, distanceMeter }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix leaflet marker icon path issue in Vite
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [geofence.lat, geofence.lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      });

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // School Geofence Circle
      L.circle([geofence.lat, geofence.lng], {
        color: '#0D7A5F',
        fillColor: '#0D7A5F',
        fillOpacity: 0.15,
        radius: geofence.radiusMeter,
        weight: 2,
        dashArray: '4, 4'
      }).addTo(map);

      // School Center Marker
      const schoolIcon = L.divIcon({
        className: 'custom-school-pin',
        html: `<div style="background-color: #023246; color: white; width: 28px; height: 28px; rounded-radius: 50%; border-radius: 50%; display: flex; align-items: center; justify-center: center; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); font-size: 14px; font-weight: bold; text-align: center; line-height: 24px;">🏫</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([geofence.lat, geofence.lng], { icon: schoolIcon })
        .addTo(map)
        .bindPopup(`<b>${geofence.name}</b><br>Pusat Geofence (50m)`);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Calculate user pin position based on inside or outside radius
    const userLat = isInsideRadius ? geofence.lat + 0.0001 : geofence.lat + 0.0009;
    const userLng = isInsideRadius ? geofence.lng + 0.0001 : geofence.lng + 0.0008;

    // User Position Marker with pulse
    const userPinClass = isInsideRadius ? 'bg-[#0D7A5F]' : 'bg-rose-500';
    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div style="position: relative; width: 20px; height: 20px;">
          <div style="position: absolute; inset: -4px; border-radius: 50%; background-color: ${isInsideRadius ? '#0D7A5F' : '#f43f5e'}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 20px; height: 20px; border-radius: 50%; background-color: ${isInsideRadius ? '#0D7A5F' : '#f43f5e'}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

    map.setView([geofence.lat, geofence.lng], 18);

    return () => {
      userMarker.remove();
    };
  }, [geofence, isInsideRadius]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-28 w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Geofence Overlay Badge */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-bold text-slate-700 shadow-sm border border-slate-200/80 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isInsideRadius ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        <span>Radius Geofence: {geofence.radiusMeter}m ({distanceMeter}m)</span>
      </div>

      <div className="absolute top-2 right-2 z-10 bg-[#023246]/80 text-white backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-semibold tracking-wider uppercase">
        OpenStreetMap Live
      </div>
    </div>
  );
};
