# FantaLive Bundlesliga

Live fantacalcio head-to-head app per la lega privata Bundlesliga. Mostra risultati in tempo reale delle sfide fantasy, calcola i punteggi secondo il regolamento ufficiale e gestisce il mercato settimanale.

## Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Hosting**: Vercel (ready to deploy)
- **Database**: Supabase (PostgreSQL + Realtime) - schema fornito, fallback locale per development
- **Live Data**: Provider pluggabile (Mock per development, stub ESPN/API-Football)

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# App disponibile su http://localhost:43210

# Run tests
npm run test

# Build for production
npm run build
```

## Architettura

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Giornata Live (home)
│   ├── sfida/             # Dettaglio sfida
│   ├── partite/           # Partite Serie A
│   ├── classifica/        # Classifica + calendario
│   └── admin/mercato/     # Admin: importazione mercato
├── components/            # React components
│   ├── ui/               # Base UI (Card, Badge, Icons)
│   ├── match/            # Match-specific (MatchCard, PlayerRow)
│   └── layout/           # Layout (Header, BottomNav)
├── lib/                   # Core logic
│   ├── scoring-engine.ts # Motore di scoring fantasy
│   ├── league-rules.ts   # Regole configurabili
│   ├── market-*.ts       # Parser e validatore mercato
│   ├── live-data.ts      # Calcolo partite live
│   └── db/               # Data access layer
├── providers/             # Live data providers (pluggabile)
│   ├── types.ts          # Interface LiveDataProvider
│   ├── mock-provider.ts  # Mock per development
│   ├── espn-provider.stub.ts
│   └── factory.ts        # Provider factory (LIVE_PROVIDER env)
├── data/                  # Seed data
│   ├── teams.ts          # 10 squadre + roster
│   └── calendar.ts       # 27 giornate
└── types/                 # TypeScript types
```

## Regole di Scoring

### Bonus/Malus
| Evento | Punti |
|--------|-------|
| Gol | +3 |
| Rigore segnato | +2 |
| Rigore sbagliato | -3 |
| Rigore parato (P) | +3 |
| Assist | +1 |
| Autorete | -1 |
| Ammonizione | -0.5 |
| Espulsione | -1 |
| Gol subito (P) | -1 |
| Fattore campo | +2 |

### Fasce Gol
66 → 1 gol | 72 → 2 gol | 77 → 3 gol | 81 → 4 gol | 85 → 5 gol | +4 ogni gol

### Modificatori
- **Difesa**: media voti difensori → bonus/malus all'avversario
- **Centrocampo**: confronto totali CC → bonus a chi vince, malus a chi perde
- **Attacco**: attaccanti con buon voto che non segnano → bonus

## Live Data Providers

Il sistema supporta provider multipli per i dati live. Configura con:

```bash
# .env.local
NEXT_PUBLIC_LIVE_PROVIDER=mock  # mock | espn | apifootball | fotmob | csv
```

### Aggiungere un nuovo provider

1. Crea `src/providers/your-provider.ts` implementando `LiveDataProvider`
2. Aggiungi il case in `src/providers/factory.ts`
3. Esporta da `src/providers/index.ts`
4. Esegui i contract tests: `npm test -- src/providers/__tests__/contract.test.ts`

Vedi `src/providers/PROVIDER_CONTRACT.md` per i requisiti dell'interface.

## Gestione Mercato

### Regole
- Finestra: Lunedì 00:00 - Giovedì 18:59 (chiuso a gennaio)
- Crediti iniziali: 60 per squadra
- Prestito: costo fisso 10 crediti
- Cessione giocatore Serie A: nessun rimborso
- Cessione giocatore fuori Serie A: TODO (configurabile)

### Importazione Email FMS Revo

L'admin page (`/admin/mercato`) permette di:
1. Incollare l'email settimanale del mercato
2. Preview con fuzzy matching automatico
3. Correzione manuale errori
4. Conferma con validazione completa (crediti, slot, duplicati)

## Supabase Setup

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key  # server-side only
```

### Migrations

```bash
# Apply migrations
npx supabase db push

# Or manually via Supabase dashboard SQL editor:
# 1. supabase/migrations/00001_initial_schema.sql
# 2. supabase/migrations/00002_seed_data.sql
```

### Schema Overview

```sql
teams              -- 10 squadre fantasy
players            -- Giocatori Serie A
roster_versions    -- Snapshot rose per versioning
roster_players     -- Giocatori in ogni versione
market_transactions -- Storico operazioni mercato
rounds             -- 27 giornate
lineups            -- Formazioni per giornata
live_events        -- Eventi live (gol, assist, cartellini)
live_votes         -- Voti stimati durante le partite
official_votes     -- Voti ufficiali post-giornata
match_scores       -- Punteggi calcolati
standings          -- Classifica
```

### Realtime (TODO)

```typescript
// Subscribe to live events
supabase
  .channel('live-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'live_events',
    filter: `round_number=eq.${currentRound}`
  }, handleNewEvent)
  .subscribe();
```

## Vercel Deploy

1. Connect repo to Vercel
2. Add environment variables
3. Deploy

```bash
# Or via CLI
npx vercel --prod
```

## Next Steps

### MVP Complete
- [x] Scoring engine with tests
- [x] Pluggable live provider system
- [x] UI screens (Live, Sfida, Partite, Classifica)
- [x] Market email importer with validation
- [x] Supabase schema design
- [x] Roster versioning system

### TODO
- [ ] Wire Supabase client (replace local mock)
- [ ] Implement ESPN provider
- [ ] Lineup input page
- [ ] Official votes reconciliation (CSV upload)
- [ ] Supabase Realtime integration
- [ ] Push notifications
- [ ] PWA support
- [ ] Historical data visualization

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- src/lib/__tests__/scoring-engine.test.ts
```

### Test Coverage
- Scoring engine: 51 tests (modifiers, goal conversion, substitutions)
- Market email parser: 29 tests (parsing, fuzzy matching)
- Market validator: 24 tests (all validation rules)
- Provider contract: 16 tests (interface compliance)

## License

Private - Bundlesliga 2026/27
