# ReplayLab — Public historical market replay

**Website:** https://isarashid229-ctrl.github.io/_-3213123-23-test-1-323232_-32323--_-231432-/trading-simulator/

**Repository folder:** https://github.com/isarashid229-ctrl/_-3213123-23-test-1-323232_-32323--_-231432-/tree/main/trading-simulator

ReplayLab is a static GitHub Pages web application for educational chart replay and simulated trades. It works without an account, paid plan, or private API key.

## Start trading practice

1. Open the website.
2. Leave **BTCUSDT**, **15m**, and the optional date blank.
3. Click **Load data** or **Load BTC/USDT archive**. The browser loads the bundled **March 2026 BTC/USDT 15-minute archive** from this repository, requiring no third-party market API.
4. Click **Play** or step forward candle by candle. Use simulated Buy/Short and Close to record trades.
5. To attempt fresh exchange candles, click **Latest candles**. Exchange APIs are publicly available but may be blocked by region, browser, CORS, or rate limits.
6. You can select other crypto pairs/timeframes or a historical start date and click **Load data** to try real exchange sources. To import stocks, choose **Import CSV** with UTC OHLCV columns.

## March 2026 archive

- File: `data/btcusdt-15m-2026-03.csv`
- 2,976 chronological UTC candles, from March 1 through March 31, 2026.
- Schema: `time,open,high,low,close,volume`, where `time` is Unix seconds.
- Source: [publicly shared Binance BTCUSDT March 2026 15m history](https://github.com/grayson8geraldo/triq/blob/main/BTCUSDT-15m-2026-03.csv); transformed by selecting numeric OHLCV and timestamp columns. The original data source should be verified before research or financial conclusions. It is **not** simulated price data.
- Historical archive is **not live data**. The default view deliberately loads this archive to make first-run replay function without an exchange API. For recent data use **Latest candles**.

## Data providers and limitations

Live online crypto retrieval tries Coinbase Exchange, Kraken and two Binance public market-data endpoints. Only successfully retrieved OHLCV data is displayed. Different markets and exchanges can have different prices or volumes; products and timeframes are not silently substituted. Kraken returns at most about 720 recent OHLC records; Coinbase's endpoint has its own supported granularities and historical request limits. Not every interval works for every provider.

Other equities, ETFs and futures **do not** have integrated historical feeds. For those markets, import a CSV with `time,open,high,low,close,volume` or `date,open,high,low,close,volume`. Use UTC ISO 8601 timestamps or Unix seconds for accurate replay.

## Features

- Step-by-step candlestick replay with playback speed, slider, replay restart, zoom and pan.
- EMA 9/21 and horizontal drawing levels.
- Local long/short simulated market orders, P&L calculations and trade history export.
- Paper account starts at $100,000; default assumed fee is 0.04% and adverse slippage 0.02% per fill.
- No actual broker orders, no leverage above 1× modeled notional, no limit or stop orders, and no realistic order-book fills.
- Local browser session storage; it might be cleared by browser settings.

## Troubleshooting

- If you still see the initial overlay over the chart, hard-reload the GitHub Pages tab (Ctrl+Shift+R on Windows or Cmd+Shift+R on Mac) to pick up the CSS fix.
- The first **Load data** click with the default symbol/timeframe should load the bundled archive immediately.
- **Latest candles** depends on external APIs; if all sources fail, the site reports the error and the historical archive can still be replayed.
- All paths are relative to this `trading-simulator/` directory so hosting from the GitHub Pages subpath works.

**Disclaimer:** Educational practice only, not investment advice. Real historical data can have gaps and errors; modeled execution is not an actual fill.
