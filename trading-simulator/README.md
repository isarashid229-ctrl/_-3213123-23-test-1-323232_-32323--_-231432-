# ReplayLab — Trading Replay Simulator

Public site: https://isarashid229-ctrl.github.io/_-3213123-23-test-1-323232_-32323--_-231432-/trading-simulator/

This is an isolated static website under the existing repository. It does not modify the existing home page.

## Features
- Historical candlestick chart and step-by-step replay (including speeds, scrubbing, restart, EMA 9/21 and horizontal levels)
- Simulated long and short market trades, journal, export to CSV and a local $100,000 starting balance
- Public Binance.US / Binance Public Data historical crypto candles when network/CORS/region allows
- Optional UTC historical start date, symbol and interval selection; load additional candles as available
- Import real OHLCV CSV files for stocks, ETFs, or other instruments
- Local browser save/restore of replay and trades

## Data and execution limitations
**Not an exact TradingView reproduction.** Free built-in equities data and all-market minute/second historical archives are **not** provided. Other asset classes need user-supplied CSV files. Historical coverage is limited by provider and imported files. Replay usage itself has no per-day session cap.

Paper orders are modeled at the last known candle close using fixed 0.04% transaction fees and 0.02% adverse slippage per fill; these are **not actual order-book fills**, and no live orders are sent. Only one position may be open at a time, and modeled notional is capped at 1× equity. No stop, limit, margin or automated strategy orders.

No API keys or accounts are required or embedded. Session data is local to the browser, subject to browser storage restrictions.

## Files
The public `index.html` is a self-contained HTML/CSS/JavaScript build, so it works directly on GitHub Pages without a build process. A separate readable multi-file source archive was prepared from the uploaded Next.js prototype.

**Disclaimer:** For education and practice only, not financial advice or a brokerage service.
