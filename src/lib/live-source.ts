/**
 * Mock live data is used only when LIVE_PROVIDER=mock.
 * Unset or any other provider reads official/live votes from the database.
 */
export function shouldUseMockLiveData(): boolean {
  // NEXT_PUBLIC_ first: it is the only one visible in client components,
  // so server and client pages pick the same source.
  const provider = process.env.NEXT_PUBLIC_LIVE_PROVIDER ?? process.env.LIVE_PROVIDER;
  return provider === 'mock';
}
