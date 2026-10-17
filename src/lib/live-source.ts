/**
 * Mock live data is used only when LIVE_PROVIDER=mock.
 * Unset or any other provider reads official/live votes from the database.
 */
export function shouldUseMockLiveData(): boolean {
  const provider = process.env.LIVE_PROVIDER ?? process.env.NEXT_PUBLIC_LIVE_PROVIDER;
  return provider === 'mock';
}
