const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const keystorePath = path.join(__dirname, '..', 'android', 'app', 'release.keystore');
const keyPropsPath = path.join(__dirname, '..', 'android', 'app', 'key.properties');

if (!fs.existsSync(keystorePath)) {
  console.log('Generating production release keystore...');
  const cmd = [
    'keytool',
    '-genkeypair',
    '-v',
    '-keystore', `"${keystorePath}"`,
    '-alias', 'smartabsensi',
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-storepass', 'SmartAbsensi2026!',
    '-keypass', 'SmartAbsensi2026!',
    '-dname', '"CN=Smart Absensi Guru, OU=IT, O=Al-Ittihadiyah, L=Tasikmalaya, ST=Jawa Barat, C=ID"'
  ].join(' ');

  execSync(cmd, { stdio: 'inherit' });
  console.log('Keystore created at:', keystorePath);
} else {
  console.log('Keystore already exists at:', keystorePath);
}

const keyPropsContent = `storePassword=SmartAbsensi2026!
keyPassword=SmartAbsensi2026!
keyAlias=smartabsensi
storeFile=release.keystore
`;

fs.writeFileSync(keyPropsPath, keyPropsContent, 'utf-8');
console.log('key.properties written at:', keyPropsPath);
