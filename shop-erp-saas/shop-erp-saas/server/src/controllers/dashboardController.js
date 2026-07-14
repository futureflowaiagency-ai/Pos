import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Employee from '../models/Employee.js';
import ServiceJob from '../models/ServiceJob.js';
import Installment from '../models/Installment.js';
import ActivityLog from '../models/ActivityLog.js';
import MarketingSettings from '../models/MarketingSettings.js';
import { decryptSecret } from '../utils/secretCrypto.js';
import { generateText, hasCentralAI } from '../services/aiService.js';
import { computeBalances } from '../services/balanceService.js';

// Resolve a { from, to } window from a named period or an explicit custom range.
// period: daily | weekly | monthly | half_yearly | yearly | custom
function resolveRange(period = 'monthly', from, to) {
  const now = new Date();
  let start;
  const end = to ? new Date(to + 'T23:59:59') : now;
  switch (period) {
    case 'daily': start = new Date(); start.setHours(0, 0, 0, 0); break;
    case 'weekly': start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); break;
    case 'half_yearly': start = new Date(now.getFullYear(), now.getMonth() - 5, 1); break;
    case 'yearly': start = new Date(now.getFullYear(), 0, 1); break;
    case 'custom': start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'monthly':
    default: start = new Date(now.getFullYear(), now.getMonth(), 1); break;
  }
  return { from: start, to: end };
}

