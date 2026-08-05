import type { IDataProvider } from './data-provider.interface';
import { MockProvider } from './mock-provider.service';
import { SupabaseProvider } from './supabase-provider.service';

export class ProviderFactory {
  private static instance: IDataProvider | null = null;

  public static getProvider(): IDataProvider {
    if (!ProviderFactory.instance) {
      const configuredProvider = (
        typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROVIDER
          ? import.meta.env.VITE_PROVIDER
          : 'supabase'
      ).toLowerCase();

      if (configuredProvider === 'mock') {
        console.info('🔌 Data Provider: Active Mode -> MockProvider (Local Testing)');
        ProviderFactory.instance = new MockProvider();
      } else {
        console.info('⚡ Data Provider: Active Mode -> SupabaseProvider (PostgreSQL Cloud)');
        ProviderFactory.instance = new SupabaseProvider();
      }
    }
    return ProviderFactory.instance;
  }

  public static setProvider(provider: IDataProvider): void {
    ProviderFactory.instance = provider;
  }
}
