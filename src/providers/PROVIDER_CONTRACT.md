# Live Data Provider Contract

Any provider implementing `LiveDataProvider` must satisfy these requirements.

## Interface Methods

### `initialize(): Promise<void>`
- Called once before any data fetching
- Set up API connections, authenticate, etc.
- Throw on fatal configuration errors

### `fetchLiveData(serieAMatchday: number): Promise<NormalizedMatchData>`
- Fetch all live data for the given Serie A matchday
- Return normalized data (see below)
- Handle API errors gracefully
- Cache appropriately to avoid rate limits

### `fetchFinalVotes?(serieAMatchday: number): Promise<Map<string, number>>`
- Optional: fetch official final votes after matchday ends
- Used for reconciliation with unofficial live estimates
- Return Map of playerId -> finalVote

### `dispose(): void`
- Clean up resources (connections, timers, etc.)
- Called when provider is no longer needed

## Normalized Data Format

### NormalizedMatchData
```typescript
{
  serieAMatches: NormalizedSerieAMatch[];  // All Serie A matches
  playerData: Map<string, NormalizedPlayerData>;  // All player data
  lastUpdated: Date;  // Timestamp of data fetch
  isLive: boolean;  // Any match currently live?
}
```

### NormalizedSerieAMatch
```typescript
{
  matchId: string;       // Unique identifier
  homeTeam: string;      // Team name
  awayTeam: string;      // Team name
  homeScore: number;     // Current score
  awayScore: number;     // Current score
  minute: number;        // Current minute (0 if not started)
  status: MatchStatus;   // 'scheduled' | 'live' | 'halftime' | 'finished'
}
```

### NormalizedPlayerData
```typescript
{
  playerId: string;           // Internal player ID
  playerName: string;         // Player name
  realTeam: string;           // Serie A team
  rating: number | null;      // Source rating (if available)
  estimatedVote: number | null;  // Estimated fantacalcio vote
  minutesPlayed: number;      // Minutes played so far
  isPlaying: boolean;         // Currently on field?
  isSubstitutedOut: boolean;  // Was substituted off?
  events: NormalizedPlayerEvent[];  // Goals, cards, etc.
}
```

### NormalizedPlayerEvent
```typescript
{
  playerId: string;
  playerName: string;
  type: EventType;  // 'goal' | 'penalty_scored' | 'assist' | etc.
  minute: number;
  relatedPlayerId?: string;  // For assists, the scorer
  relatedPlayerName?: string;
}
```

## Vote Estimation

Providers should use `DefaultVoteEstimator` or implement custom logic to convert source ratings to Italian fantacalcio votes:

| Source Rating | Fantacalcio Vote |
|---------------|------------------|
| ≥ 9.0         | 8.0              |
| ≥ 8.0         | 7.5              |
| ≥ 7.5         | 7.0              |
| ≥ 7.0         | 6.5              |
| ≥ 6.5         | 6.0              |
| ≥ 6.0         | 5.5              |
| ≥ 5.5         | 5.0              |
| < 5.5         | 4.5              |

Events modify the estimate (see `DefaultVoteEstimator`).

## Player ID Matching

- Internal player IDs follow pattern: `{teamId}-{normalized-name}`
- Providers must map source player names to internal IDs
- Use fuzzy matching for name variations
- Log warnings for unmatched players

## Contract Tests

Run `npm test -- src/providers/__tests__/contract.test.ts` to verify your provider.

Tests verify:
1. `initialize()` completes without error
2. `fetchLiveData()` returns valid NormalizedMatchData
3. All player events have valid types
4. Vote estimates are within valid range (4-10)
5. Match statuses are valid
6. `dispose()` can be called multiple times safely

## Adding a New Provider

1. Create `src/providers/your-provider.ts`:

```typescript
import { LiveDataProvider, ProviderType, NormalizedMatchData } from './types';

export class YourProvider implements LiveDataProvider {
  readonly name = 'Your Provider';
  readonly type: ProviderType = 'yourtype';  // Add to ProviderType union

  async initialize(): Promise<void> { /* ... */ }
  async fetchLiveData(matchday: number): Promise<NormalizedMatchData> { /* ... */ }
  dispose(): void { /* ... */ }
}
```

2. Add to `ProviderType` in `types.ts`
3. Add case to `factory.ts` `createProvider()`
4. Export from `index.ts`
5. Add contract tests
6. Document in this file
