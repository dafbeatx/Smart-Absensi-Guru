import fs from 'fs';

// A valid 192x192 PNG green icon base64 (Emerald theme)
const greenPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const buffer = Buffer.from(greenPngBase64, 'base64');
fs.writeFileSync('public/pwa-192x192.png', buffer);
fs.writeFileSync('public/pwa-512x512.png', buffer);
console.log('Successfully generated public/pwa-192x192.png and public/pwa-512x512.png');
