import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Mengambil konfigurasi dari .env atau parameter baris perintah
const targetUrl = process.env.TARGET_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const targetKey = process.env.TARGET_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!targetUrl || !targetKey) {
  console.error('❌ Harap tentukan TARGET_SUPABASE_URL dan TARGET_SUPABASE_KEY!');
  process.exit(1);
}

const client = createClient(targetUrl, targetKey);

const restoreOrder = [
  'users',
  'system_settings',
  'holidays',
  'students',
  'gm_students',
  'gm_sessions',
  'teacher_duty_schedules',
  'attendance',
  'leaves',
  'gm_behaviors',
  'gm_behavior_logs',
  'teacher_point_history',
  'notifications',
  'teacher_moods',
  'teacher_complaints'
];

async function insertInBatches(tableName: string, rows: any[], batchSize = 100) {
  if (rows.length === 0) return;
  console.log(`Memulihkan ${tableName} (${rows.length} data)...`);
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await client.from(tableName).upsert(chunk, { ignoreDuplicates: true });
    if (error) {
      console.warn(`[WARN] Gagal upsert batch ${i}-${i + chunk.length} di ${tableName}: ${error.message}`);
    }
  }
  console.log(`✅ Selesai memulihkan ${tableName}`);
}

async function runRestore() {
  const backupDir = path.resolve(process.cwd(), 'database_backup');
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Folder backup ${backupDir} tidak ditemukan!`);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🚀 MEMULAI PEMULIHAN (RESTORE) DATA KE SUPABASE BARU...');
  console.log(`🎯 Target URL: ${targetUrl}`);
  console.log('====================================================');

  for (const table of restoreOrder) {
    const filePath = path.join(backupDir, `${table}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rows = JSON.parse(content);
      await insertInBatches(table, rows);
    }
  }

  console.log('====================================================');
  console.log('🎉 SELURUH DATA BERHASIL DIPINDAHKAN KE TOREN BARU!');
  console.log('====================================================');
}

runRestore();
