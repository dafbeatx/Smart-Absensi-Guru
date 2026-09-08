import crypto from 'crypto';

function urlBase64(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKey = urlBase64(ecdh.getPublicKey());
  const privateKey = urlBase64(ecdh.getPrivateKey());

  return { publicKey, privateKey };
}

const keys = generateVapidKeys();
console.log('=== VAPID KEYS GENERATED ===');
console.log('VITE_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('============================');
