/**
 * Provider Factory
 * 
 * Creates the appropriate LiveDataProvider based on configuration.
 * Set LIVE_PROVIDER env var to select: mock | espn | apifootball | fotmob | csv
 */

import { LiveDataProvider, ProviderType, ProviderConfig } from './types';
import { createMockProvider } from './mock-provider';
import { createEspnProvider } from './espn-provider';

export function getProviderType(): ProviderType {
  const envProvider = process.env.NEXT_PUBLIC_LIVE_PROVIDER || process.env.LIVE_PROVIDER || 'mock';
  const validTypes: ProviderType[] = ['mock', 'espn', 'apifootball', 'fotmob', 'csv'];
  
  if (validTypes.includes(envProvider as ProviderType)) {
    return envProvider as ProviderType;
  }
  
  console.warn(`Invalid LIVE_PROVIDER "${envProvider}", falling back to "mock"`);
  return 'mock';
}

export function createProvider(config?: Partial<ProviderConfig>): LiveDataProvider {
  const type = config?.type || getProviderType();
  
  switch (type) {
    case 'mock':
      return createMockProvider();
    
    case 'espn':
      return createEspnProvider();
    
    case 'apifootball':
      throw new Error(
        'API-Football provider not implemented. ' +
        'Create src/providers/apifootball-provider.ts implementing LiveDataProvider.'
      );
    
    case 'fotmob':
      throw new Error(
        'FotMob provider not implemented. ' +
        'Create src/providers/fotmob-provider.ts implementing LiveDataProvider.'
      );
    
    case 'csv':
      throw new Error(
        'CSV provider not implemented. ' +
        'Create src/providers/csv-provider.ts implementing LiveDataProvider.'
      );
    
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

let globalProvider: LiveDataProvider | null = null;

export async function getProvider(): Promise<LiveDataProvider> {
  if (!globalProvider) {
    globalProvider = createProvider();
    await globalProvider.initialize();
  }
  return globalProvider;
}

export function disposeProvider(): void {
  if (globalProvider) {
    globalProvider.dispose();
    globalProvider = null;
  }
}
