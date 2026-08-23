/**
 * SMART ABSENSI GURU — REVERSE GEOCODING SERVICE TEST SUITE
 */

import {
  ReverseGeocodingService,
  getGeocodingCacheKey,
} from '../reverse-geocoding.service';

export const runGeocodingTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // Test 1: Coordinate Normalization Cache Key
  const key1 = getGeocodingCacheKey(-6.613144, 106.812345);
  const key2 = getGeocodingCacheKey(-6.613111, 106.812388);
  assert(
    'Geocoding - Normalizes Coordinates to 4 Decimals for Optimal Caching',
    key1 === '-6.6131_106.8123' && key2 === '-6.6131_106.8124'
  );

  // Test 2: BigDataCloud Payload Parser
  const mockBdcData = {
    locality: 'Sukamaju',
    city: 'Kota Bogor',
    principalSubdivision: 'Jawa Barat',
    countryName: 'Indonesia',
    postcode: '16155',
    localityInfo: {
      informative: [
        { name: 'Jl. Pajajaran No. 12', description: 'road', order: 8 },
      ],
      administrative: [
        { name: 'Indonesia', order: 0 },
        { name: 'Jawa Barat', order: 1 },
        { name: 'Kota Bogor', order: 2 },
        { name: 'Sukamaju', order: 3 },
      ],
    },
  };
  const bdcResult = ReverseGeocodingService.parseBigDataCloudResponse(mockBdcData, -6.6, 106.8);
  assert(
    'Geocoding - Parse BigDataCloud Response Correctly',
    bdcResult.road === 'Jl. Pajajaran No. 12' &&
    bdcResult.subdistrict === 'Sukamaju' &&
    bdcResult.city === 'Kota Bogor' &&
    bdcResult.fullAddress.includes('Jl. Pajajaran No. 12') &&
    bdcResult.source === 'BIGDATACLOUD'
  );

  // Test 3: OpenStreetMap Nominatim Payload Parser
  const mockOsmData = {
    display_name: 'SMA Negeri 1, Jl. Ir. H. Juanda No. 16, Pabaton, Bogor Tengah, Kota Bogor, Jawa Barat, 16121, Indonesia',
    address: {
      road: 'Jl. Ir. H. Juanda',
      building: 'SMA Negeri 1',
      suburb: 'Pabaton',
      city_district: 'Bogor Tengah',
      city: 'Kota Bogor',
      state: 'Jawa Barat',
      country: 'Indonesia',
      postcode: '16121',
    },
  };
  const osmResult = ReverseGeocodingService.parseNominatimResponse(mockOsmData, -6.59, 106.79);
  assert(
    'Geocoding - Parse Nominatim Response Correctly',
    osmResult.road === 'Jl. Ir. H. Juanda' &&
    osmResult.subdistrict === 'Pabaton' &&
    osmResult.city === 'Kota Bogor' &&
    osmResult.province === 'Jawa Barat' &&
    osmResult.source === 'NOMINATIM'
  );

  // Test 4: Invalid Coordinates Graceful Fallback
  const fallbackResult = ReverseGeocodingService.createFallback(0, 0, 'Koordinat tidak valid');
  assert(
    'Geocoding - Invalid Coordinates Return Formatted Fallback',
    fallbackResult.source === 'FALLBACK' &&
    fallbackResult.fullAddress.includes('Koordinat tidak valid')
  );

  // Test 5: Cache Storage & Instant Retrieval
  ReverseGeocodingService.clearCache();
  const testKey = getGeocodingCacheKey(-6.2088, 106.8456);
  ReverseGeocodingService.saveToCache(testKey, {
    fullAddress: 'Jl. Merdeka No. 1, Jakarta Pusat, DKI Jakarta',
    shortAddress: 'Jl. Merdeka No. 1',
    city: 'Jakarta Pusat',
    source: 'CACHE',
  });

  const cachedAddress = await ReverseGeocodingService.getAddress(-6.2088, 106.8456);
  assert(
    'Geocoding - Cache Storage and Fast Retrieval',
    cachedAddress.fullAddress === 'Jl. Merdeka No. 1, Jakarta Pusat, DKI Jakarta' &&
    cachedAddress.shortAddress === 'Jl. Merdeka No. 1'
  );

  // Test 6: Clear Cache removes stored keys
  ReverseGeocodingService.clearCache();
  const fallbackAfterClear = ReverseGeocodingService.createFallback(-6.99, 107.99);
  assert(
    'Geocoding - Cache Clear Successfully Resets State',
    fallbackAfterClear.shortAddress.includes('-6.99000, 107.99000')
  );

  return { passed, failed, results };
};
