import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Employee from '../models/Employee.js';

// @route GET /api/dashboard/summary
export const dashboardSummary = asyncHandler(async (req, res) => {
  const bId = new mongoose.Types.ObjectId(req.businessId);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [salesAgg, todayAgg, expenseAgg, products, dueAgg, employeesCount] = await Promise.all([
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
  });
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
