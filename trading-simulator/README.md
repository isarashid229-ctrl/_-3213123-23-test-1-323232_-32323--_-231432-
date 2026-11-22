# ReplayLab Desk 5

A self-contained historical replay and paper-trading workspace with a structured learning program, risk decision practice, and U.S. federal tax education. The published application is `trading-simulator/index.html`; editable source and regression tests live in `trading-simulator/src/`.

## Run and build

Node.js 20 or newer is sufficient. Historical replay, the paper account, lessons, labs, Risk Desk calculators, and Local guide require no API key, external chart library, or font download. A live generative coach is a separate optional server connection and is not enabled in this static release.

```sh
cd trading-simulator/src
npm test
npm run build
```

The build creates `dist/index.html`. Publish that file as `trading-simulator/index.html`. On the managed preview environment, `.openai/hosting.json` points the preview to `dist`. The built HTML embeds the application code, styles, and bundled market samples.

## What changed in Desk 5

- Market, limit, and stop entry tickets; working-order status, cancellation, fill receipts, and recorded execution outcomes.
- Position management with partial closes and editable stop-loss/take-profit levels. Entry costs and original planned risk are allocated across closed quantities, while performance statistics group completed positions.
- Fibonacci references, rectangles, and price/time measurements alongside horizontal levels and trendlines. Drawing selection, deletion, undo, and backup support remain available.
- A searchable course library with 34 modules, 103 lessons, and 170 module questions across core trading skills, risk, and U.S. tax topics.
- A Risk Desk with 48 explained decision cases and five calculators for sizing, leverage stress, losing streaks, prop drawdown rules, and tax reserves.
- The 16-week core study plan, 12 guided chart labs, video recommendations, journal, and floating Local guide remain part of the workspace.

## Trading workflow

The ticket's Buy/Long and Sell/Short tabs choose direction. Choose Market, Limit, or Stop, enter quantity and any entry price, then submit with the ticket button. The quote buttons above the chart submit market orders immediately using the currently revealed candle. Free replay permits entries without protective exits; an absent stop leaves planned loss undefined.

| Action | Behavior |
|---|---|
| Market buy/sell while flat | Opens a paper long/short at the current revealed close, adjusted for the modeled fill costs |
| Limit entry while flat | Places a resting order; a buy limit must be at or below the current price and a sell limit at or above it |
| Stop entry while flat | Places a resting order; a buy trigger must be above the current price and a sell trigger below it |
| Opposite-side Buy/Sell with an open position | Closes the entire remaining position; entry-only ticket fields do not change it into a reversal or resting order |
| Close or partial close | Closes all remaining quantity, or the smaller positive quantity entered in position management |
| Modify protection | Adds, changes, or removes the remaining position's stop and target, validated against the current revealed price |
| Reverse | Atomically closes the position and opens the opposite direction; a failed replacement leaves the account unchanged |
| Cancel | Removes the resting entry without a fill fee |

Only one position **or** one pending entry is supported. Same-side additions and multiple simultaneous orders are unavailable. Cancel a working entry before placing another. Reverse is an explicit market action and inherits no prior protection, plan, or risk budget. At the end of a dataset, existing exposure can still be closed or reduced, protection edited, and a pending entry cancelled; new entries and reversals are blocked.

Stops and targets are optional in free replay. Enabling protection creates defaults based on the current entry reference. Manually edited absolute prices remain yours and are validated at submission. Editing an open position's protection does not rewrite its original entry risk.

## Execution and account model

Free-replay sessions start at $100,000; each guided chart-lab attempt has a separate $10,000 account. New entries are capped at 1× available equity, including the entry fee. This is an entry-exposure check, not a margin or forced-liquidation system.

The default fee is 0.04% per fill. Market and protective fills apply 0.02% adverse slippage; entry-limit prices cap adverse fills at the limit. Limits and stop entries begin checking on the **next revealed bar**, including a limit placed exactly at the current price. No order can fill from an earlier or hidden candle. A touched entry limit is assumed filled, with possible opening-price improvement and no queue or available-liquidity calculation. Stop entries can fill beyond their trigger after a gap. At the modeled fill, the engine checks exposure, any supplied risk budget, and bracket validity again. A failed check rejects and cancels the order without silently resizing it.

Protective exits begin on the bar after entry or a protection edit. A stop-opening gap exits using the opening price before adverse slippage. If neither opening-gap rule resolves an ambiguous candle that touches both stop and target, the stop takes priority. Target exits use the target as a trigger reference, including a target-opening gap; they are not guaranteed limit fills. OHLC bars cannot reveal the complete intrabar path, and this model deliberately does not claim to reconstruct it. Gaps can exceed planned loss.

Manual partial closes allocate the original entry fee and planned risk in proportion to the quantity closed; the remainder retains its allocated share. Editing a stop does not retroactively improve the original R-multiple denominator. History rows show each closed quantity. Win rate, expectancy, profit factor, and average R group a position's exits and count it after its final close, so several partial exits do not become several completed trades. Realized net P&L and the closed-fill equity curve include partial results as they occur. Drawdown measures that closed-fill curve, not every unrealized intrabar mark.

