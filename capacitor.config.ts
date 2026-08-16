import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartabsensi.guru',
  appName: 'Smart Absensi Guru',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
