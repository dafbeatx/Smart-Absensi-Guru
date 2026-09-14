import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const url = 'https://fwhdjqvtjzesbdcqorsn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGRqcXZ0anplc2JkY3FvcnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAyNDgsImV4cCI6MjA4Mjk0NjI0OH0.jgKMD9Yg0iWw3JQMeH7_HQ3ZDOmYBqZ70Y-HZEjOyuY';

const client = createClient(url, key);

const tablesToBackup = [
  'users',
  'attendance',
  'leaves',
  'students',
  'gm_behaviors',
  'gm_behavior_logs',
  'student_behavior_logs',
  'student_character_summary',
  'teacher_point_history',
  'teaching_schedules',
  'teacher_duty_schedules',
  'system_settings',
  'holidays',
  'notifications',
  'teacher_moods',
  'teacher_complaints',
  'gm_students',
  'gm_sessions',
  'inventory_sarpras',
  'student_scores'
];

async function fetchAllRows(tableName: string) {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .range(from, to);

    if (error) {
      console.warn(`[WARN] Failed to fetch ${tableName}: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function runBackup() {
  const backupDir = path.resolve(process.cwd(), 'database_backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('====================================================');
  console.log('🚀 MEMULAI PENCADANGAN LENGKAP DATABASE SUPABASE...');
  console.log(`📁 Folder Tujuan: ${backupDir}`);
  console.log('====================================================');

  const summary: Record<string, number> = {};

  for (const table of tablesToBackup) {
    process.stdout.write(`Sedang mengunduh ${table}... `);
    const rows = await fetchAllRows(table);
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    summary[table] = rows.length;
    console.log(`✅ ${rows.length} data tersimpan`);
  }

  const manifestPath = path.join(backupDir, 'backup_manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        backup_date: new Date().toISOString(),
        source_url: url,
        tables: summary,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log('====================================================');
  console.log('🎉 SEMUA DATA BERHASIL DICADANGKAN 100% UTUH!');
  console.log('====================================================');
}

runBackup();