Sizing includes the modeled fees and slippage. Automatic sizing rounds stock positions down to whole shares where at least one share fits; the paper model also accepts fractional quantities. Equity includes marked open P&L and entry fees already paid; an eventual exit adds its modeled exit costs. Short selling is simulated without borrow availability, borrow fees, funding, taxes, settlement restrictions, or an order book. There are no automatic liquidations, exchange maintenance tiers, futures multipliers, FX pip conversion, derivative-option pricing, partial-liquidity fills, or portfolio margin. USD and USDT are treated as equal paper units.

Changing datasets, rewinding, or starting a new paper session closes any open position at the current revealed price, cancels a pending entry, archives execution history, and resets the account. This prevents future information from being carried into a rewound trade. The journal supports current and archived sessions, plan-adherence reviews, costs, net results, R multiples, expectancy, and closed-fill drawdown. Summary metrics describe the current session. At most 50 archived sessions are retained. Trade CSV displays New York times or daily session dates.

## Risk Desk

The decision trainer contains 36 risk cases and 12 tax cases. Each has an explanation, a related lesson, and primary-source links. Attempts and whether a case has been answered correctly save with learning progress. These exercises practice decisions under stated facts; passing is not evidence that a learner can safely trade a live account.

| Calculator | What it shows | Boundary |
|---|---|---|
| Stop & size | Quantity from risk budget, stop distance, point value, costs, and quantity increment; a worse-exit comparison | Does not check buying power, product eligibility, or actual contract terms |
| Leverage stress | Linear P&L and equity under example price moves against a fixed teaching maintenance amount | Does not calculate a venue's liquidation price or model collateral haircuts, tiers, fees, or other positions |
| Losing streaks | Repeated losses as a chosen fraction of remaining equity and the gain needed to recover | Deterministic stress math, not a probability of ruin or a forecast; no additional gaps or costs |
| Prop drawdown | A hypothetical static floor or continuous trailing-equity floor and the remaining cushion | Does not reproduce any firm's current contract, payout restrictions, reset rules, or breach policy |
| Tax reserve | A user-supplied amount multiplied by a chosen planning percentage, less an amount already set aside or paid | Does not determine taxable income, tax due, estimated-payment compliance, or filing eligibility; reserving cash is not paying the IRS |

Calculator inputs do not change the paper account. Their higher-leverage or contract examples are separate educational scenarios; they do not enable leverage or derivative execution in the replay engine.

## Learning program

| Track | Modules | Lessons | Module questions |
|---|---:|---:|---:|
| Core trading skills | 16 | 48 | 80 |
| Risk and operating decisions | 12 | 36 | 60 |
| U.S. federal tax education | 6 | 19 | 30 |
| Total | 34 | 103 | 170 |

The 16-week study plan continues to cover the **16 core modules**, with 80 distinct 30–60-minute study/practice assignments, weekly deliverables, and saved evidence notes. Assigned time totals 3,535 minutes, about 59 hours; repetition and the additional risk/tax tracks require further study. A 12-question starting diagnostic and a 20-question capstone provide explanations, skill-level feedback, and linked remediation. Eight process-readiness rubric categories are explicitly self-assessed.

Twelve guided historical-stock labs place concise teaching beside a working replay chart and paper ticket. Each provides checkpoints, hints, corrective feedback, and relevant course/video links. Completion checks the stated process and does not require a profitable trade; free practice can continue after passing. Eight scored recognition exercises are accessible from the guided-lab catalog at `#labs/skills`, with individual exercises at `#labs/skills/<id>`. They provide 40 tasks per complete pass and fresh rounds on retry. Older lab aliases continue to open the related guided labs. Synthetic diagrams in the scored exercises are distinct from the attributed historical data used by guided labs and market replay.

The library also includes problem-specific practice paths, 14 official video resources with application tasks, **108 reading-source records covering 106 distinct URLs**, and a 71-term glossary. Counts come from the combined `academy.js`, `risk-course.js`, and `tax-course.js` exports. Lessons use concrete examples and See it / Try it / Review it activities; risk and tax lessons link their scenario decisions to the relevant source material.

Tax content covers U.S. federal records, capital-gain classification, wash sales, lawful planning, estimated payments, trader status, Section 475 elections, entity myths, product differences, and business records. It is general education with stated example assumptions, not an individualized filing recommendation, election, tax return, or tax calculator. State, local, non-U.S., and personal circumstances need separate review. The simulator does not apply tax lots, wash-sale adjustments, tax payments, or liquidation rules. Source dates and applicable form/publication editions are shown; verify the relevant tax-year rules before acting.

The course develops knowledge, documented practice, and professional habits. Completion does not certify professional status, provide a license, establish trader tax status, or promise employment or profitability. The sixteen-week schedule is a study structure, not a deadline for becoming ready to use real money.

