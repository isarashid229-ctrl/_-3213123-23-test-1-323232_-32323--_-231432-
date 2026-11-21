# ReplayLab Studio 3

A self-contained historical replay and paper-trading workspace with a structured learning program. The published application is `trading-simulator/index.html`; editable source and regression tests live in `trading-simulator/src/`.

## Run and build

Node.js 20 or newer is sufficient. No package installation, build service, API key, external chart library or font download is required.

```sh
cd trading-simulator/src
npm test
npm run build
```

The build creates `dist/index.html`. Publish that file as `trading-simulator/index.html`. On the managed preview environment, `.openai/hosting.json` points the preview to `dist`.

## Studio workspace

- SVG price charts remain sharp across screen densities, browser zoom and resizing. The default chart has a white surface, blue rising candles and near-black falling candles.
- User preferences include candle colors, light/dark chart appearance, candlesticks/OHLC bars/close line, volume, grid, EMA 9/21, New York core-hours reference shading and eligible NY-day VWAP.
- Pan and zoom, mark price levels, expand the chart, play or step through replay, and inspect only revealed candles. `Space` plays/pauses and `N` advances a candle when not editing a field. Focus the chart for keyboard zoom/pan; `End` returns to the latest revealed bar.
- All human-facing intraday timestamps use `America/New_York`, with automatic EST/EDT handling. Daily studies show session dates. Numeric timestamps remain Unix seconds for arithmetic and persistence.
- Searchable stock/ETF catalog, filters, favorites, bundled Bitcoin history, optional public crypto candles, and OHLCV CSV import.

## Market samples

| Symbols | Timeframe | Historical coverage | Interpretation |
|---|---|---|---|
| AAPL, MSFT, NVDA, TSLA, AMD, AMZN, META, GOOG | 3 minutes | July 22–24, 2026; 320 bars each, first session partial | Vendor-published chart samples; tick counts, not share volume |
| SPY | Daily | September 1, 2020–January 12, 2021; 92 bars | Daily structure/gap study |
| QQQ, TSM | Daily | January 2–December 31, 2025; 250 bars each | Daily structure/gap study |
| IWM | Daily | January 3–June 30, 2022; 124 bars | Daily structure/gap study |
| BTC/USDT | 15 minutes | March 2026; 2,976 bars | Bundled third-party historical archive |

These are attributed third-party learning samples, not independently verified research-grade feeds, live quotes or a comprehensive market-data service. `instruments.js` includes source URLs, retrieval provenance, dataset digests, volume definitions, adjustment limitations and applicable license notices. Sources and license notices are accessible in the in-app field guide.

VWAP is computed from revealed bars within the loaded New York day only. It is unavailable for daily studies, tick-count samples, or absent volume. Core-hours shading is a weekday 09:30–16:00 New York reference; holidays and early closes are not modeled. Daily timestamps use 16:00 New York to preserve the source date; that convention is not an observed intraday price timestamp or closing-auction guarantee.

Public crypto requests use Coinbase Exchange and Kraken with exact pair matching, finite timeouts, provider fallbacks, exclusion of unfinished candles and source-pinned continuation. Region or browser restrictions can still prevent public access; the bundled workspace remains usable when they do.

CSV requires time/open/high/low/close; volume is optional. Unix seconds, milliseconds and ISO timestamps are accepted. Date-only imported values are mapped to their supplied date at 16:00 New York; naive intraday ISO timestamps are interpreted as UTC. Explicit offsets are recommended. The importer rejects inconsistent OHLC, conflicting duplicates and invalid numbers. Prices are paper-dollar units; futures multipliers, FX pip conversion and derivative options are not modeled.

## Paper account model

Every session starts at $100,000. One long or short position is allowed, capped at 1× equity. Entry and exits incur 0.04% fees and 0.02% adverse slippage per fill. A market entry uses the currently revealed bar's close. Protective exits begin on the next bar. Stops take priority when both stop and target are touched within an ambiguous bar, unless the opening gap resolves the exit first. Gaps can exceed the planned loss. Targets are modeled as trigger-based exits, not guaranteed limit fills.

Sizing includes modeled fees and slippage. Automatic sizing rounds stock positions down to whole shares where at least one share fits; the paper model also accepts fractional quantities. Short selling is simulated without borrow availability, borrow fees, funding, tax, margin or order-book liquidity models. USD and USDT are treated as equal paper units. Equity includes gross open P&L and already-paid entry fees; exit fees are realized at close.

Changing datasets or rewinding creates a fresh account and archives existing trades. The journal can show current or archived sessions, with plan-adherence reviews, costs, net results, R multiples, expectancy and closed-trade drawdown. Journal summary metrics describe the current session. At most 50 archived sessions are retained. Trade CSV displays New York times or daily session dates.

## Learning program

- 16 modules, 48 original lessons and 80 module questions.
- 8 scored interactive skill labs with 40 tasks per complete pass and fresh rounds on retry.
- 16 weeks, 80 distinct 30–60-minute study/practice assignments, weekly deliverables and saved evidence notes. Estimated assigned study time is about 59 hours; additional repetition is expected.
- A 12-question starting diagnostic and 20-question capstone, explanations, skill-level feedback and linked remediation lessons.
- 8 process-readiness rubric categories, explicitly self-assessed.
- Problem-specific practice paths, 14 official video resources with application tasks, 34 primary reading sources and a 48-term glossary.

The course develops knowledge, documented practice and professional habits. Completion does not certify professional status, provide a license, or promise employment or profitability. The sixteen-week schedule is a study structure, not a guaranteed deadline for using real money. Lab charts are synthetic teaching examples; bundled market prices are attributed historical samples.

## Persistence and privacy

The site has no account service, server-side personal-data storage, trading connection or analytics. Session data, course scores, lab results, training notes and preferences save in this browser under the existing v2-compatible storage key. The export/restore format preserves older Academy backups. Export progress before switching devices or clearing browser storage. External educational links open their publishers' sites; playback and site availability can change.

## Source files

- `engine.js`: candle validation, CSV parser, paper accounting and trade metrics.
- `time.js`: New York display, DST-aware local date parsing and session reference.
- `market.js`: public crypto adapters, request bounds and provider consistency.
- `instruments.js`: bundled stock/ETF samples and provenance.
- `chart.js`: vector renderer, annotations, indicators, keyboard and pointer input.
- `academy.js`, `training.js`, `labs.js`: original curriculum, assignments, assessments and graded exercises.
- `studio.js`: market browser, chart settings, training UI and progress validation.
- `app.js`: simulation orchestration, course/coach/journal routes and persistence.
- `index.template.html`, `styles.css`, `studio.css`, `labs.css`: application shell and responsive styling.
- `build.cjs`: self-contained HTML assembly; `tests/`: meaningful regression coverage.

## Validation

The Studio 3 release passes 91 automated tests spanning accounting, chronology/no-lookahead, source selection and continuation, SVG rendering, DST, daily date preservation, CSV errors and tiny prices, backup reconstruction, asynchronous restore protection, stock sizing, settings, training, assessments and content integrity. Browser checks cover desktop and mobile rendering, chart modes, stock and ETF selection, search, weekly note persistence, diagnostic submission and responsive overflow. See `QA.md` for the checked scope and limits.
