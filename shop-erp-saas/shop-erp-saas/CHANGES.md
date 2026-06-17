# Enhancements & Changes

This document lists everything added/changed on top of the existing system. No existing
layouts or UI design were redesigned — features were integrated using the current
components (`card`, `btn-*`, `input`, `Modal`, `DataTable`) and architecture.

## 1. Confirmation Dialog System
- New reusable, promise-based dialog: `client/src/context/ConfirmContext.jsx`
  (`useConfirm()` → `await confirm({ title, message, confirmText, tone })`),
  mounted in `main.jsx`.
- Tones: `danger` (delete), `warning`, `success` (activate/approve), `deactivate`.
- Wired into: Product delete, Customer delete, Employee delete, Employee
  activate/deactivate, Owner activate/deactivate, and payment approve/reject.

## 2. Medicine Discount → Percentage (%)
- `Product.discountPercent` (0–100) added + `discountedPrice` virtual.
- Products page: "Discount (%)" input with a live "Discounted Price" preview; the list
  shows struck-through MRP + discounted price + a `Disc %` column.
- POS reflects the discounted unit price (picker, cart, subtotal).
- Sales: server applies the percentage authoritatively and stores per-line `mrp`,
  `discountPercent`, and the discounted `sellingPrice` (so invoices, profit, reports
  and stock all stay consistent).

## 3. Footer Cleanup
- Removed the website hyperlink from the footer (`Footer.jsx`). The "Created by Future
  Flow AI Agency" text remains as plain text. The now-unused "Footer Website Link"
  setting was removed from Settings.

## 4. Owner Status Management
- Admin "Toggle Active" replaced with explicit **Activate / Deactivate** action that
  asks for confirmation first and shows the owner's current status as a badge.

## 5. Medicine Expiry Management
- Expiry date is **mandatory** for medicine-category products (client + server
  validation).
- List indicators: **Expired** (red badge) and **≤30 days** (red warning with days
  remaining). Batch No field added.

## 6. Owner Creation Management
- Public registration is **disabled**: `POST /api/auth/register` returns 403, the
  `/register` route redirects to `/login`, the signup link/page were removed.
- Super Admin can **Create Owner** accounts from the Admin Panel
  (`POST /api/admin/owners`).

## 7. Invoice / Slip Branding Fix
- Developer branding removed from all customer-facing prints (A4 invoice, thermal
  receipt, due receipt) and the salary slip / finance report.
- Footers now show **Shop Name, Address, Phone, Email** (new `Business.email` field,
  editable in Settings). Each owner's customers see only that owner's shop info.

## New Feature — Employee Management System
- Expanded `Employee` model: photo, auto-generated `employeeId` (EMP-####), email,
  gender, DOB, joining date, designation, department, address, emergency contact,
  salary, active/inactive status.
- Employees page: avatar/photo, name, Emp ID, designation, phone, status, and
  View / Edit / Activate-Deactivate / Pay-salary / Delete actions.
  - Search, filter by status, filter by designation, client-side pagination.
  - Add/Edit form with image upload (stored as data URL), all fields, validation.
  - Professional **profile view** (Personal + Employment information).
  - Permanent delete (with confirmation), status management (with confirmation).
- Access control: employee create/update/delete/status restricted to the shop **owner**
  (and superadmin); all queries remain scoped to the owner's business (tenant filter).

## Backend endpoints added/changed
- `POST /api/admin/owners` — Super Admin creates an owner + business.
- `GET /api/employees` — now returns all employees with `status`/`designation`/`search`
  filters; `GET /api/employees/:id`, `PATCH /api/employees/:id/status`, and a hard
  `DELETE /api/employees/:id` added.
- `POST /api/auth/register` — disabled (403).
- `Business` gains `email`; `Product` gains `discountPercent`; `Sale` items gain
  `mrp` and `discountPercent`.

> Note: `node_modules` are not bundled. From both `server/` and `client/` run
> `npm install`, then seed with `npm run seed` (server) and start as before.

---

## Feature Pack — Discounts, Suppliers, Logo Upload, Mobile Shop

### Two-tier discounts (all shops)
- Already supported and verified: per-product `discountPercent` (%) drives the
  effective unit price; the POS **flat cart discount** (BDT) is subtracted from the
  subtotal. Both are independent and shown on the A4 invoice + thermal receipt as
  Subtotal / Discount / Total / Paid / Due.

### Hold Cart (all shops)
- POS **Hold** button parks the current cart (customer, discount, paid, method) and
  clears the screen for the next customer. **Held Bills** modal lists each hold with
  customer name, time and item count; **Resume** restores it. Multiple holds
  supported. Stored in `localStorage`, scoped per `businessId`.

### Supplier Management (all shops)
- New `Supplier` + `Purchase` models, `supplierController`, `/api/suppliers` routes,
  and a **Suppliers** page (sidebar link). Tracks `totalPurchase`, `totalPaid` and a
  `due` virtual. Record a purchase (line items + paid-now) or a standalone payment;
  due decreases accordingly. Per-supplier ledger modal.

### Logo upload (all shops)
- Settings "Logo URL" text field replaced by an **image upload** control with preview
  + remove (stored as a data URL in `Business.logoUrl`, ≤1 MB). The logo now renders
  in the A4 invoice and thermal receipt headers.

### Business Type → "Mobile Shop Management"
- `Business.type` enum extended with `mobile`. Added to Super-Admin **Create Owner**
  and **Settings** dropdowns. Mobile-only modules render conditionally on
  `business.type === 'mobile'`.

### Mobile Shop modules (only when type = `mobile`)
- **IMEI / Serial tracking** — `PhoneUnit` model (one row per physical device,
  `in_stock`/`sold`). Products get `trackSerial`, `brand`, `color`, `storage`,
  `warrantyBrandMonths`, `warrantyShopMonths`. "Manage IMEIs" modal on Products adds
  units (single or bulk paste, duplicate IMEI blocked); product stock = count of
  in-stock units.
- **POS by IMEI** — scan/type an IMEI to drop the exact device into the cart; sale
  marks that unit `sold`, prints its IMEI + warranty on the receipt, decrements stock.
  Customer **NID** capture at sale time.
- **Warranty Check portal** — search by IMEI to see sale date, customer, and
  Active/Expired status.
- **EMI / Installments** — `Installment` model + page; auto-generates a monthly
  schedule from total/down/months; mark each instalment paid; running balance.
- **Service / Repair** — `ServiceJob` model + page; job sheet (problem, budget,
  technician), status flow Pending → Repairing → Completed → Delivered, and
  service-fee + parts billing total.

### Misc
- `Customer` gains `nid`; `Sale` gains `customerNid` and per-item
  `unit/imei1/imei2/serial/warrantyMonths/warrantyExpiry`.
- Fixed a pre-existing bug where the Customers delete button passed an id instead of
  the row object (delete + confirmation text were broken).
- Seed adds a demo **Mobile Shop** (`mobile@demo.com` / `owner123`) with an
  IMEI-tracked iPhone + units, and a sample supplier.
