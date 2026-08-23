/**
 * SMART ABSENSI GURU — REVERSE GEOCODING SERVICE
 * Free & Open-Source GPS to Physical Address Translation
 * Providers: BigDataCloud Client Reverse Geocode & OpenStreetMap Nominatim
 */

import { useState, useEffect } from 'react';
import { logger } from '../utils/logger.utils';

export interface GeocodedAddress {
  fullAddress: string;
  shortAddress: string;
  road?: string;
  subdistrict?: string; // Kelurahan / Desa
  district?: string; // Kecamatan
  city?: string; // Kota / Kabupaten
  province?: string; // Provinsi
  country?: string;
  postalCode?: string;
  source: 'BIGDATACLOUD' | 'NOMINATIM' | 'CACHE' | 'FALLBACK';
}

const CACHE_PREFIX = 'smart_absensi_geocache_';
const MEMORY_CACHE = new Map<string, GeocodedAddress>();

/**
 * Normalizes latitude and longitude to 4 decimal places (~11 meters precision)
 * to maximize cache hits while maintaining neighborhood accuracy.
 */
export function getGeocodingCacheKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}`;
}

export class ReverseGeocodingService {
  /**
   * Fetches human-readable address for given GPS coordinates.
   * Checks in-memory cache, then localStorage cache, then BigDataCloud, then OSM Nominatim.
   */
  public static async getAddress(lat: number, lng: number): Promise<GeocodedAddress> {
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return this.createFallback(lat, lng, 'Koordinat tidak valid');
    }

    const key = getGeocodingCacheKey(lat, lng);

    // 1. Check in-memory cache
    if (MEMORY_CACHE.has(key)) {
      return MEMORY_CACHE.get(key)!;
    }

    // 2. Check localStorage cache
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(CACHE_PREFIX + key);
        if (stored) {
          const parsed = JSON.parse(stored) as GeocodedAddress;
          parsed.source = 'CACHE';
          MEMORY_CACHE.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage read errors
    }

    // 3. Try BigDataCloud Free Client Reverse Geocoding (Primary - fast & tailored for client apps)
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`;
      const response = await fetch(bdcUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const result = this.parseBigDataCloudResponse(data, lat, lng);
        this.saveToCache(key, result);
        return result;
      }
    } catch (err) {
      logger.warn('ReverseGeocodingService', 'BigDataCloud query failed, trying Nominatim fallback:', err);
    }

    // 4. Fallback to OpenStreetMap Nominatim API
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const response = await fetch(osmUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Smart-Absensi-Guru/1.0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const result = this.parseNominatimResponse(data, lat, lng);
        this.saveToCache(key, result);
        return result;
      }
    } catch (err) {
      logger.warn('ReverseGeocodingService', 'Nominatim query failed:', err);
    }

    // 5. If all fail, return formatted coordinate string
    const fallback = this.createFallback(lat, lng);
    this.saveToCache(key, fallback);
    return fallback;
  }

  /**
   * Parse BigDataCloud JSON payload into standardized GeocodedAddress
   */
  public static parseBigDataCloudResponse(data: any, lat: number, lng: number): GeocodedAddress {
    const locality = data.locality || data.localityInfo?.administrative?.[3]?.name || '';
    const city = data.city || data.localityInfo?.administrative?.[2]?.name || '';
    const province = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || '';
    const country = data.countryName || 'Indonesia';
    const postcode = data.postcode || '';

    // Extract road / street from informative or administrative details if present
    const streetItem = data.localityInfo?.informative?.find((i: any) => i.description === 'road' || i.order === 8);
    const road = streetItem?.name || '';

    const parts: string[] = [];
    if (road) parts.push(road);
    if (locality && locality !== city) parts.push(locality);
    if (city) parts.push(city);
    if (province && province !== city) parts.push(province);

    const fullAddress = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const shortAddress = road || locality || city || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    return {
      fullAddress,
      shortAddress,
      road: road || undefined,
      subdistrict: locality || undefined,
      city: city || undefined,
      province: province || undefined,
      country,
      postalCode: postcode || undefined,
      source: 'BIGDATACLOUD',
    };
  }

  /**
   * Parse OpenStreetMap Nominatim JSON payload into standardized GeocodedAddress
   */
  public static parseNominatimResponse(data: any, lat: number, lng: number): GeocodedAddress {
    const addr = data.address || {};
    const road = addr.road || addr.street || addr.building || addr.amenity || '';
    const subdistrict = addr.village || addr.suburb || addr.neighbourhood || '';
    const district = addr.city_district || addr.municipality || '';
    const city = addr.city || addr.town || addr.county || addr.state_district || '';
    const province = addr.state || '';
    const country = addr.country || 'Indonesia';
    const postalCode = addr.postcode || '';

    const parts: string[] = [];
    if (road) parts.push(road);
    if (subdistrict) parts.push(subdistrict);
    if (district && district !== subdistrict) parts.push(district);
    if (city && city !== district) parts.push(city);
    if (province && province !== city) parts.push(province);

    const fullAddress = parts.length > 0 ? parts.join(', ') : data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const shortAddress = road || subdistrict || city || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    return {
      fullAddress,
      shortAddress,
      road: road || undefined,
      subdistrict: subdistrict || undefined,
      district: district || undefined,
      city: city || undefined,
      province: province || undefined,
      country,
      postalCode: postalCode || undefined,
      source: 'NOMINATIM',
    };
  }

  public static createFallback(lat: number, lng: number, customMessage?: string): GeocodedAddress {
    const coordStr = `${lat ? lat.toFixed(5) : '0'}, ${lng ? lng.toFixed(5) : '0'}`;
    return {
      fullAddress: customMessage ? `${customMessage} (${coordStr})` : `Area Koordinat: ${coordStr}`,
      shortAddress: `GPS: ${coordStr}`,
      source: 'FALLBACK',
    };
  }

  public static saveToCache(key: string, data: GeocodedAddress) {
    MEMORY_CACHE.set(key, data);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
      }
    } catch {
      // Storage quota exceeded or unavailable, memory cache will suffice
    }
  }

  /**
   * Clears the geocoding cache (useful for dev/test)
   */
  public static clearCache() {
    MEMORY_CACHE.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {}
  }
}

/**
 * Custom React Hook for seamless asynchronous reverse geocoding
 */
export function useReverseGeocode(lat?: number | null, lng?: number | null) {
  const [addressData, setAddressData] = useState<GeocodedAddress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      setAddressData(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    ReverseGeocodingService.getAddress(lat, lng)
      .then((res) => {
        if (isMounted) {
          setAddressData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Gagal memuat alamat fisik');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng]);

  return {
    address: addressData?.fullAddress || null,
    shortAddress: addressData?.shortAddress || null,
    addressData,
    isLoading,
    error,
  };
}
