/**
 * SMART ABSENSI GURU — CLOUD & SYSTEM HEALTH SUITE
 * Verifikasi Monitoring Supabase (Egress 5GB, Storage, Latency), Vercel, dan AI Warning Engine
 */

import { SystemHealthService } from '../system-health.service';
import { GroqAIService } from '../groq-ai.service';

export const runSystemHealthTestSuite = async (): Promise<{
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

  try {
    // ── Test 1: Inisialisasi Egress Tracker Default
    const defaultConfig = SystemHealthService.getEgressConfig();
    assert(
      'Egress Tracker 1: Baseline default terkonfigurasi pada 2.900 MB (2.90 GB baseline)',
      defaultConfig.baselineMb === 2900,
      `Baseline: ${defaultConfig.baselineMb} MB`
    );
    assert(
      'Egress Tracker 2: Burn rate harian default terkonfigurasi pada 30 MB/hari pasca-optimasi',
      defaultConfig.dailyBurnRateMb === 30,
      `Burn Rate: ${defaultConfig.dailyBurnRateMb} MB/hari`
    );

    // ── Test 2: Pembaruan Egress Baseline
    SystemHealthService.updateEgressConfig(3000, 35);
    const updatedConfig = SystemHealthService.getEgressConfig();
    assert(
      'Egress Tracker 3: updateEgressConfig berhasil memperbarui baseline ke 3.000 MB',
      updatedConfig.baselineMb === 3000,
      `New Baseline: ${updatedConfig.baselineMb} MB`
    );

    // Kembalikan ke baseline terkalibrasi
    SystemHealthService.updateEgressConfig(2900, 30);

    // ── Test 3: Kalkulasi LocalStorage Usage
    const usageKb = SystemHealthService.getLocalStorageUsageKb();
    assert(
      'Cache Monitor: getLocalStorageUsageKb mengembalikan nilai numerik non-negatif',
      typeof usageKb === 'number' && usageKb >= 0,
      `Usage: ${usageKb} KB`
    );

    // ── Test 4: Eksekusi Full Health Scan
    const report = await SystemHealthService.runHealthScan();
    assert(
      'Health Scan 1: Menghasilkan health report valid dengan skor kesehatan 10-100',
      report && typeof report.overallScore === 'number' && report.overallScore >= 10 && report.overallScore <= 100,
      `Score: ${report?.overallScore}/100`
    );

    assert(
      'Health Scan 2: Status kesehatan memuat salah satu dari kategori [PRIMA, WASPADA, KRITIS]',
      report && ['PRIMA', 'WASPADA', 'KRITIS'].includes(report.overallStatus),
      `Status: ${report?.overallStatus}`
    );

    assert(
      'Health Scan 3: Headline diagnosa terisi kalimat bermakna',
      Boolean(report && report.headline && report.headline.length > 10),
      report?.headline
    );

    // ── Test 5: Metrik Supabase
    assert(
      'Supabase Metrics 1: Kuota Egress 5.000 MB (5 GB) terkunci akurat sesuai tier free',
      report?.supabase?.egressLimitMb === 5000,
      `Limit: ${report?.supabase?.egressLimitMb} MB`
    );

    assert(
      'Supabase Metrics 2: Egress percentage terhitung presisi',
      Boolean(report?.supabase && report.supabase.egressPercent > 0 && report.supabase.egressPercent <= 100),
      `Usage: ${report?.supabase?.egressPercent}%`
    );

    assert(
      'Supabase Metrics 3: Storage buckets memuat informasi bucket avatars dan leave-attachments',
      Boolean(
        report?.supabase?.storageBuckets &&
        report.supabase.storageBuckets.some((b) => b.name === 'avatars') &&
        report.supabase.storageBuckets.some((b) => b.name === 'leave-attachments')
      ),
      `Buckets: ${report?.supabase?.storageBuckets?.map((b) => b.name).join(', ')}`
    );

    // ── Test 6: Metrik Vercel & PWA
    assert(
      'Vercel Metrics 1: Latensi Edge network Vercel tercatat dan valid',
      typeof report?.vercel?.edgeLatencyMs === 'number' && report.vercel.edgeLatencyMs >= 0,
      `Edge Latency: ${report?.vercel?.edgeLatencyMs} ms`
    );

    assert(
      'Vercel Metrics 2: Versi aplikasi dan runtime klien terdefinisi',
      Boolean(report?.vercel?.buildVersion && report.vercel.buildVersion.includes('v1.0')),
      `Build: ${report?.vercel?.buildVersion}`
    );

    // ── Test 7: Peringatan & Rekomendasi AI
    assert(
      'AI Diagnostics 1: warnings berupa array terstruktur',
      Array.isArray(report?.warnings),
      `Total warnings: ${report?.warnings?.length}`
    );

    assert(
      'AI Diagnostics 2: recommendations memuat poin aksi perlindungan sistem',
      Array.isArray(report?.recommendations) && report.recommendations.length > 0,
      `Total recommendations: ${report?.recommendations?.length}`
    );

    // ── Test 8: AI Generative Fallback
    const aiDiag = await GroqAIService.diagnoseCloudHealth({
      egressUsedMb: 2900,
      egressLimitMb: 5000,
      egressPercent: 58.0,
      supabaseLatencyMs: 95,
      vercelLatencyMs: 45,
      unoptimizedImagesCount: 0,
      pendingOfflineRecords: 0,
    });
    assert(
      'AI Engine: diagnoseCloudHealth mengeksekusi dengan aman tanpa unhandled exception',
      aiDiag === null || typeof aiDiag === 'object',
      aiDiag ? 'AI Response OK' : 'Heuristic Fallback Active'
    );
  } catch (err: any) {
    failed++;
    results.push({ testName: 'System Health Test Crash Exception', status: 'FAIL', details: err?.message });
  }

  return { passed, failed, results };
};
