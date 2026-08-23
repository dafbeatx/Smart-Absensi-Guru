import React from 'react';
import { useReverseGeocode } from '../../services/reverse-geocoding.service';

export interface LocationAddressBadgeProps {
  lat?: number | null;
  lng?: number | null;
  distanceMeters?: number | null;
  className?: string;
  shortOnly?: boolean;
}

export const LocationAddressBadge: React.FC<LocationAddressBadgeProps> = ({
  lat,
  lng,
  distanceMeters,
  className = '',
  shortOnly = false,
}) => {
  const { address, shortAddress, isLoading } = useReverseGeocode(lat, lng);

  if (!lat || !lng || (lat === 0 && lng === 0)) {
    return null;
  }

  const displayText = shortOnly ? shortAddress : address;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium ${className}`}
      title={address || `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
    >
      <span className="text-emerald-700 font-bold shrink-0">📍</span>
      {isLoading ? (
        <span className="text-slate-400 italic">Mendeteksi lokasi...</span>
      ) : displayText ? (
        <span className="truncate max-w-[220px]">{displayText}</span>
      ) : (
        <span className="font-mono text-slate-400">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      )}
      {distanceMeters !== undefined && (
        <span className="text-slate-400 shrink-0">({distanceMeters}m)</span>
      )}
    </span>
  );
};
