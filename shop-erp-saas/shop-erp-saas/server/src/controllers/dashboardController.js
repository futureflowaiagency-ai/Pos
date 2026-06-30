import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Employee from '../models/Employee.js';
import ActivityLog from '../models/ActivityLog.js';
import MarketingSettings from '../models/MarketingSettings.js';
import { decryptSecret } from '../utils/secretCrypto.js';
import { generateText } from '../services/aiService.js';

// @route GET /api/dashboard/summary
export const dashboardSummary = asyncHandler(async (req, res) => {
  const bId = new mongoose.Types.ObjectId(req.businessId);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [salesAgg, todayAgg, expenseAgg, products, dueAgg, employeesCount, topProducts, recentOrders, paymentAgg, recentActivities] = await Promise.all([
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
  ]);

  const monthRevenue = salesAgg[0]?.revenue || 0;
  const monthProfit = salesAgg[0]?.profit || 0;
  const monthExpense = expenseAgg[0]?.total || 0;
  const lowStock = products.filter((p) => p.stock <= p.lowStockAlert);

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
      totalDue: dueAgg[0]?.totalDue || 0,
      employeesCount,
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
  if (!ai?.apiKey) throw new ApiError(400, 'Add your AI API key in Marketing → Integrations & Keys first');

  const { summary = {}, topProducts = [] } = req.body;
  const top = topProducts.slice(0, 5).map((p) => `${p._id} (${p.qty} sold)`).join(', ') || 'none yet';
  const prompt = [
    'You are a concise business analyst for a small shop. Based on the numbers below, write a short, friendly summary (3-4 sentences max) highlighting how the business is doing this month and ONE practical suggestion. Plain text only, no markdown, no headings.',
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
