import type { IDataProvider } from './data-provider.interface';
import { MockProvider } from './mock-provider.service';
import { GasProvider } from './gas-provider.service';
import { SupabaseProvider } from './supabase-provider.service';
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

      if (configuredProvider === 'supabase') {
        console.info('⚡ Data Provider: Active Mode -> SupabaseProvider (PostgreSQL Cloud)');
        ProviderFactory.instance = new SupabaseProvider();
      } else if (configuredProvider === 'gas') {
        console.info('🌐 Data Provider: Active Mode -> GasProvider (Google Apps Script)');
        ProviderFactory.instance = new GasProvider();
      } else {
        // Fallback or explicit mock mode
        const isMockMode =
          configuredProvider === 'mock' ||
          APP_CONFIG.IS_DEV ||
          APP_CONFIG.API_URL.includes('DEV_DEPLOYMENT_ID') ||
          APP_CONFIG.API_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_ID');

        if (isMockMode) {
          console.info('🔌 Data Provider: Active Mode -> MockProvider (Local Testing)');
          ProviderFactory.instance = new MockProvider();
        } else {
          console.info('🌐 Data Provider: Active Mode -> GasProvider (Google Apps Script)');
          ProviderFactory.instance = new GasProvider();
        }
      }
    }
    return ProviderFactory.instance;
  }

  public static setProvider(provider: IDataProvider): void {
    ProviderFactory.instance = provider;
  }
}