// @route GET /api/dashboard/summary?period=&from=&to=
export const dashboardSummary = asyncHandler(async (req, res) => {
  const bId = new mongoose.Types.ObjectId(req.businessId);
  const { period = 'monthly', from, to } = req.query;
  const range = resolveRange(period, from, to);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [salesAgg, todayAgg, expenseAgg, products, dueAgg, employeesCount, topProducts, recentOrders, paymentAgg, recentActivities, periodSalesAgg, periodExpenseAgg, balances, periodServiceAgg, activeEmis] = await Promise.all([
    Sale.aggregate([
      { $match: { business: bId, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, profit: { $sum: '$profit' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { business: bId, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { business: bId, date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Product.find({ business: bId, isActive: true }),
    Customer.aggregate([
      { $match: { business: bId } },
      { $group: { _id: null, totalDue: { $sum: '$totalDue' } } },
    ]),
    Employee.countDocuments({ business: bId, isActive: true }),
    // Top selling products this month (by qty sold)
    Sale.aggregate([
      { $match: { business: bId, createdAt: { $gte: startOfMonth } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.sellingPrice'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
    // Recent orders
    Sale.find({ business: bId }).sort('-createdAt').limit(6).select('invoiceNo customerName total paymentMethod createdAt'),
    // Payment method breakdown this month
    Sale.aggregate([
      { $match: { business: bId, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    // Recent activity log
    ActivityLog.find({ business: bId }).sort('-createdAt').limit(7).populate('user', 'name'),
    // Period-scoped sales (respects the dashboard date filter)
    Sale.aggregate([
      { $match: { business: bId, createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, profit: { $sum: '$profit' }, count: { $sum: 1 } } },
    ]),
    // Period-scoped expenses
    Expense.aggregate([
      { $match: { business: bId, date: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Cumulative per-method balances (cash/bank/bkash/nagad/rocket/card)
    computeBalances(req.businessId),
    // Period-scoped Service & Repair financials (req 9)
    ServiceJob.aggregate([
      { $match: { business: bId, createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: {
        _id: null,
        revenue: { $sum: '$total' },
        partsCost: { $sum: '$partsCost' },
        technicianCost: { $sum: '$technicianCost' },
        profit: { $sum: '$profit' },
        count: { $sum: 1 },
      } },
    ]),
    // Active EMI plans — summed in JS (uses the `balance` virtual) for EMI Receivable (req 10)
    Installment.find({ business: bId, status: 'active' }),
  ]);

  const monthRevenue = salesAgg[0]?.revenue || 0;
  const monthProfit = salesAgg[0]?.profit || 0;
  const monthExpense = expenseAgg[0]?.total || 0;
  const lowStock = products.filter((p) => p.stock <= p.lowStockAlert);

  const periodRevenue = periodSalesAgg[0]?.revenue || 0;
  const periodProfit = periodSalesAgg[0]?.profit || 0;
  const periodExpense = periodExpenseAgg[0]?.total || 0;

  ok(res, {
    summary: {
      monthRevenue,
      monthProfit,
      monthExpense,
      netProfit: monthProfit - monthExpense,
      monthSalesCount: salesAgg[0]?.count || 0,
      todayRevenue: todayAgg[0]?.revenue || 0,
      todaySalesCount: todayAgg[0]?.count || 0,
      totalProducts: products.length,
      lowStockCount: lowStock.length,
      totalDue: dueAgg[0]?.totalDue || 0, // regular sales due only — EMI due is tracked separately below (req 10)
      emiReceivable: activeEmis.reduce((s, i) => s + i.balance, 0),
      activeEmiCount: activeEmis.length,
      employeesCount,
      // ---- period-scoped (dashboard date filter) ----
      period,
      periodFrom: range.from,
      periodTo: range.to,
      periodRevenue,
      periodProfit,
      periodExpense,
      periodNetProfit: periodProfit - periodExpense,
      periodSalesCount: periodSalesAgg[0]?.count || 0,
      // ---- cumulative balances ----
      balances,
      cardCollection: balances.card,
      // ---- Service & Repair (period-scoped, req 9) ----
      service: {
        revenue: periodServiceAgg[0]?.revenue || 0,
        partsCost: periodServiceAgg[0]?.partsCost || 0,
        technicianCost: periodServiceAgg[0]?.technicianCost || 0,
        netProfit: periodServiceAgg[0]?.profit || 0,
        count: periodServiceAgg[0]?.count || 0,
      },
    },
    lowStockProducts: lowStock.slice(0, 8),
    topProducts,
    recentOrders,
    paymentBreakdown: paymentAgg,
    recentActivities: recentActivities.map((a) => ({
      action: a.action,
      entity: a.entity,
      user: a.user?.name || 'System',
      createdAt: a.createdAt,
    })),
  });
});

// @route POST /api/dashboard/ai-summary  — on-demand AI insight using the owner's own key
export const aiSummary = asyncHandler(async (req, res) => {
  const settings = await MarketingSettings.findOne({ business: req.businessId });
  const ai = settings?.ai ? { ...settings.ai.toObject(), apiKey: decryptSecret(settings.ai.apiKey) } : null;
  if (!ai?.apiKey && !hasCentralAI()) throw new ApiError(400, 'AI is not configured. Add your AI API key in Marketing → Integrations & Keys first');

  const { summary = {}, topProducts = [], lang = 'en' } = req.body;
  const top = topProducts.slice(0, 5).map((p) => `${p._id} (${p.qty} sold)`).join(', ') || 'none yet';
  const prompt = [
    'You are a concise business analyst for a small shop. Based on the numbers below, write a short, friendly summary (3-4 sentences max) highlighting how the business is doing this month and ONE practical suggestion. Plain text only, no markdown, no headings.',
    lang === 'bn' ? 'Write the entire summary in Bengali (Bangla).' : '',
    '',
    `This month revenue: ${summary.monthRevenue ?? 0}`,
    `Net profit: ${summary.netProfit ?? 0} (expenses: ${summary.monthExpense ?? 0})`,
    `Orders this month: ${summary.monthSalesCount ?? 0}`,
    `Today's sales: ${summary.todayRevenue ?? 0} from ${summary.todaySalesCount ?? 0} orders`,
    `Total customer due: ${summary.totalDue ?? 0}`,
    `Low-stock products: ${summary.lowStockCount ?? 0}`,
    `Top sellers: ${top}`,
  ].join('\n');

  const text = await generateText(ai, prompt, 500);
  ok(res, { summary: text });
});

// @route GET /api/dashboard/revenue-chart  (last 7 days)
export const revenueChart = asyncHandler(async (req, res) => {
  const bId = new mongoose.Types.ObjectId(req.businessId);
  const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);

  const data = await Sale.aggregate([
    { $match: { business: bId, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        profit: { $sum: '$profit' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  ok(res, { chart: data });
});
