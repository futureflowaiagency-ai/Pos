import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Fund from '../models/Fund.js';
import Expense from '../models/Expense.js';
import DuePayment from '../models/DuePayment.js';
import ServiceJob from '../models/ServiceJob.js';
import Installment from '../models/Installment.js';
import Purchase from '../models/Purchase.js';
import Return from '../models/Return.js';
import Transfer from '../models/Transfer.js';

export const METHODS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'];

const emptyMap = () => METHODS.reduce((m, k) => { m[k] = 0; return m; }, {});

// Cumulative money-in/out per payment method → current balance per method.
// Money IN  = sale at-sale `paid` — split across `payments[]` when present (multi-tender
//           checkout), else the legacy single `paidVia` (includes exchange-created sales)
//           + due collections (by method) + service job `paid` (by paymentMethod)
//           + EMI down payments (by downPaymentMethod) + EMI instalment payments
//           (by schedule.method) + funds added (by source) + transfers in (by toMethod)
// Money OUT = expenses (by source) + supplier purchase/payment `paid` (by source)
//           + return/exchange cash refunds (by refundMethod; store-credit is excluded — no cash moves)
//           + funds withdrawn (by source) + transfers out (by fromMethod)
export async function computeBalances(businessId) {
  const bId = new mongoose.Types.ObjectId(businessId);

  const [
    splitSalesIn, legacySalesIn, dueIn, serviceIn, emiDownIn, emiScheduleIn,
    fundsAddIn, fundsWithdrawOut, transfersIn, transfersOut,
    expOut, supplierOut, refundOut,
  ] = await Promise.all([
    // Multi-tender sales: unwind the payments[] breakdown
    Sale.aggregate([
      { $match: { business: bId, 'payments.0': { $exists: true } } },
      { $unwind: '$payments' },
      { $group: { _id: '$payments.method', amount: { $sum: '$payments.amount' } } },
    ]),
    // Legacy single-tender sales (no payments[] recorded) — fall back to paid+paidVia
    Sale.aggregate([
      { $match: { business: bId, $or: [{ payments: { $exists: false } }, { payments: { $size: 0 } }] } },
      { $group: { _id: { $ifNull: ['$paidVia', 'cash'] }, amount: { $sum: '$paid' } } },
    ]),
    DuePayment.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$method', 'cash'] }, amount: { $sum: '$amount' } } },
    ]),
    ServiceJob.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$paymentMethod', 'cash'] }, amount: { $sum: '$paid' } } },
    ]),
    Installment.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$downPaymentMethod', 'cash'] }, amount: { $sum: '$downPayment' } } },
    ]),
    Installment.aggregate([
      { $match: { business: bId } },
      { $unwind: '$schedule' },
      { $match: { 'schedule.paid': true } },
      { $group: { _id: { $ifNull: ['$schedule.method', 'cash'] }, amount: { $sum: '$schedule.amount' } } },
    ]),
    // Capital brought in (money IN)
    Fund.aggregate([
      { $match: { business: bId, type: { $ne: 'withdraw' } } },
      { $group: { _id: { $ifNull: ['$source', 'cash'] }, amount: { $sum: '$amount' } } },
    ]),
    // Capital taken back out (money OUT) — not an expense, just a reversal of prior capital
    Fund.aggregate([
      { $match: { business: bId, type: 'withdraw' } },
      { $group: { _id: { $ifNull: ['$source', 'cash'] }, amount: { $sum: '$amount' } } },
    ]),
    // Balance transfers — money arriving in the `to` method
    Transfer.aggregate([
      { $match: { business: bId } },
      { $group: { _id: '$toMethod', amount: { $sum: '$amount' } } },
    ]),
    // Balance transfers — money leaving the `from` method
    Transfer.aggregate([
      { $match: { business: bId } },
      { $group: { _id: '$fromMethod', amount: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$source', 'cash'] }, amount: { $sum: '$amount' } } },
    ]),
    // supplier purchases (paid-now portion) + standalone due payments — both are money OUT
    Purchase.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$source', 'cash'] }, amount: { $sum: '$paid' } } },
    ]),
    // return/exchange cash refunds — money OUT (store credit is intentionally excluded)
    Return.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$refundMethod', 'cash'] }, amount: { $sum: '$cashRefund' } } },
    ]),
  ]);

  const inflow = emptyMap();
  const outflow = emptyMap();
  for (const r of splitSalesIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of legacySalesIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of dueIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of serviceIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of emiDownIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of emiScheduleIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of fundsAddIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of transfersIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of fundsWithdrawOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of transfersOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of expOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of supplierOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of refundOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;

  const balances = emptyMap();
  for (const m of METHODS) balances[m] = inflow[m] - outflow[m];
  return balances; // { cash, bank, bkash, nagad, rocket, card }
}