## Coach status and privacy

The published site starts in **Local guide** mode. This is built-in course retrieval and deterministic replay feedback, not a generative model. It does not browse the web or interpret screenshots/video. It can recommend the supplied educational resources and explain the visible paper-account context. The guide and guided-lab grading do not control the account or submit real-money orders.

Conversation text and attachment blobs save in this browser through IndexedDB, with text-only fallback if media storage is unavailable. Chat export is separate from the workspace backup. Attachments are not sent to an external service in Local guide mode. A configured live service receives selected images or timestamped video frames only when Send is pressed; the original video and audio are not sent. Screen recording requires browser permission and stops after 60 seconds or when the drawer closes.

`backend/worker.mjs` is an optional, **undeployed** server component. No provider key is included in this repository or the public HTML. Its provider integration was tested with mocked responses only; no live AI request or backend deployment was performed for this release. Secure credential approval and deployment remain required before live web research and vision can be claimed. The browser accepts a deployed service endpoint and a separate service access token; provider credentials belong on the server. The worker restricts allowed origins and request sizes. It cannot operate the app or trade on the user's behalf.

## Workspace details

- Full-width desk with a drawing rail, dominant chart, watchlist, compact ticket, and bottom position, execution-history, working-order, and session panels.
- Sharp SVG charts with whole-app light/dark themes, configurable candle colors, candlesticks/OHLC bars/close line, volume, grid, EMA 9/21, New York core-hours reference shading, and eligible NY-day VWAP. The default chart has a white surface, blue rising candles, and near-black falling candles.
- Pan and zoom; draw horizontal levels, trendlines, Fibonacci references, rectangles, and measurements; select/delete/undo drawings; adjust the price scale; and inspect revealed-only fill markers. Drawings are visual references and do not place orders.
- `Space` plays/pauses and `N` advances a candle when not editing a field. Focus the chart for keyboard zoom/pan; `End` returns to the latest revealed bar.
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

## Persistence and privacy

The static site has no account service, trading connection, analytics, or server-side personal-data storage. Workspace data, course scores, guided/skill results, risk-case attempts, training notes, drawings, favorites, and preferences save in this browser under the existing v2-compatible storage key. Desk 5 exports retain the version-2 backup container with an interface-version marker; older Academy, Studio, and Desk backups remain supported.

New partial exits, protection changes, and pending orders use a validated execution-event ledger. Restore reconstructs economic state from those events and checks saved balances, fills, and the replay cursor; serialized P&L is not accepted as authoritative. Pending-order state and advanced drawings are included in workspace backups. Guided-lab completion records save, while the guided attempt's separate practice account is not a continuation of the main desk account.

Export progress before switching devices or clearing browser storage. Coach conversations and media use their own storage/export path. External educational links open their publishers' sites; playback and site availability can change. Public market-data requests and any explicitly configured live coach connection have the boundaries described above.

## Source files

| Files | Responsibility |
|---|---|
| `engine.js`, `order-controller.js` | Candle validation, CSV parsing, paper execution/accounting, order validation, event reconstruction, and performance statistics |
| `time.js`, `market.js`, `instruments.js` | New York/DST display; bounded public crypto adapters; bundled stock/ETF samples and provenance |
| `chart.js`, `desk.js` | Vector charts, indicators, annotations, pointer/keyboard input, ticket and position-management UI |
| `academy.js`, `risk-course.js`, `tax-course.js` | Original core/risk/tax lessons, questions, source records, glossary, and decision cases |
| `training.js`, `labs.js` | Core study assignments, assessments, self-review rubric, and scored recognition exercises |
| `guided.js`, `guided-ui.js` | Historical-chart practice scenarios, local checkpoint grading, and chart/lesson workspace |
| `risk-tools.js`, `risk-desk.js`, `course-browser.js` | Risk calculator math, scenario trainer, and searchable course navigation |
| `studio.js`, `app.js` | Market browser, training/settings UI, orchestration, journal, routes, and persistence |
| `coach.js`, `backend/worker.mjs` | Local guide/media drawer and the optional undeployed live-service adapter |
| `index.template.html`, `styles.css`, `studio.css`, `terminal.css`, `labs.css`, `guided-ui.css`, `coach.css`, `risk-desk.css` | Application shell and responsive styling |
| `build.cjs`, `tests/` | Self-contained HTML assembly and regression coverage |

## Validation

Run `npm test` to rebuild the HTML and execute the current regression suite. Coverage includes accounting, order timing and gap rejection, partial exits, protection edits, completed-position metrics, chronology/no-lookahead, data adapters, CSV validation, annotations, New York/DST behavior, backup reconstruction, course/case integrity, calculator math, and local coach/backend contracts. Optional live-provider behavior is covered by mocks, not a deployed-service claim.

See `QA.md` for the release's checked browser flows, automated results, and remaining limits. This README does not pin a test count while integration checks are still being finalized.
