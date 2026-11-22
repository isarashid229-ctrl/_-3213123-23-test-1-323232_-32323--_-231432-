# ReplayLab Desk 5 — verification record

Release date: November 21, 2026 (user-local date).

## Automated checks

The release passes 257 automated tests: 245 application, accounting, chart, course, local-coach, data, time and guided-lab checks, plus 12 existing optional-server tests using mocked provider responses. No live model request or backend deployment was performed. Run `npm test` from `trading-simulator/src` to rebuild the self-contained HTML and run the suite.

Regression coverage includes:

- Market Buy/Sell, opposite-side full closing, atomic reversal, same-side rejection, optional protection, and closing at the end of a dataset.
- Limit and stop entries that wait for subsequent bars; favorable and adverse gaps; limit-price bounds; rechecked exposure/risk; cancellation without a fee; rejected triggers; protective exits; and ambiguous-candle handling.
- Partial-exit allocation of entry costs and original risk, preserved remaining positions, protection edits, completed-position statistics, and exact ledger reconstruction after reload/restore.
- Persistent receipts for automatic fills, rejected entries and protective closes. Working-order type, price and quantity restore correctly.
- Hidden-future protection for chart prices, indicators, drawings, order lines and trade markers; precise SVG rendering; keyboard and pointer drawing; price scaling; Fibonacci references, rectangles and measurements.
- Chart action targets retain pointer events and survive pointer movement/down/up until click. Management and closing callbacks are tested separately from plot panning.
- All 12 guided historical-chart labs through actual engine actions, independent accounts, corrective feedback, final checkpoint revalidation, saved completion and continued free practice.
- Integrated content counts: 34 modules, 103 lessons, 170 module questions and 48 unique risk/tax cases. All module/lesson/source/case/lab references resolve; extension loading is additive and idempotent in either order.
- The 16-week, 80-session core plan, 12-question diagnostic, 20-question capstone and eight-category readiness rubric remain intact.
- Independent risk/tax worked-example arithmetic, five stress/planning calculators, bounded case-progress restoration, and offline coach retrieval for liquidation and wash-sale questions.
- CSV validation, provider failures and source-pinned continuation, bundled historical-data metadata/digests, stock sizing, New York DST, backup migration, and asynchronous restore protection.

## Browser checks for Desk 5

- Inspected the public TradingView chart and order-panel workflow and its official order/replay documentation as design references.
- Opened an AAPL market long, advanced bars, edited its stop/target, closed one share of a four-share position, verified the remaining three shares, and closed the remainder.
- Placed a two-share limit order, confirmed no entry fee before execution, reloaded it, advanced to a qualifying later bar, and verified its fill at the stated limit. The Orders panel showed Filled.
- Opened Manage through the chart control and closed the position through the chart's close control. Confirmed the resulting cost-adjusted receipt and empty position table.
- Placed and cancelled another limit order, verified Cancelled in resting-entry history and no fee, then reloaded to confirm the flat account and balance persisted.
- Corrected an SVG pointer-events inheritance issue and redraw timing that prevented chart buttons from receiving clicks. Verified actual pointer interaction after the fix.
- Answered a risk case incorrectly, received the explanation, retried correctly, and verified the saved attempt count and passed state after reload.
- Searched the complete curriculum for liquidation and wash sales, opened the matching lessons, completed the five-question wash-sale check at 100%, and verified per-answer explanations.
- Checked leverage and tax-reserve results in the UI and stop-sizing results on a narrow screen. Calculator assumptions remain visible.
- Re-exposed all eight scored recognition exercises through Labs → Recognition exercises, and opened the actual position-sizing exercise.
- Inspected the new risk workspace in both themes. Corrected dark-table/select contrast and a mobile navigation height inherited from older styling.
- Checked a 390px mobile frame: 375px available width and 375px scroll width for risk decisions, sizing tools, course search and a tax lesson. Navigation ends above the page heading.
- Inspected browser error logs; no application errors remained. Browser-extension metadata messages were unrelated to the site.

## Retained functionality

Prior Desk 4 checks covered the guided bracket lab, actual Buy/Sell/Reverse/Close actions, coach thread persistence, and a supplied screenshot attached through the browser file chooser. The corresponding regression tests remain part of this release. Native screen recording was not initiated during QA; it requires browser support and permission.

## Practical limits

This is a historical educational simulator. It does not implement every TradingView feature, live exchange feeds, a brokerage connection, Pine Script, a tick order book, borrow availability, funding, actual margin liquidation, futures multipliers or options execution. Market and stop fills use modeled adverse slippage; limits obey their price cap. Requested quantities fill in full when the teaching model permits execution. Real queue position, partial entry fills, exchange latency and intrabar sequencing are unknown from OHLC data. Separate risk exercises explain those omissions.

One position or one pending entry is allowed; entry notional is capped at 1× equity. The risk calculators are hypothetical tools, and the tax-reserve calculator is not a tax return or estimated-payment determination. Tax lessons concern U.S. federal concepts and do not replace individual product, state or residency review.

Local guide provides course retrieval and replay-context explanations. It does not perform live web research or interpret attached media; the optional server component remains undeployed. Completion records knowledge and practice, not professional certification or a promise of profitability.
