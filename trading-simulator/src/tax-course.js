/* ReplayLab U.S. federal tax education. Load after academy.js.
 * Original lessons and decision cases; official IRS references checked 2026-11-21.
 * This extension teaches records and decisions. It does not calculate a tax
 * return, establish tax status, submit an election, or model tax or liquidation.
 */
(function (root) {
  'use strict';
  const academy = root.ReplayAcademy;
  if (!academy || !Array.isArray(academy.modules) || !Array.isArray(academy.sources)) {
    throw new Error('Load academy.js before tax-course.js.');
  }
  const CHECKED = '2026-11-21';
  const scope = 'U.S. federal education for individual learners. State, local, non-U.S., entity-specific, and personal filing outcomes require separate review. The examples state their assumptions; they are not a personal tax calculation or a recommendation to make an election.';
  const practiceNote = 'The linked chart lab rehearses paper-order records. Tax answers are checked in the decision cases and quizzes; the simulator does not apply tax lots, wash sales, tax payments, or liquidation rules.';
  const sec = (heading, text, options = {}) => ({ heading, text, ...options });
  const q = (prompt, choices, answer, explanation, sourceIds) => ({ prompt, choices, answer, explanation, sourceIds });
  function lesson(id, title, sections, takeaway, guidedLabId, seeIt, tryIt, reviewIt, successCriteria, sourceIds) {
    return {
      id, title, sections, takeaway, sourceIds,
      practiceFlow: { seeIt, tryIt, reviewIt },
      practice: {
        guidedLabId, title: 'Build the record, then solve the tax case',
        task: tryIt, successCriteria, scopeNote: practiceNote
      }
    };
  }
  const sources = [
    ['tax-irs-capital', 'Topic 409: Capital gains and losses', 'https://www.irs.gov/taxtopics/tc409'],
    ['tax-irs-basis', 'Topic 703: Basis of assets', 'https://www.irs.gov/taxtopics/tc703'],
    ['tax-irs-8949', 'About Form 8949: Sales and other dispositions of capital assets', 'https://www.irs.gov/forms-pubs/about-form-8949'],
    ['tax-irs-8949-instructions', 'Instructions for Form 8949 (2025)', 'https://www.irs.gov/instructions/i8949'],
    ['tax-irs-records', 'Topic 305: Recordkeeping', 'https://www.irs.gov/taxtopics/tc305'],
    ['tax-irs-stock-lots', 'Stocks: basis and specific-share identification questions', 'https://www.irs.gov/faqs/capital-gains-losses-and-sale-of-home/stocks-options-splits-traders'],
    ['tax-irs-550', 'Publication 550 (2025): Investment income and expenses', 'https://www.irs.gov/publications/p550'],
    ['tax-irs-schedule-d', 'Instructions for Schedule D (2025)', 'https://www.irs.gov/instructions/i1040sd'],
    ['tax-irs-ira-wash', 'Revenue Ruling 2008-5: Wash sales and IRA purchases', 'https://www.irs.gov/pub/irs-drop/rr-08-05.pdf'],
    ['tax-irs-1099b', 'Instructions for Form 1099-B (2025): Broker wash-sale reporting', 'https://www.irs.gov/pub/irs-pdf/i1099b--2025.pdf'],
    ['tax-irs-estimated', 'Estimated tax: Frequently asked questions', 'https://www.irs.gov/faqs/estimated-tax'],
    ['tax-irs-505', 'Publication 505 (2026): Withholding and estimated tax', 'https://www.irs.gov/publications/p505'],
    ['tax-irs-niit', 'Topic 559: Net investment income tax', 'https://www.irs.gov/taxtopics/tc559'],
    ['tax-irs-ira-contributions', 'Publication 590-A (2025): IRA contributions and compensation', 'https://www.irs.gov/publications/p590a'],
    ['tax-irs-traders', 'Topic 429: Traders in securities', 'https://www.irs.gov/taxtopics/tc429'],
    ['tax-irs-4797', 'Instructions for Form 4797 (2025): Traders with a mark-to-market election', 'https://www.irs.gov/instructions/i4797'],
    ['tax-irs-3115', 'About Form 3115: Change in accounting method', 'https://www.irs.gov/forms-pubs/about-form-3115'],
    ['tax-irs-election', 'Revenue Procedure 99-17 in Internal Revenue Bulletin 1999-7', 'https://www.irs.gov/pub/irs-irbs/irb99-07.pdf'],
    ['tax-irs-llc', 'Single-member limited liability companies', 'https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies'],
    ['tax-irs-entities', 'Entity classification questions', 'https://www.irs.gov/faqs/small-business-self-employed-other-business/entities'],
    ['tax-irs-461', 'Instructions for Form 461 (2025): Limitation on business losses', 'https://www.irs.gov/instructions/i461'],
    ['tax-irs-6781', 'Form 6781 and instructions (2025): Section 1256 contracts and straddles', 'https://www.irs.gov/pub/irs-pdf/f6781.pdf'],
    ['tax-irs-6781-about', 'About Form 6781', 'https://www.irs.gov/forms-pubs/about-form-6781'],
    ['tax-irs-digital', 'Digital assets: Federal tax treatment and records', 'https://www.irs.gov/filing/digital-assets'],
    ['tax-irs-1099da', 'Understanding Form 1099-DA', 'https://www.irs.gov/businesses/understanding-your-form-1099-da'],
    ['tax-irs-544', 'Publication 544 (2025): Sales and other dispositions of assets', 'https://www.irs.gov/publications/p544'],
    ['tax-irs-contractors', 'Form 1099-NEC and independent contractors', 'https://www.irs.gov/faqs/small-business-self-employed-other-business/form-1099-nec-and-independent-contractors'],
    ['tax-irs-expenses', 'Schedule C recordkeeping and ordinary, necessary expenses', 'https://www.irs.gov/tax-professionals/eitc-central/recordkeeping'],
    ['tax-irs-business-records', 'Publication 583: Starting a business and keeping records', 'https://www.irs.gov/publications/p583'],
    ['tax-irs-home', 'Topic 509: Business use of home', 'https://www.irs.gov/taxtopics/tc509'],
    ['tax-irs-preparer', 'Tips for choosing a tax professional', 'https://www.irs.gov/newsroom/tips-for-choosing-a-tax-professional']
  ].map(([id, title, url]) => ({ id, title, url, publisher: 'Internal Revenue Service', checked: CHECKED }));

  const modules = [
    {
      id: 'tax-records', title: 'Turn trading records into a tax trail',
      subtitle: 'Separate cash, performance, tax character, and the documents that support a return.',
      level: 'Professional skills · U.S. tax', minutes: 32, labId: 'expectancy', guidedLabId: 'review-trade',
      skills: ['Classify account events', 'Reconcile proceeds and adjusted basis', 'Build a complete reporting packet'],
      sourceIds: ['tax-irs-capital', 'tax-irs-basis', 'tax-irs-stock-lots', 'tax-irs-8949', 'tax-irs-8949-instructions', 'tax-irs-records', 'tax-irs-traders'],
      lessons: [
        lesson('tax-records-1', 'A cash balance is not a taxable-income figure', [
          sec('State the scope first', scope + ' Begin by identifying the taxpayer, account type, asset, and tax year. A paper account does not create an actual taxable sale.'),
          sec('Name the kind of result', 'An investor’s sale of stock held as a capital asset generally creates capital gain or loss. Holding it one year or less normally makes the result short-term; more than one year normally makes it long-term. Net short-term gains use ordinary income rates, but that does not make them wages or automatically self-employment income.', { sourceIds: ['tax-irs-capital', 'tax-irs-traders'] }),
          sec('Keep the cash story separate', 'Use three columns: external cash transfers, completed transactions, and open positions. A withdrawal is not a substitute for identifying the underlying taxable event. Do not enter every incoming bank transfer as trading profit.', { example: 'A learner deposits $5,000, realizes an $800 stock gain, and withdraws $300. The $5,000 deposit and $300 withdrawal explain cash movement; the $800 transaction result is the starting point for tax-character and adjustment review. A remaining open gain needs its own accounting-method review.', bullets: ['Label transfers so they are not counted twice.', 'Record whether a result is realized or only a current mark.', 'Keep ordinary rates, capital character, and self-employment tax as different questions.'] })
        ], 'Identify the transaction and tax character before applying any rate.', 'equity-check',
        'Cash transferred, economic profit, and taxable income can be different numbers.',
        'Use the open-account lab to observe balance and equity. Then make a three-column event log for the deposit, gain, and withdrawal example; solve tax-case-1.',
        'Explain each amount without treating a transfer as a new gain or a withdrawal as a deduction.',
        ['Classify every example event before doing a tax calculation.', 'State which personal facts are deliberately absent from the exercise.'], ['tax-irs-capital', 'tax-irs-traders']),
        lesson('tax-records-2', 'Reconstruct a tax lot from the original documents', [
          sec('Start with the acquisition', 'Stock basis generally includes purchase cost and acquisition charges. The broker’s lot identification matters: adequate identification can establish the particular shares sold; where the required identification is absent, FIFO generally determines the stock shares used. Do not casually substitute an average for ordinary stock lots.', { sourceIds: ['tax-irs-basis', 'tax-irs-stock-lots'] }),
          sec('Reconcile a complete round trip', 'Keep gross prices, acquisition costs, selling costs, and later adjustments visible. Match the treatment of each cost to the statement; subtracting the same fee twice would manufacture a smaller gain.', { example: 'Buy 100 shares at $50 with a $5 acquisition fee: initial basis $5,005. Sell for $5,500 with a $5 selling fee: economic net proceeds $5,495. Before other adjustments, gain is $490. The exact Form 8949 entries follow the statement and applicable adjustment instructions.', sourceIds: ['tax-irs-8949-instructions'] }),
          sec('Make the record reproducible', 'Create one row per identified lot. Preserve the original confirmation beside the row and keep a separate adjustment note. Mark missing information as unresolved instead of guessing.', { bullets: ['Account, owner, security identifier, quantity, acquisition and disposal dates.', 'Original cost, acquisition costs, proceeds, selling costs, and evidence of the chosen lot.', 'Basis changes, wash-sale links, document names, and who reviewed an unresolved item.'] })
        ], 'A useful number can be traced back to its lot, costs, and evidence.', 'review-trade',
        'In the worked round trip, $5,495 minus $5,005 is $490; the unadjusted $500 price move is incomplete.',
        'Finish one paper-trade review, then build the example lot row using the listed costs. Identify what extra records a real broker transaction would require.',
        'Find any fee counted twice, missing acquisition date, or unsupported lot selection before accepting the total.',
        ['Reconcile the worked gain to $490.', 'Keep the paper journal distinct from a complete real-world tax-lot record.'], ['tax-irs-basis', 'tax-irs-stock-lots', 'tax-irs-8949-instructions']),
        lesson('tax-records-3', 'Close the year with a reconciliation, not a screenshot', [
          sec('Understand the reporting path', 'Form 8949 reconciles transaction information with what is reported on the return; its totals generally flow into Schedule D. Applicable exceptions and other asset forms matter. A broker profit screenshot is not a replacement for the forms, adjustments, and supporting records.', { sourceIds: ['tax-irs-8949'] }),
          sec('Separate a net loss from the current deduction', 'Under the usual individual capital-loss rules, losses first participate in capital-gain netting. An excess net loss generally offsets up to $3,000 of other income annually, or $1,500 for married filing separately; unused amounts can carry forward. A carryover worksheet can matter when income is low.', { sourceIds: ['tax-irs-capital'], example: 'Assume a single individual investor, no special election, a $12,000 net capital loss, sufficient other taxable income to use the full annual deduction, and no other adjustments. The simplified allocation is $3,000 this year and $9,000 carried forward. It is not a $12,000 tax refund.' }),
          sec('Assemble the handoff packet', 'Keep basis evidence for as long as it is needed through the disposition-year limitations period. Carryovers and unresolved adjustments may require older records. A calendar-based deletion rule that erases still-needed basis evidence is a poor records policy.', { sourceIds: ['tax-irs-records'], bullets: ['Original and corrected broker forms, trade exports, and prior carryover schedules.', 'A reconciliation from each source to your combined totals.', 'An unresolved-items list with an owner and next action.'] })
        ], 'Retain the evidence that explains the return, including carryovers and corrections.', 'review-trade',
        'A net loss, a deduction, a carryover, and a refund are four different concepts.',
        'Review a paper trade, then draft a year-end packet index and solve the $12,000-loss example. Use tax-case-2 to test whether a broker total is enough.',
        'Explain the assumptions that permit the $3,000/$9,000 split and identify which worksheet would be checked in a real filing.',
        ['Calculate the stated deduction and carryover separately.', 'List documents rather than relying on an account screenshot.'], ['tax-irs-8949', 'tax-irs-capital', 'tax-irs-records'])
      ],
      quiz: [
        q('An investor closes a stock position after three days. Which statement distinguishes character from rate?', ['It becomes wages because it was short-term', 'It is generally a short-term capital result; net short-term gains use ordinary rates', 'It is always taxed at a flat 20%', 'It is untaxed until withdrawn'], 1, 'A short holding period does not convert an own-account stock sale into employee compensation. Character and rate are separate classifications.', ['tax-irs-capital']),
        q('Buy cost is $5,000 plus a $5 acquisition fee. Gross sale proceeds are $5,500 and the selling fee is $5. Before other adjustments, what is the gain?', ['$500', '$505', '$490', '$495'], 2, 'Adjusted starting cost is $5,005 and net proceeds are $5,495. Their difference is $490; do not deduct either fee twice.', ['tax-irs-basis', 'tax-irs-8949-instructions']),
        q('Assume a single investor has a $12,000 net capital loss and enough other taxable income to use the full annual deduction, with no other adjustments. What is the simplified current deduction and carryover?', ['$3,000 deduction; $9,000 carryover', '$12,000 refund; no carryover', '$9,000 deduction; $3,000 carryover', 'No deduction and no future use'], 0, 'Under the stated ordinary capital-loss assumptions, the annual deduction is $3,000 and the remaining $9,000 carries forward. A deduction is not a dollar-for-dollar refund.', ['tax-irs-capital']),
        q('Which record is most useful when two purchases of the same stock had different costs?', ['Only the latest chart price', 'The brand name of the broker', 'An average chosen after seeing the tax result', 'Lot-level acquisition records and evidence of the shares identified for sale'], 3, 'The identification and original records establish which basis applies. A convenient after-the-fact average is not a substitute.', ['tax-irs-stock-lots']),
        q('What is the strongest year-end handoff?', ['One screenshot of account equity', 'Forms, transaction records, basis adjustments, carryovers, and a reconciliation', 'Only withdrawals from the account', 'Only trades that made money'], 1, 'The handoff should explain the totals and unresolved items. Equity includes open positions and cash movements that need separate treatment.', ['tax-irs-8949', 'tax-irs-records'])
      ]
    },
    {
      id: 'tax-wash-sales', title: 'Find wash sales before they surprise you',
      subtitle: 'Review the complete timeline, all relevant accounts, replacement shares, and IRA consequences.',
      level: 'Professional skills · U.S. tax', minutes: 36, labId: 'discipline', guidedLabId: 'review-trade',
      skills: ['Review a 61-day window', 'Connect replacement lots across accounts', 'Distinguish taxable and IRA replacements'],
      sourceIds: ['tax-irs-550', 'tax-irs-schedule-d', 'tax-irs-1099b', 'tax-irs-ira-wash', 'tax-irs-8949-instructions'],
      lessons: [
        lesson('tax-wash-sales-1', 'The replacement can come before the sale', [
          sec('Review the whole window', 'For the ordinary stock/securities rule, review substantially identical acquisitions or acquisition contracts during the 30 days before and 30 days after a loss sale. Including the sale date, that is a 61-day window. Do not check only what happened after closing the losing position.', { sourceIds: ['tax-irs-schedule-d'] }),
          sec('Connect the loss to the matched replacement', 'In the usual taxable-account case, a disallowed loss increases the replacement lot’s basis rather than becoming an immediate deduction. Matching matters when quantities differ; the review is not simply an all-or-nothing label on the entire account.', { sourceIds: ['tax-irs-550'], example: 'Original exercise: sell 100 shares for a $1,000 loss and buy 40 replacement shares at $42 within the window. Assuming those are the only relevant matching events, $400 of the loss is deferred into those 40 shares. Their $1,680 cost becomes $2,080 basis; the other $600 remains subject to the usual loss rules.' }),
          sec('Draw a timeline before choosing a response', 'Place acquisition and disposal events in date order and annotate quantities. Use a line extending across the year boundary when necessary. A January purchase can matter to a December loss.', { bullets: ['Anchor the loss sale, then inspect both sides of the timeline.', 'Identify the specific shares or contracts that may match.', 'Record the adjustment and replacement-lot link instead of deleting the losing trade.'] })
        ], 'The sale date, replacement dates, quantities, and account types all belong in the review.', 'review-trade',
        'A pre-sale purchase can matter, and replacement quantities can make only part of a loss subject to adjustment.',
        'Use a reviewed paper trade as a record template. On paper, build the 100-share/40-share timeline and calculate the $400 adjustment; then solve tax-case-3.',
        'Check that every deferred amount has an identified destination and that the untouched portion was not silently discarded.',
        ['Match 40 of the 100 shares under the stated assumptions.', 'Reconcile $1,680 replacement cost plus $400 adjustment to $2,080.'], ['tax-irs-schedule-d', 'tax-irs-550']),
        lesson('tax-wash-sales-2', 'A broker form does not see the whole household', [
          sec('Know the broker-reporting boundary', 'The required Form 1099-B wash-sale reporting rule is narrower than every situation a taxpayer must review: it focuses on covered securities with the same CUSIP in the same account. Brokers may report more, but a blank wash-sale field does not establish that no adjustment is needed.', { sourceIds: ['tax-irs-1099b', 'tax-irs-schedule-d'] }),
          sec('Build an account map', 'Include your relevant brokerage accounts, automatic acquisitions, retirement accounts, and relevant spouse or controlled-corporation activity. Changing brokers does not by itself change the underlying security or erase a matching acquisition. Substantially identical is a facts-and-circumstances question, not merely a ticker-string comparison.', { sourceIds: ['tax-irs-550'], example: 'Broker A records a loss sale. Five days later, Broker B records your purchase of the same security. A’s statement may not join those events. Your review should link them before accepting the reported loss.' }),
          sec('Reconcile without hiding the original', 'Keep the received statement and a separate adjustment schedule. Where Form 8949 applies, use its instructions for the appropriate correction or wash-sale adjustment. Ask the issuer about an actual statement error while retaining the evidence for your own reporting.', { sourceIds: ['tax-irs-8949-instructions'], bullets: ['Compare accounts on one dated timeline.', 'Check recurring purchases and dividend-reinvestment activity.', 'Keep the original amount, proposed adjustment, reason, and supporting record together.'] })
        ], 'An account-level report is an input to your review, not its outer boundary.', 'review-trade',
        'Two brokers can each report accurately within their scope while your combined record still needs an adjustment.',
        'Create a two-account event map using the example and list an automatic purchase that would need investigation. Solve tax-case-4 before marking the record complete.',
        'Explain why switching accounts is not a wash-sale workaround and why a different ticker alone does not settle substantial identity.',
        ['Connect relevant events across accounts.', 'Keep a documented adjustment trail without overwriting the received source.'], ['tax-irs-1099b', 'tax-irs-550', 'tax-irs-8949-instructions']),
        lesson('tax-wash-sales-3', 'An IRA replacement is not ordinary tax deferral', [
          sec('Understand the ruling’s consequence', 'Revenue Ruling 2008-5 addresses a loss sale followed by a substantially identical purchase caused in the seller’s IRA or Roth IRA within the window. The loss is disallowed, and the ruling does not increase basis in the IRA or Roth IRA by that loss. Do not assume the normal taxable replacement-basis treatment follows it into retirement savings.', { sourceIds: ['tax-irs-ira-wash'] }),
          sec('Compare two fact patterns', 'Keep the timing and economic loss the same, then change only the replacement account. The comparison makes the account-type issue visible without recommending either transaction.', { example: 'A taxable stock sale has a $600 loss. In version A, a matching taxable replacement requires the usual basis-adjustment review. In version B, the individual causes the matching IRA purchase addressed by the ruling: the loss is disallowed without a corresponding IRA-basis increase under that rule.' }),
          sec('Use a prevention checklist', 'Before a proposed loss realization, inventory scheduled purchases and the accounts that can create an issue. When the facts already occurred, preserve them and seek the correct reporting treatment; changing a description cannot reverse an acquisition.', { bullets: ['Record the legal owner and tax status of each account.', 'Check both the prior and following portions of the window.', 'Bring the actual dates, identifiers, and quantities to a qualified reviewer.'] })
        ], 'Retirement-account replacements require a separate analysis, not a copied taxable-lot adjustment.', 'complete-plan',
        'The IRA ruling disallows the loss without the corresponding basis increase that learners often assume.',
        'Use the plan lab to practise recording before acting. Then write the taxable-versus-IRA comparison and identify the missing account facts in tax-case-4.',
        'State the consequence addressed by the ruling without claiming that every retirement-account situation is identical.',
        ['Distinguish the two replacement account types.', 'Identify the information needed before evaluating a proposed purchase.'], ['tax-irs-ira-wash'])
      ],
      quiz: [
        q('For the usual stock/securities wash-sale review, which period must be checked around a loss sale?', ['Only the next trading day', 'Only the same calendar year', '30 days before and 30 days after', 'Only the date of the broker statement'], 2, 'The review covers both sides of the sale. A replacement acquired earlier or across December/January can matter.', ['tax-irs-schedule-d']),
        q('Under the stated 100-share loss / 40-share replacement example, how much of the $1,000 loss is matched to the replacement?', ['$400', '$1,000', '$40', '$600'], 0, 'Forty of 100 equal-loss shares are matched: 40 × $10 = $400. The remaining portion still needs the usual tax review.', ['tax-irs-550']),
        q('A broker reports no wash-sale adjustment, but another account bought the same security inside the window. What follows?', ['The blank box guarantees a deduction', 'The taxpayer still needs a combined-account review', 'The trade becomes tax-free', 'The purchase should be deleted from the records'], 1, 'The broker’s required reporting scope is narrower than the complete taxpayer-level review.', ['tax-irs-1099b']),
        q('In the IRA replacement transaction addressed by Revenue Ruling 2008-5, what happens to the disallowed loss?', ['It always increases IRA basis', 'It becomes deductible wages', 'It vanishes from the economic result', 'It is disallowed without an IRA-basis increase under that rule'], 3, 'The ruling’s IRA consequence differs from the familiar taxable replacement-lot adjustment.', ['tax-irs-ira-wash']),
        q('Which planning statement is sound?', ['A new broker automatically prevents a wash sale', 'A different ticker always proves the holdings are unrelated', 'Review actual securities, dates, quantities, ownership, and account type', 'January purchases cannot affect December sales'], 2, 'A complete facts-based review avoids treating account labels or the year boundary as a shortcut.', ['tax-irs-550', 'tax-irs-schedule-d'])
      ]
    },
    {
      id: 'tax-planning', title: 'Plan lawfully and fund the tax bill',
      subtitle: 'Evaluate genuine loss planning, estimated payments, tax reserves, and broader household assumptions.',
      level: 'Professional skills · U.S. tax', minutes: 34, labId: 'riskreward', guidedLabId: 'complete-plan',
      skills: ['Compare tax effects with economic risk', 'Understand estimated-payment targets', 'Separate a reserve from a payment'],
      sourceIds: ['tax-irs-capital', 'tax-irs-stock-lots', 'tax-irs-estimated', 'tax-irs-505', 'tax-irs-niit', 'tax-irs-ira-contributions'],
      lessons: [
        lesson('tax-planning-1', 'Ask what a tax-motivated sale actually changes', [
          sec('Use real planning decisions', 'Lawful planning starts with accurate facts: eligible lot identification, existing carryovers, the timing and character of actual transactions, and valid deductions or elections. Concealing proceeds, inventing costs, or relabeling personal spending is not planning. Keep an explanation that would still make sense if every transaction were visible.'),
          sec('Compare two columns', 'Write the investment effect in one column and the possible tax effect in another. A tax adjustment cannot make an unsuitable position suitable. Review replacement exposure, transaction costs, the wash-sale analysis, and the possibility that the expected benefit is deferred.', { example: 'Assume $8,000 of otherwise recognized short-term gains and a genuinely allowable $2,000 short-term loss, with no other adjustments. The sample net is $6,000. That says nothing by itself about the tax rate, remaining positions, cash available, or whether the sale was a good investment decision.', sourceIds: ['tax-irs-capital'] }),
          sec('Prepare a proposal before acting', 'Use a short decision memo rather than a promise of a tax saving. A legitimate lot choice requires the actual identification process and evidence; it is not a choice to invent later when preparing the return.', { sourceIds: ['tax-irs-stock-lots'], bullets: ['State the economic reason and the tax assumption separately.', 'Identify the lot, acquisition history, and relevant replacement activity.', 'List the fee, spread, exposure change, and professional questions.', 'Choose wait or no transaction when the missing facts matter.'] })
        ], 'Tax planning should improve an overall decision, not hide its economics.', 'complete-plan',
        'An allowed $2,000 loss against $8,000 of comparable gains yields a $6,000 sample net, not a guaranteed tax saving.',
        'Complete a documented paper plan, then draft a two-column decision memo for the worked example. Solve tax-case-5 to distinguish a reserve from an actual payment.',
        'Identify the assumptions that would change the result and the evidence that would verify them.',
        ['Keep the economic and tax questions separate.', 'Use actual records and lawful choices rather than invented classifications.'], ['tax-irs-capital', 'tax-irs-stock-lots']),
        lesson('tax-planning-2', 'Understand the estimated-payment target', [
          sec('Start with the general screen', 'Estimated payments generally become relevant when at least $1,000 remains after withholding and credits and the applicable payment target is not met. The usual comparison is 90% of current-year tax against 100% of prior-year tax; the prior-year measure generally becomes 110% above the specified prior-year AGI threshold. Exceptions and timing rules matter.', { sourceIds: ['tax-irs-estimated'] }),
          sec('Work a fully labelled example', 'For the ordinary 2026 higher-income rule, the prior-year AGI threshold is $150,000, or $75,000 for married filing separately. Use the current instructions and the actual filing facts instead of treating the following worksheet as a personal payment recommendation.', { sourceIds: ['tax-irs-505'], example: 'Assume an eligible twelve-month prior return, prior tax $20,000, prior AGI below the higher-income threshold, expected current tax $30,000, $12,000 withholding, no other credits or exceptions, and timely regular installments. Compare $27,000 with $20,000; the target is $20,000. Less withholding leaves $8,000, or $2,000 in each of four equal installments under these assumptions.' }),
          sec('Timing is part of the calculation', 'An annual total alone cannot establish that every installment was timely. Uneven income may make the annualized-income method worth evaluating. Preserve when income arose and when payments were made; do not call every three-month interval a statutory installment period.', { sourceIds: ['tax-irs-505'], bullets: ['Record prior-year total tax, AGI, and whether the return covered twelve months.', 'Project current income, credits, withholding, and other taxes.', 'Verify the applicable year’s payment dates and any relief.', 'Revisit the projection after a material change in income.'] })
        ], 'The payment target, installment timing, and final tax liability are separate calculations.', 'review-trade',
        'Under the stated example, $20,000 target less $12,000 withholding leaves $8,000 to fund through timely payments.',
        'Use a completed paper trade to practise dated records. Calculate the sample payment target, then solve tax-case-6 with the changed higher-income assumption.',
        'Explain why meeting a payment target can still leave tax due with the return.',
        ['Calculate the example’s $8,000 gap without inventing a personal tax rate.', 'Keep payment dates and eligibility assumptions attached to the result.'], ['tax-irs-estimated', 'tax-irs-505']),
        lesson('tax-planning-3', 'A tax reserve is a cash-management tool', [
          sec('Separate reserved, paid, and finally owed', 'Money moved to a savings account marked “tax” is still your money; it is not an estimated payment to the government. Track three balances: your reserve, payments actually credited to the tax year, and the latest projected final liability. Update the projection with the whole tax picture, not only today’s trading P&L.'),
          sec('Account for additional layers', 'For individuals, NIIT is generally 3.8% of the smaller of net investment income or MAGI above the applicable threshold. The current individual thresholds are $200,000 for single/head of household, $250,000 jointly/qualifying surviving spouse, and $125,000 married separately. State and local taxes require their own review.', { sourceIds: ['tax-irs-niit'], example: 'Illustrative single filer: MAGI $220,000 and net investment income $40,000, with no special adjustments. Excess MAGI is $20,000; 3.8% of the smaller amount is $760. This is only the NIIT illustration, not the full federal tax bill.' }),
          sec('Do not assume a retirement contribution solves every case', 'IRA contribution eligibility generally depends on qualifying compensation; property earnings such as interest and dividends are not compensation. Contribution limits, deduction eligibility, spousal rules, and withdrawal restrictions need a separate review. A trading gain alone should not be treated as proof of eligibility.', { sourceIds: ['tax-irs-ira-contributions'], bullets: ['Keep tax reserves outside the strategy performance calculation.', 'Match actual payment receipts to the intended taxpayer and tax year.', 'List other income, carryovers, credits, and account eligibility questions for review.'] })
        ], 'Fund the obligation, verify actual payments, and avoid confusing one tax component with the total.', 'equity-check',
        'A $760 NIIT illustration and a $760 transfer to savings have different meanings.',
        'Use the equity lab to distinguish account values, then create reserve/paid/projected columns. Work the NIIT example and identify the missing facts for a retirement contribution.',
        'Check whether a number describes money you still hold, a credited payment, or a calculated obligation.',
        ['Keep reserve movements outside the trading-profit total.', 'Explain the limited scope of the $760 example.'], ['tax-irs-niit', 'tax-irs-ira-contributions'])
      ],
      quiz: [
        q('You move $2,000 from checking into a savings account labelled Tax Reserve. What has happened?', ['A $2,000 federal tax payment was made', 'The transfer created a tax deduction', 'A $2,000 credit appeared on the return', 'You set aside cash; the transfer itself is not a tax payment'], 3, 'A reserve supports cash planning. Payment evidence comes from an actual payment credited to the taxpayer and tax period.', ['tax-irs-estimated']),
        q('Using the lesson’s eligible lower-income example, compare 90% of $30,000 current tax with 100% of $20,000 prior tax, then subtract $12,000 withholding. What is the sample remaining payment target?', ['$15,000', '$8,000', '$18,000', '$2,000 total for the year'], 1, 'The smaller target is $20,000; subtracting $12,000 leaves $8,000. Timing and the stated eligibility assumptions still matter.', ['tax-irs-505']),
        q('Does satisfying an applicable estimated-payment safe harbor necessarily pay every dollar of the final tax?', ['Yes, it erases any remaining tax', 'Yes, if trading was profitable', 'No; a balance may still be due when the return is completed', 'Only withdrawals count toward the final tax'], 2, 'The payment rules address underpayment exposure; the final return still determines the tax and remaining balance.', ['tax-irs-estimated', 'tax-irs-505']),
        q('For the stated single-filer NIIT example, MAGI is $220,000 and net investment income is $40,000. What is 3.8% of the applicable smaller amount?', ['$760', '$1,520', '$8,360', '$0 because some income is from investments'], 0, 'MAGI exceeds the $200,000 threshold by $20,000. The smaller amount is $20,000, producing $760 for this component.', ['tax-irs-niit']),
        q('Which approach is lawful, evidence-based tax planning?', ['Hide transactions that lack a broker form', 'Invent a business expense to match the desired refund', 'Document eligible choices, their economic costs, deadlines, and actual supporting facts', 'Assume a profitable account automatically qualifies for every retirement deduction'], 2, 'Planning works within the actual rules and facts. A tax benefit does not establish eligibility by itself or remove the underlying investment risk.', ['tax-irs-stock-lots', 'tax-irs-ira-contributions'])
      ]
    },
    {
      id: 'tax-trader-status', title: 'Test trader status and election claims',
      subtitle: 'Understand the evidence, timing, accounting consequences, and limits behind TTS, section 475, and LLC claims.',
      level: 'Professional skills · U.S. tax', minutes: 42, labId: 'discipline', guidedLabId: 'complete-plan',
      skills: ['Distinguish investor and trader facts', 'Explain an election separately from status', 'Challenge automatic write-off claims'],
      sourceIds: ['tax-irs-traders', 'tax-irs-4797', 'tax-irs-election', 'tax-irs-3115', 'tax-irs-llc', 'tax-irs-entities', 'tax-irs-461'],
      lessons: [
        lesson('tax-trader-status-1', 'A title is not trader tax status', [
          sec('Assess the activity', 'IRS guidance asks whether securities trading seeks profit from daily price movements, is substantial, and is carried on with continuity and regularity. It considers holding periods, frequency and amount, time devoted, and livelihood-related facts. Calling yourself a day trader does not decide the classification.', { sourceIds: ['tax-irs-traders'] }),
          sec('Build a factual review', 'No course badge, broker setting, or one profitable month supplies the whole annual record. Prepare an honest chronology of actual activity, including inactive periods. Avoid a made-up universal minimum number of trades.', { example: 'One learner makes many trades during a two-week holiday and none during the rest of the year. Another trades regularly over a longer period. Those facts invite different questions, but this course does not certify either person’s status from that sketch.' }),
          sec('Make the packet useful', 'Separate evidence from the conclusion you want. The professional reviewing it needs enough detail to examine the entire activity.', { bullets: ['Trading-day calendar, holding-period summaries, volume of activity, and time records.', 'Other work, interruptions, objectives, and how income-producing activity was organized.', 'Keep acquisition-day identification of investment holdings separate from the trading-business positions.'], sourceIds: ['tax-irs-traders'] })
        ], 'Trader status is a facts-based tax question, not a label purchased with a course or entity.', 'complete-plan',
        'The legal review concerns the actual activity and the whole record, not a self-description.',
        'Complete one documented paper session to practise record quality. Then draft the headings of an actual-activity evidence packet and solve tax-case-7.',
        'Explain why paper sessions rehearse documentation but do not establish real securities-trading tax status.',
        ['Distinguish documentation practice from proof of tax status.', 'Identify missing annual facts instead of inventing a trade-count threshold.'], ['tax-irs-traders']),
        lesson('tax-trader-status-2', 'Section 475 changes the accounting method', [
          sec('Separate qualification from election', 'A qualifying trader without a valid election generally retains capital-gain/loss reporting and the associated capital-loss and wash-sale rules. Status alone does not switch those off. A valid section 475 election is a separate step with its own consequences.', { sourceIds: ['tax-irs-traders'] }),
          sec('Understand what changes', 'For covered trading-business positions under the applicable mark-to-market election, year-end open positions are treated as sold at fair market value, and gains/losses generally receive ordinary treatment reported through Form 4797. The preferential capital-gain treatment and capital-loss limit do not apply to those covered results. Properly separate investment positions require their own treatment.', { sourceIds: ['tax-irs-4797'], example: 'An original illustration has a covered position with $10,000 basis and $12,000 year-end value. Under the stated elected treatment, the $2,000 change is included even though the position remains physically open. This is a tax-accounting mark, not an actual broker sale or a ReplayLab fill.' }),
          sec('Keep the remaining limits visible', 'Ordinary loss character does not mean every loss is immediately deductible against every other kind of income without limit. Noncorporate excess-business-loss rules and later loss use can still matter. Review the complete return and the current instructions before evaluating an election’s benefit.', { sourceIds: ['tax-irs-461'], bullets: ['Compare ordinary treatment with the capital treatment that would otherwise apply.', 'Ask how open positions, investment holdings, and existing carryovers are handled.', 'Model both gains and losses; do not examine only the desired losing-year result.'] })
        ], 'A valid election changes timing and character; it is not an unlimited-loss or no-tax guarantee.', 'equity-check',
        'An economic open gain and an elected year-end tax mark answer different accounting questions.',
        'Observe an open paper position in the account lab. Then apply the stated $10,000/$12,000 accounting illustration and list the additional facts needed for a real election analysis.',
        'Keep the hypothetical tax adjustment separate from the simulator’s unchanged position and journal.',
        ['Compute the stated $2,000 mark without creating an imaginary execution.', 'Identify at least one limitation beyond the ordinary capital-loss rule.'], ['tax-irs-traders', 'tax-irs-4797', 'tax-irs-461']),
        lesson('tax-trader-status-3', 'Treat election timing as a project with a deadline', [
          sec('Calendar the actual requirement', 'For an existing taxpayer, the usual section 475 election deadline is the unextended due date of the prior year’s return. The statement can accompany the timely original return or the extension request. A filing extension does not itself postpone that election deadline. Special new-taxpayer provisions need separate analysis.', { sourceIds: ['tax-irs-election'] }),
          sec('Do not confuse the statement with implementation', 'A change from an existing accounting method can also require Form 3115 and the applicable change procedure. The election statement, accounting-method work, and resulting return reporting have different jobs. Current procedures and exceptions must be checked for the intended year.', { sourceIds: ['tax-irs-3115', 'tax-irs-traders'], example: 'A trader asks in December to make an election retroactive to the start of the same year after seeing losses. The first task is to investigate the actual deadline and eligibility, not to backdate a statement or assume an extension cured the issue.' }),
          sec('Create a review checklist', 'Ask a qualified professional for a written implementation sequence before taking an action that depends on the election.', { bullets: ['Intended effective year, taxpayer identity, activity, and eligibility evidence.', 'Applicable election deadline, statement contents, filing path, and proof of timely filing.', 'Accounting-method change, opening positions, investment segregation, and record retention.', 'Future consequences of changing or revoking the method.'] })
        ], 'An election is a timely documented legal act, not a year-end toggle in trading software.', 'complete-plan',
        'The election statement and accounting-method implementation are related but distinct tasks.',
        'Practise writing a before-entry plan, then create an election-review task list with placeholders for verified deadlines. Solve tax-case-8; do not enter a real filing date by guessing.',
        'Point to the item that must be researched before promising that an election is still available.',
        ['Identify the prior-return deadline principle and the extension distinction.', 'Keep unknown dates explicit until the correct year’s rules are checked.'], ['tax-irs-election', 'tax-irs-3115', 'tax-irs-traders']),
        lesson('tax-trader-status-4', 'An LLC is a legal wrapper, not a tax eraser', [
          sec('Separate formation from federal classification', 'A domestic single-member LLC is generally disregarded for federal income tax unless it elects corporate treatment. An LLC with multiple members generally defaults to partnership treatment, subject to exceptions and elections. Forming an LLC therefore does not, by itself, create a new tax rate or exempt trading profits.', { sourceIds: ['tax-irs-llc', 'tax-irs-entities'] }),
          sec('Ask what problem the entity would solve', 'Entity form, trading-business status, deductions, accounting elections, payroll, and state-law obligations are different questions. Ask for a full cost-and-obligation comparison rather than accepting a claim that an entity automatically makes all purchases deductible.', { example: 'An individual forms a one-owner LLC but makes no corporate election and does not change the underlying activity. The formation document alone does not prove trader status or show that a section 475 election was made.' }),
          sec('Prepare a decision brief', 'Write the operational objective first, such as separating records or addressing a specific legal arrangement. Then list the filing and administration consequences that require professional review.', { bullets: ['Who owns the entity and how is it taxed?', 'What actual business activity and elections are proposed?', 'What recurring fees, reporting, payroll, and state obligations arise?', 'Which claimed tax saving has a documented legal basis and which is merely marketing?'] })
        ], 'Evaluate the actual entity, activity, elections, and costs independently.', 'complete-plan',
        'A formation document can establish an entity; it does not settle every tax question about the activity.',
        'Write an entity decision brief alongside a documented practice plan. Identify which fact tax-case-7 still lacks after an LLC is formed.',
        'Replace “an LLC saves taxes” with a specific proposed treatment, its eligibility facts, and its costs.',
        ['Separate entity classification from trader status and accounting elections.', 'Identify a genuine operational objective before comparing entity forms.'], ['tax-irs-llc', 'tax-irs-entities'])
      ],
      quiz: [
        q('Which fact alone establishes trader tax status?', ['Forming an LLC', 'Calling yourself a professional', 'Passing this course', 'None of these alone establishes it'], 3, 'The classification depends on actual activity and the relevant facts over time. A title or entity is not the substantive test.', ['tax-irs-traders', 'tax-irs-llc']),
        q('A qualifying securities trader has made no valid section 475 election. Which statement is generally correct?', ['Capital treatment and wash-sale rules can still apply', 'All gains automatically become wages', 'All losses become unlimited ordinary deductions', 'No transaction reporting is needed'], 0, 'Trader status and the accounting election are separate. The absence of a valid election matters.', ['tax-irs-traders']),
        q('Under the stated elected treatment, a covered open position has $10,000 basis and $12,000 year-end fair value. What does the example illustrate?', ['A real broker sale for $12,000 must have occurred', 'A $2,000 year-end accounting gain without a physical sale', 'A $12,000 deduction', 'A guaranteed future $2,000 profit'], 1, 'The tax mark concerns the stated accounting method. It is not a claim about an actual execution or later market outcome.', ['tax-irs-4797']),
        q('For an existing taxpayer, what is the usual section 475 election timing principle?', ['Any December date after losses are known', 'The extended due date automatically applies', 'The prior return’s unextended due date generally controls', 'An LLC registration date always replaces the deadline'], 2, 'An extension request may carry the statement, but the election deadline itself is generally not extended. Special circumstances require review.', ['tax-irs-election']),
        q('What is the default federal income-tax treatment of a domestic single-member LLC that makes no corporate election, absent a special exception?', ['A tax-exempt charity', 'A corporation in every case', 'A disregarded entity generally reflected through its owner', 'An automatic section 475 business'], 2, 'Federal classification depends on ownership and elections. The default does not eliminate the owner’s reporting obligations.', ['tax-irs-llc'])
      ]
    },
    {
      id: 'tax-products', title: 'Classify the product before the tax rule',
      subtitle: 'Separate stock options, qualifying section 1256 contracts, digital assets, and payment income.',
      level: 'Professional skills · U.S. tax', minutes: 35, labId: 'orders', guidedLabId: 'review-trade',
      skills: ['Check contract classification', 'Explain premium and basis effects', 'Track digital-asset income and disposals'],
      sourceIds: ['tax-irs-6781', 'tax-irs-6781-about', 'tax-irs-550', 'tax-irs-schedule-d', 'tax-irs-8949-instructions', 'tax-irs-digital', 'tax-irs-1099da', 'tax-irs-544'],
      lessons: [
        lesson('tax-products-1', 'Not every derivative is a section 1256 contract', [
          sec('Read the contract classification', 'Section 1256 covers specified categories, including qualifying regulated futures and nonequity options, with important definitions and exclusions. When its capital-gain/loss rules apply, the general allocation is 60% long-term and 40% short-term, and covered open contracts are marked at year-end. The word “option” or “futures” on a platform does not complete that classification.', { sourceIds: ['tax-irs-6781'] }),
          sec('Calculate the allocation, not a tax rate', 'The 60/40 split describes character. It is not a 60% tax rate or a promise that 40% of a gain is tax-free. Rates and the full return remain separate.', { example: 'Assume the applicable section 1256 capital rules cover a $5,000 gain, with no special elections or other adjustments. The allocation is $3,000 long-term and $2,000 short-term. A separate rate calculation would be required to estimate the tax.', sourceIds: ['tax-irs-6781'] }),
          sec('Build a product card', 'For a real contract, identify the instrument, venue, settlement terms, ownership, and the source of its proposed tax classification. Form 6781 also addresses straddle reporting; related positions can introduce additional rules.', { sourceIds: ['tax-irs-6781-about'], bullets: ['Keep the actual contract specification and broker tax statement.', 'Ask what supports the classification, including exclusions.', 'Flag related or offsetting positions for specialist review.', 'Do not use this stock-price simulator as a derivative pricing, margin, or liquidation model.'] })
        ], 'Verify the actual contract before applying a favorable-looking tax label.', 'review-trade',
        'For the stated qualifying $5,000 gain, 60/40 means $3,000 and $2,000 of different character.',
        'Use a paper trade record as a documentation template, then create a derivative product card from the hypothetical facts. Solve tax-case-9.',
        'Distinguish an allocation of gain from the tax rate and from the economic risk of the contract.',
        ['Calculate the allocation without inventing a tax rate.', 'List the contract facts that must be verified in a real case.'], ['tax-irs-6781', 'tax-irs-6781-about']),
        lesson('tax-products-2', 'Follow the option premium through the transaction', [
          sec('Identify holder, writer, and ending event', 'Buying an option, writing one, closing it, allowing it to expire, and exercising or being assigned are different events. For a purchased stock call that is exercised, the premium generally joins the basis of the acquired shares. An option that closes or expires as a capital asset outside section 1256 generally follows the Form 8949 reporting path.', { sourceIds: ['tax-irs-550', 'tax-irs-schedule-d'] }),
          sec('Avoid dropping or doubling the premium', 'Preserve the option record and the resulting share transaction together. If the broker’s reported proceeds or basis already reflect a premium, applying it again would distort the result. Consult the adjustment instructions when the information is incomplete.', { sourceIds: ['tax-irs-8949-instructions'], example: 'Assume a purchased call costs $200 and exercise requires $5,000 for the shares, with no fees or other adjustments. The resulting share basis is $5,200. Recording only $5,000 would lose part of the acquisition cost.' }),
          sec('Create an event chain', 'Use arrows in your notes from opening transaction to closing, expiry, or exercise, then to any underlying shares. Each branch should identify what evidence is available and which classification question remains open.', { bullets: ['Holder or writer; contract identifier; premium paid or received.', 'Opening and ending dates; closing, expiration, exercise, or assignment.', 'Related underlying positions and broker basis/proceeds treatment.', 'Any straddle, wash-sale, or special-contract question requiring review.'] })
        ], 'The premium belongs in an identifiable event chain, not a generic “options income” bucket.', 'review-trade',
        'The example’s $200 premium plus $5,000 exercise payment produces $5,200 share basis under the stated assumptions.',
        'Complete a factual trade review, then diagram the call exercise example and identify the documents needed for the resulting shares.',
        'Trace the premium exactly once and explain why a share chart cannot supply the option’s tax or risk model.',
        ['Calculate the stated basis and keep its components.', 'Distinguish exercise from closing or expiration.'], ['tax-irs-550', 'tax-irs-schedule-d', 'tax-irs-8949-instructions']),
        lesson('tax-products-3', 'Digital assets can create more than one taxable event', [
          sec('Identify receipt and disposal separately', 'The IRS generally treats digital assets as property. A disposition of an investment asset can create capital gain or loss; compensation paid in digital assets raises an income question when received. Exchanging one digital asset for another can be a disposition even without converting either to dollars.', { sourceIds: ['tax-irs-digital', 'tax-irs-544'] }),
          sec('Keep the dollar valuation and basis trail', 'Record units, timestamps, transaction identifiers, fees, U.S.-dollar values, account or wallet, and how the units disposed of were identified. Receiving no Form 1099-DA does not remove the reporting obligation, and a form may not supply every basis fact.', { sourceIds: ['tax-irs-1099da'], example: 'Assume services compensation of $800 is correctly included in income when received in a digital asset. The asset then has an $800 basis under the stated facts and is later sold for $900 as a capital asset, with no fees or other adjustments. The later capital gain is $100; the original $800 should not be treated as a second gain on sale.' }),
          sec('Reject product-name shortcuts', 'The Schedule D instructions specifically flag digital assets that are also stock or securities for wash-sale treatment. Do not assume every token has the same classification, or present an instant sale-and-rebuy as a universal tax loophole. Review the actual rights and the applicable year’s rules.', { sourceIds: ['tax-irs-schedule-d'], bullets: ['Distinguish a transfer between your own wallets from a sale or exchange.', 'Reconcile exchange and wallet histories without counting internal transfers as new receipts.', 'Keep compensation, later price changes, and contract-specific questions separate.'] })
        ], 'Track the actual event and the asset’s rights, not just the label “crypto.”', 'review-trade',
        'In the stated two-event example, $800 of service income and $100 of later capital gain are different entries.',
        'Use the journal lab to practise factual records. Then build the two-event digital-asset worksheet and solve tax-case-10.',
        'Identify each event’s value and basis without treating the lack of a broker form as an exemption.',
        ['Separate receipt income from the later disposal result.', 'List missing basis or classification facts before using a tax treatment.'], ['tax-irs-digital', 'tax-irs-1099da', 'tax-irs-544', 'tax-irs-schedule-d'])
      ],
      quiz: [
        q('Under the lesson’s qualifying section 1256 assumptions, how is a $5,000 capital gain allocated?', ['$5,000 tax-free', '$3,000 long-term and $2,000 short-term', '$3,000 tax and $2,000 profit', '$2,000 long-term and $3,000 short-term'], 1, 'The 60/40 percentages allocate character; they are not the tax rates.', ['tax-irs-6781']),
        q('Which statement about derivatives is correct?', ['All options receive section 1256 treatment', 'Every crypto derivative is tax-free', 'A platform name determines the federal classification', 'The actual contract and relevant definitions must be checked'], 3, 'Contract categories and exclusions matter. Neither an asset nickname nor a marketing label settles the classification.', ['tax-irs-6781']),
        q('A purchased call costs $200 and is exercised for $5,000, with no fees or other adjustments. What is the resulting share basis in the stated example?', ['$5,200', '$5,000', '$4,800', '$200'], 0, 'The exercise payment and the call’s acquisition cost are joined in the stated basis calculation.', ['tax-irs-550']),
        q('A digital asset received for services is correctly included at $800 and later sold for $900 as a capital asset, with no other adjustments. What is the later capital gain?', ['$900', '$800', '$100', '$1,700'], 2, 'The $800 receipt value supplies the stated basis; the later increase is $100. Keep the receipt and disposal events separate.', ['tax-irs-digital', 'tax-irs-544']),
        q('You receive no Form 1099-DA for a taxable digital-asset transaction. What is the appropriate response?', ['Omit it because there is no form', 'Use your records to determine and report the transaction correctly', 'Treat gross proceeds as tax-free', 'Delete the wallet history'], 1, 'Reporting does not depend on receiving the form. Transaction and basis records remain necessary.', ['tax-irs-1099da'])
      ]
    },
    {
      id: 'tax-business', title: 'Treat payouts and operating costs professionally',
      subtitle: 'Read contracts, distinguish compensation from own-account gains, and build a reliable operating review.',
      level: 'Professional skills · U.S. tax', minutes: 33, labId: 'discipline', guidedLabId: 'complete-plan',
      skills: ['Classify the payout relationship', 'Evaluate substantiated business expenses', 'Prepare a reviewable tax and operations packet'],
      sourceIds: ['tax-irs-contractors', 'tax-irs-traders', 'tax-irs-expenses', 'tax-irs-home', 'tax-irs-business-records', 'tax-irs-preparer'],
      lessons: [
        lesson('tax-business-1', 'A prop payout needs its own facts', [
          sec('Start with who owns what', 'A payment from a proprietary-trading arrangement may depend on a contract, employment relationship, services, or another legal arrangement. It is not automatically a gain on an asset you owned. Determine who owns the account and positions, who bears losses, what service or right earns payment, and which forms are issued.'),
          sec('Use the applicable income framework', 'Where the facts establish an independent-contractor service business, compensation is generally reported through Schedule C and may involve self-employment tax and estimated payments. Employee-versus-contractor status depends on the relationship and control facts, not simply the payment’s nickname. Own-account securities-sale rules should not be copied onto a different compensation arrangement.', { sourceIds: ['tax-irs-contractors'] }),
          sec('Work a contract-led example', 'Separate the payout amount, any withheld amount, fees paid, and the proposed tax treatment. A fee reducing cash is not automatically a deductible business expense.', { example: 'Assume a contract has already been correctly classified as independent-contractor services. It pays $2,000 and a separate $150 evaluation fee was paid. Record $2,000 of gross receipts and the $150 payment separately for deductibility review; do not automatically relabel the $1,850 cash difference as a section 1256 gain.', bullets: ['Keep the signed contract, amendments, statements, and tax forms.', 'Identify the counterparty and the nature of the payment.', 'List refund conditions, fee treatment, and unresolved classification questions.'] })
        ], 'Classify the actual payment relationship before selecting a trading-tax rule.', 'review-trade',
        'A contractual payout and a sale from your own investment account can require different analyses.',
        'Complete a journal record, then draft a payout record from the worked contract facts. Solve tax-case-11 and name which facts make its classification explicit.',
        'Explain why the trading instrument used by a firm does not automatically determine the recipient’s payout character.',
        ['Separate gross receipts, cash costs, and proposed deductions.', 'Use the stated relationship rather than the word “prop” as the decisive fact.'], ['tax-irs-contractors']),
        lesson('tax-business-2', 'A deduction is not reimbursement', [
          sec('Document an actual qualifying cost', 'Business-expense review asks whether a cost is ordinary and necessary for the actual business and properly substantiated. Personal spending does not become a business deduction because it was paid with a business card. Allocation and separate rules can matter for mixed-use costs and assets.', { sourceIds: ['tax-irs-expenses'] }),
          sec('Check economics and eligibility separately', 'First ask whether the purchase is useful and affordable without assuming a deduction. Then evaluate the tax treatment under the actual facts.', { example: 'Pure arithmetic illustration: if a $1,000 cost is fully deductible now and reduces income taxed at an assumed 24% marginal rate, the tax reduction is $240. The after-tax cost is still $760. This assumes eligibility and timing; it does not establish either.' }),
          sec('Recognize a common home-office mistake', 'For the usual home-office exclusive-use test, the area must be used only for the business; regular use and other qualifying conditions also matter. A family recreation space does not satisfy that test merely because trading takes place there. Specific exceptions, methods, and limits require their own review.', { sourceIds: ['tax-irs-home'], bullets: ['Preserve date, vendor, amount, receipt, and business purpose.', 'Separate personal use and explain any allocation.', 'Flag equipment, start-up, home-office, and education costs for the applicable specific rules.', 'Never manufacture a receipt or business use after the fact.'] })
        ], 'A substantiated eligible deduction can reduce tax; it does not make the purchase free.', 'complete-plan',
        'Under the stated 24% arithmetic assumption, a deductible $1,000 purchase still costs $760 after tax.',
        'Create an operating-cost entry beside a documented practice session. Work the deduction example and solve tax-case-12 about mixed personal use.',
        'Identify which claims concern arithmetic and which still require evidence of actual tax eligibility.',
        ['Calculate the $240 reduction and $760 remaining cost separately.', 'Identify personal-use and substantiation questions before claiming an expense.'], ['tax-irs-expenses', 'tax-irs-home']),
        lesson('tax-business-3', 'Run a monthly close and a professional handoff', [
          sec('Build a repeatable close', 'Use a consistent records process that explains income, expenses, assets, and liabilities. Retain source records and prior return work that remain relevant. Back up the raw files as well as your cleaned spreadsheet so a correction can be traced rather than guessed.', { sourceIds: ['tax-irs-business-records'] }),
          sec('Review one complete packet', 'A useful monthly close separates strategy results, operating costs, owner transfers, tax reserves, actual tax payments, and unresolved items. A paper-training export is useful evidence of learning; it is not a substitute for real broker, bank, and contract documents.', { example: 'Your practice close shows $900 strategy P&L, $120 operating costs, and a $300 transfer to a tax reserve. The illustrated operating result is $780 before tax; the reserve transfer does not reduce that result to $480. The final tax treatment of the actual costs would still require review.', bullets: ['Reconcile opening balances, transactions, transfers, and closing balances.', 'Attach payout contracts, corrected forms, and adjustment schedules.', 'Assign each unresolved item a next action and review date.'] }),
          sec('Choose expertise and review the result', 'Check a preparer’s credentials and relevant experience, ask about fees and availability, and review the completed return before signing. Paid preparers generally need a PTIN and must sign the return. A preparer’s involvement does not remove your responsibility for accurate information.', { sourceIds: ['tax-irs-preparer'], bullets: ['Ask about securities, section 475, derivatives, digital assets, or prop contracts relevant to your facts.', 'Ask which records and deadlines they need before giving a conclusion.', 'Keep the final explanation, filed documents, and proof of submission with the packet.'] })
        ], 'Professional practice is a reliable process with evidence, not a promise that every issue is solved.', 'complete-plan',
        'Strategy profit, operating profit, reserved cash, and tax paid belong on separate lines.',
        'Finish an integrated paper session, then prepare a monthly-close index and professional question list. Reconcile the $900/$120/$300 example without turning a reserve transfer into an expense.',
        'Check that another person could reproduce the totals and find every original document or unresolved question.',
        ['Reconcile the illustrated $780 operating result before tax.', 'Prepare a focused, evidence-backed professional handoff.'], ['tax-irs-business-records', 'tax-irs-preparer'])
      ],
      quiz: [
        q('Which fact most directly guides the first review of a prop-firm payout?', ['The color of the trading platform', 'The name of the chart pattern', 'The contract, ownership, services, and actual payment relationship', 'Whether the underlying market moved up'], 2, 'The recipient’s legal and economic relationship matters. The firm’s trading product does not automatically determine the payout’s tax character.', ['tax-irs-contractors']),
        q('In the explicitly classified contractor example, $2,000 is paid and a separate $150 fee was incurred. What is the strongest record?', ['Gross receipts and the fee separately, with the fee’s eligibility reviewed', 'Only $1,850 labelled tax-free profit', 'Only the withdrawal amount', 'A section 1256 label chosen without reviewing the contract'], 0, 'Separate records preserve the facts. A cash outflow does not prove a deduction, and a contractual payout is not automatically your capital gain.', ['tax-irs-contractors', 'tax-irs-expenses']),
        q('Assume a $1,000 cost is fully deductible immediately at an illustrative 24% marginal rate. What are the tax reduction and remaining cost?', ['$1,000 reduction; $0 cost', '$760 reduction; $240 cost', '$24 reduction; $976 cost', '$240 reduction; $760 cost'], 3, 'The assumed deduction reduces tax by 0.24 × $1,000. It does not reimburse the full purchase.', ['tax-irs-expenses']),
        q('A room is used for both family recreation and trading. What is the issue under the usual home-office exclusive-use test?', ['Trading on a laptop always makes the whole room deductible', 'The mixed personal use does not satisfy exclusive use', 'An LLC name automatically removes the issue', 'Only the paint color matters'], 1, 'The usual exclusive-use condition is about actual use. The lesson does not assume a special exception.', ['tax-irs-home']),
        q('A practice close shows $900 strategy P&L, $120 operating costs, and $300 transferred to a tax reserve. What is the illustrated operating result before tax?', ['$480', '$1,080', '$780', '$300'], 2, '$900 − $120 = $780. The reserve transfer changes where cash is held, not the operating result; actual deductibility remains a separate question.', ['tax-irs-business-records'])
      ]
    }
  ];

  const caseOf = (id, title, scenario, choices, answer, explanation, moduleId, lessonId, sourceIds) => ({
    id, category: 'Taxes & records', title, scenario, choices, answer, explanation, moduleId, lessonId, sourceIds
  });
  const cases = [
    caseOf('tax-case-1', 'A withdrawal is not the gain',
      'An individual deposits $5,000 of existing cash, closes an investment-stock sale for an $800 gain before tax adjustments, and withdraws $300. Which amount is the starting transaction result to classify?',
      ['$300 because only withdrawals count', '$5,800 because deposits are also gains', '$800, followed by character and adjustment review', '$0 until the entire account is withdrawn'], 2,
      'The $800 result comes from the disposition. Transfers explain cash movement; they do not replace the sale’s tax analysis.', 'tax-records', 'tax-records-1', ['tax-irs-capital']),
    caseOf('tax-case-2', 'The broker total does not reconcile',
      'A broker summary shows a gain, but one acquisition lot is missing its original cost and the taxpayer has a prior-year capital-loss carryover. What should happen before accepting the summary as the final tax result?',
      ['Reconstruct the missing basis and carryover, then reconcile the complete reporting record', 'Assume missing basis is always zero', 'Delete the sale with missing information', 'Treat the broker headline as the final tax liability'], 0,
      'A reconciliation needs the supporting acquisition and prior-return records. A reported gain is neither a complete basis analysis nor a final liability calculation.', 'tax-records', 'tax-records-3', ['tax-irs-basis', 'tax-irs-8949', 'tax-irs-records']),
    caseOf('tax-case-3', 'A replacement happened before the loss',
      'For this ordinary taxable-stock example, a taxpayer buys substantially identical replacement shares 12 days before selling the original shares at a loss. No exception is assumed. Which review is required?',
      ['None; only later purchases count', 'Review the loss under the wash-sale rule, including the pre-sale acquisition', 'Ignore it if it is at another broker', 'Apply a rule that begins only on January 1'], 1,
      'The relevant acquisition window extends before as well as after the loss sale. Preserve the replacement date and quantity in the matching analysis.', 'tax-wash-sales', 'tax-wash-sales-1', ['tax-irs-schedule-d']),
    caseOf('tax-case-4', 'Which account bought the replacement?',
      'A taxpayer incurs a $600 taxable-stock loss and causes their IRA to buy substantially identical shares within the window, under the facts addressed by Revenue Ruling 2008-5. Which statement is correct?',
      ['The loss is immediately deductible because the IRA is separate', 'The IRA receives a $600 basis increase under the ruling', 'The broker’s blank box guarantees the loss deduction', 'The loss is disallowed without an IRA-basis increase under that rule'], 3,
      'The ruling does not carry the disallowed amount into IRA basis. That is why the replacement account type must be identified before copying the taxable-lot example.', 'tax-wash-sales', 'tax-wash-sales-3', ['tax-irs-ira-wash']),
    caseOf('tax-case-5', 'A tax reserve has not been paid',
      'A trader has transferred $4,000 into a personal savings account named Tax, but has no corresponding government payment confirmation. What can they conclude?',
      ['They have set aside $4,000; they still need to verify and make any required payment', 'The IRS has automatically credited the savings balance', 'The transfer is a deductible business expense', 'The final tax bill cannot exceed $4,000'], 0,
      'Cash reserved, tax actually paid, and final tax owed are different records. The savings label establishes none of the latter two.', 'tax-planning', 'tax-planning-3', ['tax-irs-estimated']),
    caseOf('tax-case-6', 'The higher-income percentage changes the target',
      'Assume a single taxpayer is eligible to use a twelve-month prior return, prior-year AGI is $180,000, prior tax is $20,000, expected current tax is $30,000, and withholding is $12,000. No other credits or exceptions apply. Using the stated current general rule, what is the remaining annual payment target before installment timing?',
      ['$8,000', '$15,000', '$10,000', '$18,000'], 2,
      'Compare 90% × $30,000 = $27,000 with 110% × $20,000 = $22,000. Subtract $12,000 withholding from the smaller target: $10,000. Timing remains a separate check.', 'tax-planning', 'tax-planning-2', ['tax-irs-505']),
    caseOf('tax-case-7', 'An LLC formation is not a complete tax position',
      'A learner registers a domestic single-member LLC and then claims it proves trader tax status and automatically elects section 475. What is missing?',
      ['Only a new logo', 'The actual activity analysis and a separately valid, timely election; entity classification also needs review', 'Nothing; LLC registration completes all three', 'A profitable trade guarantees the claim'], 1,
      'Entity formation, activity-based status, and an accounting election are different questions. The registration itself does not answer them.', 'tax-trader-status', 'tax-trader-status-4', ['tax-irs-llc', 'tax-irs-traders', 'tax-irs-election']),
    caseOf('tax-case-8', 'A year-end election request',
      'In December, an existing taxpayer wants section 475 treatment retroactive to the beginning of that same year after seeing losses. What is the sound next action?',
      ['Backdate the election statement', 'Assume an LLC formed now cures every deadline', 'Change the journal’s capital labels to ordinary', 'Check eligibility, the actual prior-return deadline, and any applicable relief with qualified advice'], 3,
      'The usual election timing precedes the year-end result. A software label or backdated document is not a valid substitute; the course does not assume relief is available.', 'tax-trader-status', 'tax-trader-status-3', ['tax-irs-election', 'tax-irs-3115']),
    caseOf('tax-case-9', 'Sixty-forty is a character split',
      'A contract has been correctly established as subject to the applicable section 1256 capital rules. Its gain is $5,000, with no special elections or other adjustments. Which allocation follows the stated rule?',
      ['$3,000 long-term and $2,000 short-term', '$3,000 tax and $2,000 tax-free', '$5,000 short-term because it was intraday', '$2,000 long-term and $3,000 short-term'], 0,
      'The percentages allocate the gain’s character. They do not state the tax rate or eliminate the need to determine that the actual contract qualifies.', 'tax-products', 'tax-products-1', ['tax-irs-6781']),
    caseOf('tax-case-10', 'A crypto exchange without a cash withdrawal',
      'A U.S. taxpayer exchanges an investment digital asset for another digital asset, but receives no Form 1099-DA. What should the records workflow do?',
      ['Ignore the transaction because no dollars were withdrawn', 'Wait until a bank transfer occurs before keeping records', 'Record the disposal, dollar values, basis, and replacement acquisition for correct reporting', 'Assume every token is exempt from all loss-deferral rules'], 2,
      'A digital-asset exchange can be a disposition. A missing form does not remove the need to determine the result and retain basis records.', 'tax-products', 'tax-products-3', ['tax-irs-digital', 'tax-irs-1099da']),
    caseOf('tax-case-11', 'The firm traded futures; you received a service payment',
      'Assume the recipient’s contract has been correctly classified as independent-contractor services. A firm pays $2,000 based on the agreement after using futures in its operations. What is the first sound classification approach for the recipient?',
      ['Apply 60/40 automatically because the firm used futures', 'Apply the confirmed compensation/business framework to the payout', 'Treat it as a tax-free gift', 'Report only what was withdrawn from the bank'], 1,
      'The example explicitly establishes a service relationship. The firm’s product choice does not transform the recipient’s payment into their own section 1256 gain.', 'tax-business', 'tax-business-1', ['tax-irs-contractors']),
    caseOf('tax-case-12', 'A family room is also a trading room',
      'A learner uses a family recreation room for occasional trading and claims that registering an LLC makes the entire room deductible. No special exception is assumed. Which response fits the usual home-office rule?',
      ['Accept the whole-room deduction automatically', 'Create a receipt for rent that was never paid', 'Ignore personal use when any business occurs', 'Review actual qualifying business use; the stated mixed use fails the usual exclusive-use test'], 3,
      'The physical use of the area matters. An entity name does not turn personal use into exclusive business use or establish the other eligibility conditions.', 'tax-business', 'tax-business-2', ['tax-irs-home', 'tax-irs-llc'])
  ];

  for (const module of modules) {
    for (const item of module.lessons) item.decisionCaseIds = cases.filter(c => c.lessonId === item.id).map(c => c.id);
  }
  function appendUnique(target, additions, key = 'id') {
    const existing = new Set(target.map(item => String(item[key]).toLowerCase()));
    for (const item of additions) {
      const value = String(item[key]).toLowerCase();
      if (!existing.has(value)) { target.push(item); existing.add(value); }
    }
  }
  appendUnique(academy.modules, modules);
  appendUnique(academy.sources, sources);
  if (!Array.isArray(root.ReplayRiskCases)) root.ReplayRiskCases = [];
  appendUnique(root.ReplayRiskCases, cases);
  if (Array.isArray(academy.glossary)) appendUnique(academy.glossary, [
    { term: 'Adjusted basis', definition: 'The tax basis of an asset after applicable increases or decreases. It can differ from the broker’s original purchase-price display.' },
    { term: 'Wash sale', definition: 'A loss-deferral or disallowance rule involving specified substantially identical stock/securities acquisitions around a loss disposition; account type and the full facts matter.' },
    { term: 'Tax reserve', definition: 'Cash set aside for an anticipated tax obligation. It is not itself a tax payment, expense, or calculation of the final liability.' },
    { term: 'Trader tax status', definition: 'A facts-based U.S. federal classification of actual securities-trading activity. It is separate from an entity name and from a section 475 accounting election.' },
    { term: 'Section 475 election', definition: 'A tax accounting election available to eligible traders, subject to timing and procedural requirements. It can change the timing and character of covered trading results.' },
    { term: 'Section 1256 contract', definition: 'A contract in a specified federal tax category. Its classification must be established before applying the relevant mark-to-market and capital-character rules.' },
    { term: 'Disregarded entity', definition: 'An entity treated as part of its owner for the relevant federal tax purpose. This does not mean its transactions are ignored or exempt from tax.' }
  ], 'term');
  root.ReplayTaxCourse = Object.freeze({
    version: '2026.11.21.1', checked: CHECKED, title: 'Taxes, records, and business decisions', scope, practiceNote,
    moduleIds: modules.map(item => item.id), sourceIds: sources.map(item => item.id), caseIds: cases.map(item => item.id),
    lessonCount: modules.reduce((n, item) => n + item.lessons.length, 0),
    questionCount: modules.reduce((n, item) => n + item.quiz.length, 0),
    professionalMeaning: 'Professional skills describes the standard of preparation and recordkeeping taught here. Completion does not establish a professional qualification, tax status, eligibility, or a personal filing position.'
  });
})(typeof window !== 'undefined' ? window : globalThis);
