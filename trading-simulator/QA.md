# Studio 3 validation — November 21, 2026

## Automated result

`node build.cjs && node --test tests/*.test.cjs`: **91 passed, 0 failed**.

| Suite | Tests | Material behavior checked |
|---|---:|---|
| App integration | 24 | Account/persistence integrity, public data readiness, source-pinned append, invalid-data atomicity, old backups, settings, training, assessments, daily dates, tiny prices, restore concurrency and direction/speed UI |
| Chart | 14 | SVG/vector output, sharp 14px labels, zero access to future bars, indicators, DST, ticks versus volume, daily semantics, modes, bounds, pan/zoom, annotations, keyboard and cancellation cleanup |
| Curriculum/content | 7 | Stable IDs, complete modules and weeks, answer keys, explanations, reference mappings, source URLs and self-contained built page |
| Paper engine | 15 | OHLC/CSV validation, fees/slippage, sizing, 1× exposure, long/short accounting, entry-bar protection, stop/target ambiguity, gaps and closed-trade statistics |
| Public market adapters | 15 | Pair/quote integrity, provider fallback, exact dates, New York start inputs, committed candles, continuation, timeouts and competitor cancellation |
| New York time | 7 | EST/EDT, UTC-date rollover, nonexistent/repeated DST wall times, date validation and core-hour boundaries |
| Bundled instruments | 5 | Actual catalog/timeframe coverage, OHLC checks, data digests, source dates, tick-volume definitions and next-bar exits |
| Studio | 4 | Safe chart preference restoration, bounded training progress, exact assessment scoring and timeframe inference |

## Browser review

Checked the rendered application at desktop width and in a 390 × 844 mobile frame (375px content width after the vertical scrollbar). Practice and Training layouts had no horizontal content overflow.

Verified through the real UI:

- Blue/black SVG candles and price/axis readability; larger focused chart.
- Switching to a dark close-line chart, then restoring the blue/black preset.
- AAPL intraday sample selection, bar stepping and Eastern daylight time.
- Searching SPY, loading its daily study and displaying the source session date without a fabricated clock time.
- Weekly completion and written notes surviving reload.
- Twelve-question diagnostic submission, 25% result for an intentionally mixed answer set, twelve explanations and skill-specific review links.
- Mobile chart and training navigation, including access to the starting assessment.
- AAPL automatic sizing, a 138-share paper long, advancing one bar, manual close and journal reconciliation: −$45.05 net with $35.55 modeled fees and New York entry-bar time.
- No application-origin console errors during the stock trade and journal flow.

Browser extension metadata warnings were observed; they were emitted by the browser extension, not ReplayLab application code.

## Fixed regressions

A saved short direction now agrees with the order controls after restore. Public data loading re-enables continuation controls. Pending requests cannot mix an old market into a restored backup. An intentionally empty favorites list stays empty. Invalid replacement data leaves the current account intact. Date-only CSV rows preserve their New York session date through DST. Very small positive CSV prices retain visible precision and usable protective levels. Older Academy progress and account records remain compatible.

## Practical limits

Tests do not make third-party sample data independently verified, guarantee public API access in every region, or prove real-world execution quality. External video pages were checked as publisher resources, but playback inside every user's browser was not tested. No real-money transaction or brokerage integration is present. Paper results and course completion do not predict professional profitability.
