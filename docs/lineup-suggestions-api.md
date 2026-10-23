# API Formazione consigliata

`/api/admin/lineup-suggestions` — auth: `Authorization: Bearer $LINEUP_SUGGESTIONS_API_KEY`
(oppure sessione admin). Dati in `public.lineup_suggestions` (RLS senza policy: solo service role).

| Metodo | Query/Body | Effetto |
|---|---|---|
| GET | `?round=2&team=ap` (round opzionale: ultima giornata) | `{ success, round, suggestions[] }` |
| POST | JSON (sotto) | crea/aggiorna per `id` o per `teamId+round+variant`; `{ success, suggestion, warnings[] }` |
| DELETE | `?id=<uuid>` | elimina (404 se assente) |

```json
{
  "teamId": "ap", "round": 2, "variant": "principale", "status": "proposta",
  "formation": "4-5-1", "opponentTeamId": "rp", "expectedPoints": 72.5,
  "starters": [{ "name": "Mandas", "role": "P", "fixture": "Lazio-Parma", "homeAway": "H", "startPct": 95, "note": "" }],
  "bench": [{ "name": "Corvi", "role": "P" }],
  "rationale": "markdown…",
  "alternatives": [{ "formation": "4-4-2", "expectedPoints": 71, "note": "…" }],
  "sources": ["https://…", { "url": "https://…", "label": "Gazzetta" }]
}
```

`status`: bozza | proposta | confermata | scartata. Giocatori: `playerId` oppure `name`
(abbinato per nome/cognome, prima nella rosa della squadra; `role` disambigua). I non abbinati
restano salvati con `matched: false` e compaiono in `warnings`, come incoerenze modulo/ruoli.
Pagina: `/admin/consigli`.
