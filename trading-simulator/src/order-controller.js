/* ReplayLab paper-order controller. Load after engine.js.
 *
 * ReplayOrders.preview(account, request) validates without changing the account.
 * ReplayOrders.execute(account, request) validates the whole transaction before
 * committing it to the same account object. Both return:
 * { action, type, position, trade, order?, message }.
 * Types: opened, closed, reduced, reversed, modified, pending, cancelled.
 * `position` is the resulting active position or null; `trade` is the closed
 * quantity's journal row or null. Validation throws a readable Error with a
 * stable `code`.
 *
 * Request: { action: 'buy'|'sell'|'close'|'reverse'|'modify'|'cancel',
 *            price, time, barIndex, qty?, stop?, target?, riskBudget?, plan?,
 *            tags?, allowEntry?, orderType?:'market'|'limit'|'stop',
 *            orderPrice?, orderId? }.
 * Supply the CURRENT REVEALED candle's close/time/index, never a future candle.
 * Blank optional exit fields are null. A supplied riskBudget requires a stop.
 * `allowEntry: false` blocks new/reversed positions at the end of a replay but
 * never prevents closing, reducing, editing protection or cancelling.
 *
 * Buy/Sell opens from flat. Against an existing opposite position, it closes
 * that ENTIRE position, ignoring all entry-only fields; it never reverses it.
 * A Close action with an explicit smaller qty reduces the position. Opposite
 * Buy/Sell still closes fully. Same-side additions are unsupported. Reverse is an explicit,
 * atomic close plus opposite entry, using current quantity if qty is omitted.
 * It never inherits the previous position's stop, target, plan, or risk budget.
 * Fees/slippage and the 1x exposure ceiling come from ReplayEngine unchanged.
 * Limit/stop entries use ReplayEngine's pending-order model and execute through
 * processBar on later revealed bars. This controller has no real-money actions.
 */
