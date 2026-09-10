const fs = require('fs');
const path = require('path');

const now = Date.now();
const dateStr = new Date(now).toISOString().split('T')[0];
const versionStr = `${dateStr}-v${Math.floor(now / 1000)}`;

const versionJsonPath = path.join(__dirname, '..', 'public', 'version.json');
const versionConfigPath = path.join(__dirname, '..', 'src', 'config', 'version.config.ts');

const versionJsonContent = JSON.stringify({
  version: versionStr,
  build_timestamp: now,
  description: 'Smart Absensi Guru Auto-Update Manifest',
}, null, 2) + '\n';

const versionConfigContent = `/**
 * SMART ABSENSI GURU - BUILD & VERSION CONFIGURATION
 * Used for automatic app update detection on HP Mobile & Desktop browsers.
 */

export const APP_VERSION_CONFIG = {
  BUILD_ID: '${versionStr}',
  BUILD_TIMESTAMP: ${now},
  APP_NAME: 'Smart Absensi Guru',
};
`;

fs.writeFileSync(versionJsonPath, versionJsonContent, 'utf-8');
fs.writeFileSync(versionConfigPath, versionConfigContent, 'utf-8');
console.log(`[AutoVersion] Updated build version to ${versionStr} (${now})`);
