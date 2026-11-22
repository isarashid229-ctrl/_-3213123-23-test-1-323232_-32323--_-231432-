# ReplayLab Desk 4 — verification record

Release date: November 21, 2026 (user-local date).

## Automated checks

181 application, chart, local coach, data, time, content, guided-lab and execution tests pass. An additional 12 server tests using mocked provider responses passed before API work was paused for credential approval. No live model request was made.

Regression coverage includes:

- Immediate Buy/Sell fills, opposite-side full closes, same-side/double-submit rejection, atomic reversal and end-of-data closing.
- Blank optional exits, manually edited brackets, refreshed default protections, risk/exposure limits, fees, slippage, next-bar activation, gaps and same-candle stop priority.
- Backup reconstruction of actual accounting, drawing/settings/guided-progress migration, same-symbol watchlist refresh and correct new-lab totals.
- Hidden future candles, entry/exit marker timing, manual price scaling, drawing selection, isolated chart instances and light/dark redraw.
- All 12 labs through real engine actions, independent accounts, final checkpoint revalidation, saved completion and post-completion free practice.
- Local course retrieval, no fake media interpretation, attachment limits, Blob persistence, text fallback, history recovery and teardown.
- CSV validation, data-source failure preservation, public-candle continuation, stock sample metadata and New York DST transitions.

## Browser checks

- Compared the live TradingView chart layout with the user's reference screenshots and official TradingView/FX Replay guidance.
- Bought a stock paper position from the quote button, stepped replay, reversed it, closed by opposite-side Buy, opened a fresh short and closed it manually. Account figures and fill markers updated.
- Checked the full-width desktop terminal and both themes; corrected dark input/title contrast and default session tint.
- Completed the protective-bracket lab: deliberately wrong answer, explanatory retry, correct answer, real 5-share bracket order and verified completion.
- Opened the floating coach, asked about repeated stop-outs, received a relevant course explanation and official video links, reloaded and verified the saved thread.
- Added a supplied screenshot using the actual browser file chooser. The attachment remained local and the UI identified Local guide's inability to interpret media.
- Checked a 390px mobile frame: 375px available content width and 375px scroll width, with all navigation destinations available.
- Checked course-to-lab links and saved course progress.

## Practical limits

Historical samples are not live market feeds. Stock intraday samples have tick-count volume; VWAP is disabled for those datasets. Daily samples are context studies. One-position paper execution does not model a real order book, borrow availability, funding, taxes, or futures multipliers.

Native screen capture depends on browser permissions/support and was not initiated during QA. Server-backed web research and screenshot/video interpretation are not enabled or live-tested. Local feedback is clearly labeled and never presented as a connected AI model.

The course is a structured practice program; completion does not certify professional status or promise profitability.
