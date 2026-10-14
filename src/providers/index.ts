/**
 * Live Data Providers
 * 
 * This module exports the pluggable live data provider system.
 * 
 * Usage:
 *   import { getProvider } from '@/providers';
 *   const provider = await getProvider();
 *   const data = await provider.fetchLiveData(matchday);
 * 
 * Configuration:
 *   Set LIVE_PROVIDER or NEXT_PUBLIC_LIVE_PROVIDER env var:
 *   - mock: Simulated data for development (default)
 *   - espn: ESPN Soccer API (stub, needs implementation)
 *   - apifootball: API-Football (not implemented)
 *   - fotmob: FotMob (not implemented)
 *   - csv: Manual CSV upload (not implemented)
 * 
 * Adding a new provider:
 *   1. Create src/providers/your-provider.ts
 *   2. Implement LiveDataProvider interface
 *   3. Add to factory.ts createProvider switch
 *   4. Export from this file
 *   5. Run provider contract tests
 * 
 * @see ./types.ts for interface definitions
 * @see ./PROVIDER_CONTRACT.md for requirements
 */

export * from './types';
export * from './factory';
export { MockProvider, createMockProvider } from './mock-provider';
export { EspnProvider, createEspnProvider } from './espn-provider';
