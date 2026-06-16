# Open Pocket

A browser recreation of the **Pokémon TCG Pocket** battle interface, where one
person plays *both* sides of the match — a hotseat game with the rules enforced
for you.

## How it works

**Pure browser, no backend.** The whole game runs client-side. There's no server,
no account, no network calls during play — open the page and battle. Your
in-progress game and your deck choices are saved to `localStorage`, so a refresh
(or coming back later) drops you right back where you were.

**A rules engine generates the legal moves.** A pure TypeScript engine
(`src/engine/`) holds the game state and, for any given position, computes the
exact set of legal moves. The UI never has to know the rules — it just renders
the moves the engine offers. State is plain JSON (the RNG is a numeric seed), so
a game serializes losslessly.

**Click to act.** There's no command menu. You tap a card or zone on the board
and the UI surfaces only the actions that are legal right now — attach energy,
evolve, retreat, attack, use an ability. Forced consequences (damage, knockouts,
drawing a prize) resolve automatically; only real decisions become clickable
steps. Illegal plays simply aren't offered.

**Undo.** Made a mistake, or want to see what a move does? Every move snapshots
the pre-move state, so you can step back through your turn. Because the engine
state is fully self-contained (seed included), an undo rewinds the game exactly —
no desync.

**Hotseat with a shared game log.** One device, two players. At the end of a turn
the board rotates 180° so the next player sees the field from their own seat. A
running game log records every event — flips, damage, knockouts, energy, draws —
so either player can scroll back and see precisely how the position came to be.

## Running locally

```bash
npm install
npm run dev      # start the Vite dev server
npm test         # run the Vitest suite
npm run build    # type-check + production build
```

Card data and art are prebuilt into `src/engine/data/` and `public/cards/`. To
regenerate them from the upstream sources, run `npm run data`.

## Deploying to Cloudflare Workers

This project is ready for Cloudflare Workers with Static Assets.

When connecting the Git repository in Cloudflare Workers, use:

- Framework preset: `React (Vite)`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Cloudflare will deploy automatically whenever you push to the production branch you choose in the setup. Non-production branches can also get preview builds.

The repo includes:

- `.node-version` so Cloudflare builds with Node `22.12.0`
- `wrangler.toml` so Wrangler deploys `dist` as Workers Static Assets
- `npm run deploy:cloudflare` for an optional manual deploy from your machine

## Prior Art
- Rules engine: https://github.com/bcollazo/deckgym-core
- Card data: https://github.com/flibustier/pokemon-tcg-pocket-database
- Images: https://github.com/flibustier/pokemon-tcg-exchange/tree/main/public/images/cards-by-set
