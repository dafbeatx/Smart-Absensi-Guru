const fs = require('fs');
const path = require('path');

async function main() {
  const pngToIcoModule = await import('png-to-ico');
  const pngToIco = pngToIcoModule.default || pngToIcoModule;

  const inputPng = path.join(__dirname, '../public/school-logo.png');
  const buildDir = path.join(__dirname, '../build');
  const outIco = path.join(buildDir, 'icon.ico');
  const outFavicon = path.join(__dirname, '../public/favicon.ico');
  const outBuildPng = path.join(buildDir, 'icon.png');

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  console.log('Generating multi-resolution ICO from:', inputPng);
  const buf = await pngToIco(inputPng);

  fs.writeFileSync(outIco, buf);
  console.log('Generated build/icon.ico, size:', buf.length, 'bytes');

  fs.writeFileSync(outFavicon, buf);
  console.log('Updated public/favicon.ico, size:', buf.length, 'bytes');

  fs.copyFileSync(inputPng, outBuildPng);
  console.log('Copied build/icon.png, size:', fs.statSync(outBuildPng).size, 'bytes');

  // Verify ICO magic bytes (0x00, 0x00, 0x01, 0x00)
  const magic = buf.slice(0, 4);
  console.log('ICO Magic bytes:', magic);
  if (magic[0] === 0x00 && magic[1] === 0x00 && magic[2] === 0x01 && magic[3] === 0x00) {
    console.log('VERIFICATION SUCCESS: Valid Windows ICO file header (0x00000100)');
  } else {
    throw new Error('VERIFICATION FAILED: Invalid ICO magic header');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

