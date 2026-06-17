# 🏪 Shop ERP SaaS

A **production-ready, multi-tenant Shop Owner Business Management ERP SaaS** built on the MERN stack. Each shop owner gets an isolated workspace to manage inventory, sales (POS), customers, employees, finance, and printing — with a subscription billing system and a separate super-admin panel.

> Created by **Future Flow AI Agency**

---

## ✨ Features

**Core**
- 📦 Products — CRUD, stock management, purchase/selling price, low-stock alerts
- 🧾 Sales / POS Lite — fast point-of-sale, invoice generation, automatic profit calculation, daily/monthly reports
- 👥 Customers — list, due tracking, purchase history, due collection with receipt
- 🧑‍💼 Employees — management + salary tracking (paid/due) with salary slips
- 💰 Finance — income from sales, expense tracking, profit/loss, monthly reports
- 📊 Dashboard — revenue charts, sales summary, stock overview, due summary

**System**
- 🏢 **Multi-tenant** — every business is fully isolated by `businessId`; no data sharing
- 🔐 JWT auth + role-based access (`superadmin`, `owner`, `staff`)
- 🌙 Full **dark / light mode** (localStorage + DB persistence) across the whole app
- 🖨️ **Advanced print system** — A4 invoices, salary slips, due receipts, sales reports + **80mm thermal** receipts optimised for pharmacy roll printers (compact, monospace, auto-cut layout)
- 💳 **Subscription system** — bKash / Nagad / Manual payments with TRX ID submission, admin approve/reject, monthly / half-yearly / yearly plans
- 📝 Activity logs
- 💬 Floating WhatsApp button + editable footer branding
- 🛠️ Separate **Admin** and **Business** dashboards

---

## 🧱 Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 (Vite), TailwindCSS, React Router, Recharts, lucide-react, react-hot-toast, Axios |
| Backend  | Node.js, Express, Mongoose, JWT, bcryptjs, helmet, cors, express-rate-limit |
| Database | MongoDB |

---

## 📁 Project Structure

```
shop-erp-saas/
├── package.json            # root scripts (concurrently)
├── server/                 # Express + MongoDB API
│   ├── src/
│   │   ├── config/         # env, db connection
│   │   ├── models/         # User, Business, Product, Sale, Customer,
│   │   │                   #   Employee, Expense, Subscription, Payment,
│   │   │                   #   Notification, ActivityLog
│   │   ├── controllers/    # business logic
│   │   ├── routes/         # REST endpoints (mounted under /api)
│   │   ├── middleware/     # auth, role, tenant, error, activityLogger
│   │   ├── utils/          # asyncHandler, ApiError, apiResponse, token
│   │   ├── seed/           # demo data seeder
│   │   ├── app.js
│   │   └── server.js
│   └── .env.example
└── client/                 # React (Vite) SPA
    ├── src/
    │   ├── api/            # axios instance
    │   ├── components/     # ui, charts, print, layout
    │   ├── context/        # Auth + Theme
    │   ├── pages/          # Dashboard, Products, POS, Customers, ...
    │   │   └── admin/      # AdminPanel
    │   ├── routes/         # Protected + Admin route guards
    │   └── utils/
    └── .env.example
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI

### 1. Install dependencies
```bash
# from project root — installs both server and client
npm run install:all
# (or install manually in each folder)
```

### 2. Configure environment

**server/.env** (copy from `server/.env.example`)
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/shop_erp_saas
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRE=30d
CLIENT_URL=http://localhost:5173
```

**client/.env** (copy from `client/.env.example`)
```
VITE_API_URL=http://localhost:5000/api
VITE_WHATSAPP_NUMBER=8801XXXXXXXXX
```

### 3. Seed demo data
```bash
npm run seed
```

### 4. Run (both server + client together)
```bash
# install concurrently once at root: npm install
npm run dev
```
Or run separately:
```bash
npm run server   # http://localhost:5000
npm run client   # http://localhost:5173
```

---

## 🔑 Demo Credentials

| Role        | Email                   | Password   |
|-------------|-------------------------|------------|
| Super Admin | `admin@futureflow.ai`   | `admin123` |
| Shop Owner  | `owner@demo.com`        | `owner123` |

The demo owner is a **Pharmacy** business with an active subscription, sample products (incl. a low-stock item), customers, and an employee.

---

## 🖨️ Printing Notes
- **A4** documents (invoice, salary slip, sales report) use clean print styles via `@media print`.
- **Thermal (80mm)** receipts use a narrow monospace layout with dashed dividers and an auto-cut spacer — ideal for pharmacy roll printers.
- The POS defaults to thermal printing for pharmacy-type businesses; toggle A4/Thermal in the print preview.
- Default print mode is also configurable per-business in **Settings**.

---

## 🔌 API Overview
All tenant routes are auto-scoped by the `businessId` embedded in the JWT.

```
POST   /api/auth/register          POST  /api/auth/login        GET  /api/auth/me
GET/PUT /api/business
CRUD   /api/products               POST  /api/sales             GET  /api/sales/report
CRUD   /api/customers              POST  /api/customers/:id/collect-due
CRUD   /api/employees              POST  /api/employees/:id/salary
GET/POST/DELETE /api/expenses
GET    /api/dashboard/summary      GET   /api/dashboard/revenue-chart
GET    /api/payments/plans         POST  /api/payments          GET  /api/payments/mine
GET    /api/admin/overview         GET   /api/admin/payments     PATCH /api/admin/payments/:id
GET    /api/activity-logs
```

---

## 🧩 Extending (plugin-like)
Add a new module by creating a model → controller → route → mounting it in `routes/index.js`, then a matching page + sidebar link on the client. The tenant middleware and response helpers keep new modules consistent and isolated automatically.

---

© Future Flow AI Agency
