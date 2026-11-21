# ReplayLab Academy 2.0

A self-contained learning and paper-trading workspace. The published `index.html` embeds its styles, scripts, course, labs and 2,976-bar historical dataset. It starts without an exchange API or a separate CSV fetch.

## What's included

- Historical candle replay with no future bars drawn, EMA 9/21, zoom, pan, price levels, play/pause, stepping, timeline navigation and random starting points.
- Long/short paper trades, cost-aware position sizing, fixed stop/target exits, gap and intrabar ambiguity handling, realized balance and marked equity.
- Ten course modules, 30 original lessons, 40 quiz questions with explanations and saved best scores.
- Eight interactive labs, each with five tasks: candles, structure, levels, sizing, orders, risk/reward, expectancy and discipline. Synthetic teaching charts are explicitly labeled.
- Eight problem-specific learning paths linked to lessons, labs and 12 official video resources from Schwab, Fidelity and CME Group.
- A journal with trade plans, self-reviews, mistake tags, net results, average R, expectancy, win rate and closed-trade drawdown.
- Browser-local persistence, progress backup/restore, journal CSV export, CSV import and a searchable glossary.

## Build and test

Editable files are in `src/`. No dependencies or installation are required. Use Node 20 or newer.

```sh
cd src
node build.cjs
node --test tests/*.test.cjs
```

The generated file is `src/dist/index.html`. Copy that file to `trading-simulator/index.html` to publish through this repository's existing GitHub Pages deployment. The page has no external JavaScript, stylesheet, font or chart-library dependency.

The source directory includes the original course data, lab code, trading engine, market adapters, chart, application UI, template and test suites. Keep edits in source files and regenerate the published HTML.

## Data behavior

The bundled BTCUSDT 15-minute archive covers March 2026 and contains 2,976 bars. Its original source is the publicly shared CSV at:

https://github.com/grayson8geraldo/triq/blob/main/BTCUSDT-15m-2026-03.csv

This is a third-party historical archive, not an independently authenticated research-grade feed. All bars are validated for finite prices, positive prices, OHLC consistency, volume, ordering and duplicate timestamps. The default replay uses the embedded copy even when public endpoints are unavailable.

Optional public requests race Coinbase Exchange and Kraken with 6.5-second timeouts. Exact market/quote pairs are preserved, incomplete candles are filtered, and a successful provider cancels the competing request. Fetching more candles remains on the same venue. Kraken cannot return arbitrarily old OHLC data; unavailable requests leave the existing replay and account intact.

- Coinbase: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
- Kraken: https://docs.kraken.com/api-reference/market-data/get-ohlc-data

CSV import accepts comma/semicolon-delimited OHLC data with header aliases, quoted fields, optional volume, Unix seconds/milliseconds and ISO dates. Timezone-free ISO values are interpreted as UTC. Import requires 10–50,000 unique candles and files smaller than 10 MB. Invalid rows produce explicit errors; they are not silently discarded.

## Simulation conventions

- Starting paper balance: $100,000. One open position. Maximum entry notional plus entry fee is limited to available equity (1×).
- Each fill has 0.04% fee and 0.02% adverse slippage. Entry uses the currently revealed candle close.
- Stops and targets activate on later candles. A gap through the stop uses the opening price. If a candle touches both levels and the opening price has not already resolved the exit, the stop is chosen first.
- A target is a trigger-based take-profit exit with adverse slippage, not a guaranteed limit-price fill. Favorable target gaps receive no modeled price improvement.
- Equity includes open price P&L; estimated future exit fees are not deducted until exit. “Realized balance” is a paper-account ledger, not spendable cash after buying the asset.
- Trade timestamps identify the candle's opening time, while a manual entry or exit executes at that candle's close.
- USD and USDT are treated as equal paper units. No order-book queue, liquidity, borrowing, funding, taxes, futures multipliers or FX conversion is modeled. Short selling is simulated.
- Rewinding, changing data or starting a new session closes any open position at the current replay close, archives the session and resets the account. The journal can display current or archived sessions; statistics and the equity curve use the current session.
- The browser retains up to 50 archived sessions. JSON backups include the active data, journal and learning progress. Restore validates the schema and reconstructs derived trade results instead of trusting saved P&L.

## Learning and resources

Lessons are original educational text with links to primary reading sources. Video cards link to actual official provider pages and include a reason to watch plus a practice task. Resources were checked November 21, 2026; external playback can depend on provider availability, cookies or sign-in. Videos are not embedded or autoplayed.

Course quizzes require 80% mastery (four of four for each four-question check); labs require at least four of five. Read lessons, quiz mastery, lab mastery and watched videos are tracked separately. Completion demonstrates these learning activities and is not professional certification or a promise of trading performance.

## Validation for this release

52 automated tests cover the trading engine, public market adapters, chart future-data isolation and resizing, content/reference integrity, executable self-contained output, replay transitions and persistence/backup reconstruction.

Browser checks covered:

- Immediate bundled replay and visible chart without the obsolete blocking overlay.
- Risk-based long entry, saved open-position reload, stepping, manual exit, journal review and quiz-score reload.
- A complete five-task candle lab with numeric and recognition questions and a saved 100% result.
- All 12 video cards, topic search, and problem-to-course/lab/video links.
- A 390px mobile viewport, including practice, course, coach and a data dialog, without page-level horizontal overflow.
- A deliberately unavailable historical public-data request followed by successful replay advancement on the retained dataset.
- A successful optional live request returning 700 completed BTC-USD candles from Kraken.

External video playback was not tested. Public data availability remains subject to exchange, network and regional restrictions; the embedded archive and CSV import do not depend on those APIs.
