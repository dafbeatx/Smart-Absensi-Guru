import type { IDataProvider } from './data-provider.interface';
import { MockProvider } from './mock-provider.service';
import { GasProvider } from './gas-provider.service';
import { APP_CONFIG } from '../config/app.config';

export class ProviderFactory {
  private static instance: IDataProvider | null = null;

  public static getProvider(): IDataProvider {
    if (!ProviderFactory.instance) {
      const configuredProvider = (
        typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROVIDER
          ? import.meta.env.VITE_PROVIDER
          : ''
      ).toLowerCase();

      // Check explicit VITE_PROVIDER env or fallback to URL checks
      const isMockMode =
        configuredProvider === 'mock' ||
        (configuredProvider !== 'gas' &&
          (APP_CONFIG.IS_DEV ||
            APP_CONFIG.API_URL.includes('DEV_DEPLOYMENT_ID') ||
            APP_CONFIG.API_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_ID')));

      if (isMockMode) {
        console.info('🔌 Data Provider: Active Mode -> MockProvider (Local Testing)');
        ProviderFactory.instance = new MockProvider();
      } else {
        console.info('🌐 Data Provider: Active Mode -> GasProvider (Google Apps Script)');
        ProviderFactory.instance = new GasProvider();
      }
    }
    return ProviderFactory.instance;
  }

  public static setProvider(provider: IDataProvider): void {
    ProviderFactory.instance = provider;
  }
}
