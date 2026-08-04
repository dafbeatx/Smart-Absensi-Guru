import fs from 'fs';
import QRCode from 'qrcode';

async function generateIcons() {
  const buf192 = await QRCode.toBuffer('Smart Absensi Guru', {
    width: 192,
    margin: 2,
    color: { dark: '#059669', light: '#F8FAFC' }
  });
  const buf512 = await QRCode.toBuffer('Smart Absensi Guru', {
    width: 512,
    margin: 4,
    color: { dark: '#059669', light: '#F8FAFC' }
  });

  fs.writeFileSync('public/pwa-192x192.png', buf192);
  fs.writeFileSync('public/pwa-512x512.png', buf512);
  console.log('Successfully generated public/pwa-192x192.png (192x192) and public/pwa-512x512.png (512x512)');
}

generateIcons();