(function (root, factory) {
  const engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.ReplayEngine;
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReplayOrders = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  if (!E) throw new Error('ReplayEngine must load before ReplayOrders.');

  const empty = value => value === undefined || value === null || (typeof value === 'string' && !value.trim());
  const optional = value => empty(value) ? null : value;
  const opposite = side => side === 'long' ? 'short' : 'long';
  const format = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 12 });
  const pnl = value => (value >= 0 ? '+' : '−') + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function copyAccount(account) {
    if (!account || !Array.isArray(account.trades)) fail('INVALID_ACCOUNT', 'The paper account is invalid. Restore a valid backup or start a new session.');
    const position = account.position;
    if (position && (!['long', 'short'].includes(position.side) || !Number.isFinite(position.qty) || position.qty <= 0)) fail('INVALID_ACCOUNT', 'The saved paper position is invalid.');
    return Object.assign({}, account, {
      // Existing trade objects are never changed by the engine. Retain their
      // review metadata while keeping its appended trade list independent.
      trades: account.trades.slice(),
      events: Array.isArray(account.events) ? account.events.slice() : account.events,
      pendingOrders: (account.pendingOrders || []).map(order => ({ ...order, tags: Array.isArray(order.tags) ? order.tags.slice() : [] })),
      position: position ? Object.assign({}, position, { tags: Array.isArray(position.tags) ? position.tags.slice() : [] }) : null
    });
  }

  function classify(position, action) {
    if (!['buy', 'sell', 'close', 'reverse', 'modify', 'cancel'].includes(action)) fail('INVALID_ACTION', 'Choose Buy, Sell, Close, Reverse, Modify protection, or Cancel order.');
    if (action === 'cancel') return 'cancelled';
    if (action === 'modify') { if (!position) fail('NO_POSITION', 'There is no open paper position to modify.'); return 'modified'; }
    if (action === 'close' || action === 'reverse') {
      if (!position) fail('NO_POSITION', 'There is no open paper position to ' + action + '.');
      return action === 'close' ? 'closed' : 'reversed';
    }
    if (!position) return 'opened';
    const side = action === 'buy' ? 'long' : 'short';
    if (position.side === side) fail('POSITION_ALREADY_OPEN', 'A paper ' + side + ' is already open. Use ' + (side === 'long' ? 'Sell' : 'Buy') + ' to close it, or Reverse to change direction.');
    return 'closed';
  }

  function readable(error, request, side, account) {
    if (error.code) return error;
    const message = error.message || 'The paper order could not be filled.';
    let code = 'INVALID_ORDER', detail = message;
    const entryReference = ['limit', 'stop'].includes(request.orderType) ? Number(request.orderPrice) : Number(request.price);
    const fill = request.orderType === 'limit' ? entryReference : entryReference * (1 + (side === 'long' ? 1 : -1) * account.slippageRate);
    if (/A long stop must be/.test(message)) {
      code = 'INVALID_STOP';
      detail = 'Stop must be ' + (side === 'long' ? 'below' : 'above') + ' the current ' + side + ' fill of ' + format(fill) + '. Reset the brackets or enter a new stop.';
    } else if (/A long target must be/.test(message)) {
      code = 'INVALID_TARGET';
      detail = 'Target must be ' + (side === 'long' ? 'above' : 'below') + ' the current ' + side + ' fill of ' + format(fill) + '. Reset the brackets or enter a new target.';
    } else if (/exceeds the 1× equity/.test(message)) {
      code = 'EXPOSURE_LIMIT';
      detail = 'Quantity exceeds the 1× equity limit including the entry fee. Reduce the quantity. No order was filled.';
    } else if (/exceeds the risk budget/.test(message)) {
      code = 'RISK_LIMIT';
      detail = 'Planned loss including fees and slippage exceeds the selected risk budget. Recalculate size or reduce the quantity. No order was filled.';
    } else if (/[Qq]uantity/.test(message)) code = 'INVALID_QUANTITY';
    else if (/stop is required to enforce/.test(message)) code = 'STOP_REQUIRED';
    else if (/Stop price|The stop must/.test(message)) code = 'INVALID_STOP';
    else if (/Target price|The target must/.test(message)) code = 'INVALID_TARGET';
    else if (/pending entry|pending-entry/.test(message)) code = 'PENDING_ORDER';
    const result = new Error(detail);
    result.code = code;
    return result;
  }

  function prepare(account, input) {
    const request = input || {}, draft = copyAccount(account), previous = draft.position;
    let type = classify(previous, request.action);
    const orderType = request.orderType || 'market';
    // An opposite-side click always closes the existing position. Stale entry
    // ticket fields cannot turn that close into a pending order or block it.
    if (type === 'opened' && !['market', 'limit', 'stop'].includes(orderType)) fail('INVALID_ORDER_TYPE', 'Choose a market, limit, or stop entry.');
    if (type === 'opened' && orderType !== 'market') {
      type = 'pending';
    }
    if (request.allowEntry !== undefined && typeof request.allowEntry !== 'boolean') fail('INVALID_ORDER', 'allowEntry must be true or false.');
    if (['opened', 'reversed', 'pending'].includes(type) && request.allowEntry === false) fail('DATA_ENDED', 'This dataset has ended. Start a new replay before opening or reversing a position. You can still close an open position.');
    const side = type === 'reversed' ? opposite(previous.side) : type === 'modified' ? previous.side : request.action === 'buy' ? 'long' : 'short';
    const exit = { price: request.price, time: request.time, barIndex: request.barIndex, qty: request.action === 'close' ? request.qty : undefined, reason: type === 'reversed' ? 'reverse' : request.action === 'close' ? 'manual' : 'opposite action' };
    const pending = draft.pendingOrders[0];
    const reference = previous || pending || draft.trades[draft.trades.length - 1];
    if (reference) {
      const lastIndex = previous ? Math.max(previous.entryBarIndex, previous.lastProcessedBarIndex || 0) : pending ? pending.lastProcessedBarIndex : reference.exitBarIndex;
      const lastTime = previous ? previous.entryTime : pending ? pending.submittedTime : reference.exitTime;
      if (Number(request.barIndex) < lastIndex || E.parseTime(request.time) < lastTime) fail('STALE_REPLAY', 'The order belongs to an earlier replay candle. Use the current revealed candle, or start a fresh replay to rewind.');
    }
    let trade = null, position = null, order = null;
    try {
      if (type === 'modified') position = E.modifyPosition(draft, { stop: request.stop, target: request.target, price: request.price, time: request.time, barIndex: request.barIndex });
      else if (type === 'cancelled') order = E.cancelOrder(draft, { orderId: request.orderId, time: request.time, barIndex: request.barIndex });
      else if (type === 'pending') order = E.placeOrder(draft, { type: orderType, side, qty: request.qty, orderPrice: request.orderPrice, price: request.price, time: request.time, barIndex: request.barIndex, stop: optional(request.stop), target: optional(request.target), riskBudget: optional(request.riskBudget), plan: request.plan, tags: request.tags });
      else {
      if (type === 'closed' || type === 'reversed') trade = E.closePosition(draft, exit);
      if (type === 'opened' || type === 'reversed') position = E.openPosition(draft, {
        side: side, qty: type === 'reversed' && empty(request.qty) ? previous.qty : request.qty,
        price: request.price, time: request.time, barIndex: request.barIndex,
        stop: optional(request.stop), target: optional(request.target), riskBudget: optional(request.riskBudget),
        plan: request.plan, tags: request.tags
      });
      if (type === 'closed' && draft.position) { type = 'reduced'; position = draft.position; }
      }
    } catch (error) { throw readable(error, request, side, draft); }
    let message;
    if (type === 'opened') message = 'Paper ' + request.action + ' filled: ' + format(position.qty) + ' units at ' + format(position.entryPrice) + '. ' + (position.stop === null ? 'No stop attached.' : 'Protective stop attached.');
    else if (type === 'closed') message = 'Paper ' + trade.side + ' closed: ' + format(trade.qty) + ' units at ' + format(trade.exitPrice) + '. Net ' + pnl(trade.netPnl) + ' after costs.';
    else if (type === 'reversed') message = 'Paper position reversed: closed ' + trade.side + ' (' + pnl(trade.netPnl) + ' net), opened ' + position.side + ' ' + format(position.qty) + ' units at ' + format(position.entryPrice) + '. ' + (position.stop === null ? 'No stop attached.' : 'Protective stop attached.');
    else if (type === 'reduced') message = 'Closed ' + format(trade.qty) + ' units of the paper ' + trade.side + ': ' + pnl(trade.netPnl) + ' net after allocated costs. ' + format(position.qty) + ' units remain open.';
    else if (type === 'modified') message = 'Protection updated for the remaining ' + format(position.qty) + ' units. Original entry risk is unchanged.';
    else if (type === 'pending') message = 'Pending ' + order.side + ' ' + order.type + ' placed: ' + format(order.qty) + ' units at ' + format(order.orderPrice) + '. It starts checking on the next revealed bar.';
    else message = 'Pending ' + order.type + ' entry cancelled. No fill fee was charged.';
    return { draft: draft, receipt: { action: request.action, type: type, position: position, trade: trade, ...(order ? { order } : {}), message: message } };
  }

  function preview(account, request) {
    const result = prepare(account, request).receipt;
    if (result.type === 'opened') result.message = 'Ready to open a paper ' + result.position.side + ': ' + format(result.position.qty) + ' units at a modeled fill of ' + format(result.position.entryPrice) + '.';
    else if (result.type === 'closed') result.message = 'Ready to close the paper ' + result.trade.side + ': ' + format(result.trade.qty) + ' units; modeled net ' + pnl(result.trade.netPnl) + ' after costs.';
    else if (result.type === 'reversed') result.message = 'Ready to close the paper ' + result.trade.side + ' and open ' + result.position.side + ' ' + format(result.position.qty) + ' units at a modeled fill of ' + format(result.position.entryPrice) + '.';
    else if (result.type === 'reduced') result.message = 'Ready to close ' + format(result.trade.qty) + ' units; ' + format(result.position.qty) + ' would remain open.';
    else if (result.type === 'modified') result.message = 'Ready to update stop/target protection for the open position.';
    else if (result.type === 'pending') result.message = 'Ready to place a ' + result.order.side + ' ' + result.order.type + ' entry for ' + format(result.order.qty) + ' units at ' + format(result.order.orderPrice) + '.';
    else result.message = 'Ready to cancel the pending entry.';
    return result;
  }

  function execute(account, request) {
    const result = prepare(account, request);
    // Both reversal fills have passed validation before any live state changes.
    account.balance = result.draft.balance;
    account.position = result.draft.position;
    account.trades = result.draft.trades;
    account.pendingOrders = result.draft.pendingOrders;
    account.events = result.draft.events;
    account.executionVersion = result.draft.executionVersion;
    return result.receipt;
  }

  return Object.freeze({ preview: preview, execute: execute });
});
