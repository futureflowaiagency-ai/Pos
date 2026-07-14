import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Fund from '../models/Fund.js';
import Expense from '../models/Expense.js';
import DuePayment from '../models/DuePayment.js';
import ServiceJob from '../models/ServiceJob.js';
import Installment from '../models/Installment.js';
import Purchase from '../models/Purchase.js';
import Return from '../models/Return.js';

export const METHODS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'];

const emptyMap = () => METHODS.reduce((m, k) => { m[k] = 0; return m; }, {});

// Cumulative money-in/out per payment method → current balance per method.
// Money IN  = sale at-sale `paid` (by `paidVia`, includes exchange-created sales)
//           + due collections (by method) + service job `paid` (by paymentMethod)
//           + EMI down payments (by downPaymentMethod) + EMI instalment payments
//           (by schedule.method) + funds (by source)
// Money OUT = expenses (by source) + supplier purchase/payment `paid` (by source)
//           + return/exchange cash refunds (by refundMethod; store-credit is excluded — no cash moves)
export async function computeBalances(businessId) {
  const bId = new mongoose.Types.ObjectId(businessId);

  const [salesIn, dueIn, serviceIn, emiDownIn, emiScheduleIn, fundsIn, expOut, supplierOut, refundOut] = await Promise.all([
    Sale.aggregate([
      { $match: { business: bId } },
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
    Fund.aggregate([
      { $match: { business: bId } },
      { $group: { _id: { $ifNull: ['$source', 'cash'] }, amount: { $sum: '$amount' } } },
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
  for (const r of salesIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of dueIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of serviceIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of emiDownIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of emiScheduleIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of fundsIn) if (r._id in inflow) inflow[r._id] += r.amount || 0;
  for (const r of expOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of supplierOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;
  for (const r of refundOut) if (r._id in outflow) outflow[r._id] += r.amount || 0;

  const balances = emptyMap();
  for (const m of METHODS) balances[m] = inflow[m] - outflow[m];
  return balances; // { cash, bank, bkash, nagad, rocket, card }
}
