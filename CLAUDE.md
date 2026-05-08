# مصنعي (Masna3i) — نظام ERP لمصانع التعبئة والتغليف
> آخر تحديث: 2026-05-09

## النظام

- **URL:** masnaee.com
- **النوع:** Factory ERP — SaaS product (بيتباع لأكتر من مصنع)
- **Backend:** Node.js 22 + Express 4 (ES modules)
- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3
- **Database:** MySQL 8 — utf8mb4 — InnoDB
- **Auth:** JWT (Bearer token) + bcryptjs
- **State:** Zustand
- **Port:** Backend 5020 — Frontend static via Nginx
- **مسار الكود:** `E:\ai\masna3i`
- **Git:** github.com/ahmedsamirfreelancer/masnaee
- **السيرفر:** VPS KVM2 — 31.97.196.31 — Ubuntu 24.04
- **مسار السيرفر:** `/var/www/masnaee`

## قواعد العمل

1. الكود فقط في `E:\ai\masna3i` — أبداً `C:\Users\ahmed\`
2. الديبلوي: `git push` → SSH pull على السيرفر — مفيش GitHub Actions
3. قبل كل push: `cd frontend && npx vite build` — السيرفر مش بيعمل build
4. `frontend/dist/` لازم يتضاف في كل commit فيه تغيير فرونت
5. قبل `git push` اعمل `git pull` الأول — فيه أكتر من تاب شغال
6. `commit + push` فوراً بعد كل تغيير — متستناش
7. الـ API response format: `{ success: true/false, data/message }` — data ممكن يرجع object مش array — استخدم `safeArray()` دايماً في الفرونت
8. الـ permissions في الـ roles table هي JSON array مش object — MySQL بيرجعها كـ parsed object مش string
9. الـ settings table: column اسمه `key` مش `setting_key` + فيه column `group`
10. الـ roles table: فيها `display_name` و `is_system`
11. meta routes (departments, standards, categories) مسارها `/meta/xxx` مش `/xxx` مباشرة
12. لا retries عمياء — شخّص السبب الأول، max 2 محاولات، لو اتكسر ارجع للأصل
13. الكلام بالعربي مختصر — استنى موافقة قبل أي تغيير كبير
14. CLAUDE.md يتحدث بس للتغييرات الهيكلية (صفحة/جدول/قاعدة جديدة) مش كل feature

## الديبلوي

```
git add + commit → git push → ssh pull on VPS → pm2 restart masnaee-api
```

- **Process Manager:** PM2 — اسم العملية `masnaee-api`
- **Web Server:** Nginx — config في `/etc/nginx/sites-available/masnaee`
- **SSL:** Cloudflare Flexible (مفيش شهادة على السيرفر)
- **Frontend:** static files من `frontend/dist/` — Nginx بيخدمها
- **API Proxy:** Nginx بيمرر `/api/` لـ `localhost:5020`
- **DB User:** `masna3i` على database `masna3i`
- **ENV Variables:** `PORT`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `UPLOAD_DIR`, `MAX_FILE_SIZE`

## هيكل المشروع

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MySQL2 pool
│   │   └── constants.js         # Roles, permissions, enums
│   ├── middleware/
│   │   ├── auth.js              # JWT verify + authorize(permissions)
│   │   ├── validate.js          # express-validator handler
│   │   └── errorHandler.js      # Global error handler + AppError class
│   ├── routes/                  # 22 route files (see Routes section)
│   ├── utils/
│   │   └── helpers.js           # generateNumber, formatCurrency, paginate, buildFilters
│   ├── app.js                   # Express setup + route mounting at /api/v1/*
│   └── server.js                # Entry point — port from ENV
├── migrations/
│   └── 001_initial_schema.sql   # 43 tables + seed data
├── package.json
└── .env.example

frontend/
├── src/
│   ├── components/
│   │   ├── ui/                  # Button, Input, Select, Card, Badge, Modal, DataTable, StatsCard, PageHeader
│   │   ├── ProtectedRoute.jsx   # Auth guard
│   │   └── ErrorBoundary.jsx    # Catches page errors — shows Arabic message
│   ├── hooks/
│   │   └── useAuth.js           # Zustand store — user, token, login, logout, hasPermission
│   ├── layouts/
│   │   └── DashboardLayout.jsx  # Sidebar + topbar + Outlet
│   ├── pages/                   # 22 pages (see Pages section)
│   ├── utils/
│   │   ├── api.js               # Axios instance + safeArray() helper
│   │   └── formatters.js        # formatCurrency, formatDate, formatNumber
│   ├── styles/
│   │   └── index.css            # Tailwind directives + custom scrollbar + RTL fixes
│   ├── App.jsx                  # React Router routes
│   └── main.jsx                 # Entry — BrowserRouter + Toaster
├── public/
│   ├── logo.svg                 # Full logo (icon + text)
│   ├── logo-icon.svg            # Icon only
│   └── favicon.svg
├── dist/                        # Built files — MUST commit
├── package.json
├── vite.config.js               # Proxy /api → localhost:5020
├── tailwind.config.js           # Cairo font, RTL, custom colors
└── postcss.config.js
```

## الصفحات / Routes

**Backend API** — كلها تحت `/api/v1/`:

- `auth` — login, me, change-password
- `users` — CRUD + `GET /roles`
- `products` — CRUD + `GET /meta/categories`
- `materials` — CRUD + `GET /low-stock`
- `recipes` — CRUD مع items array
- `production` — CRUD + `/:id/start` + `/:id/complete` + `/:id/cancel` + `/:id/log`
- `inventory` — `GET /stock` + `GET /movements` + `GET /low-stock` + `GET /warehouses` + `POST /adjustment`
- `customers` — CRUD + `GET /stats/:id` + `GET /:id/orders`
- `suppliers` — CRUD + `GET /:id/orders`
- `sales` — CRUD + `/:id/confirm` + `/:id/ship` + `/:id/deliver` + `/:id/cancel` + `POST /returns`
- `purchases` — CRUD + `/:id/receive` + `/:id/cancel` + `POST /returns`
- `accounting` — `GET /chart-of-accounts` + `GET,POST /journal-entries` + `PUT /:id/post` + `GET /trial-balance` + `GET /income-statement` + `GET /balance-sheet` + `GET /ledger/:accountId`
- `expenses` — CRUD + `GET /categories` + `GET /summary`
- `payments` — CRUD + `GET /cash-register` + `POST /cash-register/open` + `POST /cash-register/close`
- `assets` — CRUD + `POST /depreciate`
- `employees` — CRUD + `GET /meta/departments` + `POST /meta/departments`
- `attendance` — GET + POST + `POST /bulk` + `GET /summary`
- `salaries` — GET + `POST /calculate` + `POST /pay` + `GET /advances` + `POST /advances`
- `quality` — CRUD + `GET /meta/standards` + `POST /meta/standards`
- `reports` — `GET /sales` + `/purchases` + `/production` + `/inventory` + `/customers` + `/suppliers` + `/profit` + `/cashflow`
- `settings` — GET + PUT + `GET /units` + `POST /units` + `POST /categories` + `GET /activity-log`
- `dashboard` — `GET /stats` + `/sales-chart` + `/top-products` + `/recent-orders` + `/low-stock` + `/production-status`

**Frontend Pages** (22 صفحة):

- `LoginPage` — تسجيل دخول
- `DashboardPage` — إحصائيات + charts + تنبيهات
- `ProductsPage` — CRUD منتجات + أحجام
- `MaterialsPage` — CRUD خامات
- `RecipesPage` — تركيبات/وصفات إنتاج مع مكونات
- `ProductionPage` — أوامر إنتاج (بدء/إكمال/إلغاء)
- `InventoryPage` — أرصدة + حركات + تعديلات
- `SalesPage` — طلبات بيع مع عناصر (مسودة←تأكيد←شحن←تسليم)
- `CustomersPage` — CRUD عملاء
- `PurchasesPage` — أوامر شراء مع استلام
- `SuppliersPage` — CRUD موردين
- `ChartOfAccountsPage` — شجرة حسابات (tree view)
- `JournalEntriesPage` — قيود يومية مع بنود (debit=credit)
- `ExpensesPage` — مصروفات + ملخص بتصنيفات
- `PaymentsPage` — مدفوعات واردة/صادرة
- `AssetsPage` — أصول ثابتة + إهلاك
- `EmployeesPage` — CRUD موظفين
- `AttendancePage` — حضور يومي + ملخص شهري
- `SalariesPage` — حساب وصرف مرتبات + سلف
- `QualityPage` — فحوصات جودة مع معايير
- `ReportsPage` — تقارير شاملة مع charts
- `SettingsPage` — إعدادات عامة + مستخدمين + وحدات + تصنيفات

## Authentication والصلاحيات

- **النوع:** JWT Bearer token — صلاحية 7 أيام
- **Middleware:** `authenticate` (verify token) + `authorize(...permissions)` (check role)
- **التخزين:** localStorage — `masna3i_token` + `masna3i_user`
- **401 handling:** Axios interceptor بيعمل logout تلقائي

**الأدوار (5):**
- `admin` (مدير النظام) — كل الصلاحيات `["*"]`
- `accountant` (محاسب) — مالية + مبيعات + مشتريات + تقارير
- `production_supervisor` (مشرف إنتاج) — إنتاج + مخزون + جودة + خامات
- `worker` (عامل) — إنتاج (عرض + تسجيل) + حضور شخصي
- `sales_rep` (مندوب مبيعات) — مبيعات + عملاء + عرض منتجات

**Permission format:** `module.action` — مثل `sales.create`, `inventory.view`, `accounting.*`

## قاعدة البيانات

**43 جدول** — MySQL 8 — utf8mb4_unicode_ci — InnoDB

**Core:**
- `settings` — إعدادات key/value مع group
- `roles` — أدوار + permissions JSON array + display_name
- `users` — مستخدمين + role_id FK
- `activity_log` — سجل العمليات
- `notifications` — إشعارات

**المنتجات والخامات:**
- `categories` — تصنيفات (type: product/material)
- `units` — وحدات (كيلو، لتر، قطعة...)
- `products` — منتجات تامة + sku + barcode
- `product_sizes` — أحجام لكل منتج
- `raw_materials` — خامات + حد أدنى

**التركيبات والإنتاج:**
- `recipes` — وصفات إنتاج (product → output_quantity)
- `recipe_items` — مكونات الوصفة (material + quantity + waste%)
- `production_orders` — أوامر تشغيل (planned→in_progress→completed)
- `production_logs` — سجل الإنتاج

**المخزون:**
- `warehouses` — مخازن
- `inventory_movements` — حركات مخزون (in/out/transfer/adjustment)

**المبيعات والمشتريات:**
- `customers` — عملاء (wholesale/retail/distributor) + balance + credit_limit
- `suppliers` — موردين + balance
- `sales_orders` + `sales_order_items` — طلبات بيع (draft→confirmed→shipped→delivered)
- `sales_returns` — مرتجعات مبيعات
- `purchase_orders` + `purchase_order_items` — أوامر شراء (draft→confirmed→received)
- `purchase_returns` — مرتجعات مشتريات

**المحاسبة (Double-Entry):**
- `account_types` — 5 أنواع (أصول/خصوم/حقوق ملكية/إيرادات/مصروفات)
- `chart_of_accounts` — شجرة حسابات 3 مستويات — self-referencing parent_id
- `fiscal_years` — سنوات مالية
- `journal_entries` — قيود يومية (total_debit must = total_credit)
- `journal_entry_lines` — بنود القيد (account_id + debit/credit)
- `payment_methods` — طرق دفع (نقدي/بنكي/شيك) — linked to chart_of_accounts
- `payments` — مدفوعات (received/made) — linked to journal_entry
- `expenses` — مصروفات — linked to journal_entry
- `cash_register` — صندوق يومي

**الأصول:**
- `assets` — أصول ثابتة (machinery/vehicle/equipment/furniture)
- `asset_depreciation` — سجل الإهلاك الشهري

**الموارد البشرية:**
- `departments` — أقسام
- `employees` — موظفين (salary_type: monthly/daily/hourly)
- `attendance` — حضور يومي (present/absent/late/leave/holiday)
- `salary_payments` — مرتبات (base + overtime - deductions - advances = net)
- `employee_advances` — سلف

**الجودة:**
- `quality_standards` — معايير الفحص
- `quality_checks` — فحوصات (incoming/outgoing/in_process) — result: pass/fail/conditional
- `quality_check_items` — تفاصيل الفحص

**Status Flows:**
- Sales: `draft → confirmed → processing → shipped → delivered` (or `cancelled`)
- Purchases: `draft → confirmed → received` (or `partial` / `cancelled`)
- Production: `planned → in_progress → completed` (or `cancelled`)
- Returns: `pending → approved → completed`
- Journal: `created → posted` (posted updates account balances)

## الميزات الرئيسية

**المنتجات والإنتاج:**
- منتجات + أحجام متعددة + باركود
- تركيبات (BOM) — كل منتج = خامات × كميات + نسبة هالك
- أوامر إنتاج — بدء بيخصم خامات، إكمال بيضيف منتجات تامة
- تنبيهات نقص مخزون

**المبيعات والمشتريات:**
- دورة بيع كاملة مع auto-generated order numbers
- دورة شراء مع استلام جزئي
- مرتجعات مبيعات ومشتريات
- تتبع أرصدة العملاء والموردين

**المحاسبة:**
- شجرة حسابات 49 حساب جاهزة (3 مستويات)
- قيود يومية double-entry مع validation
- قيود تلقائية مع: بيع، شراء، مصروف، مرتب، إهلاك
- ميزان المراجعة + قائمة الدخل + الميزانية العمومية + كشف حساب

**الموارد البشرية:**
- حضور يومي (فردي + bulk)
- حساب مرتبات تلقائي (أساسي + إضافي - خصومات - سلف)
- إدارة سلف

**Dashboard:**
- 6 بطاقات إحصائية + رسم مبيعات 30 يوم + أكثر المنتجات مبيعاً
- آخر الطلبات + تنبيهات نقص المخزون + إجراءات سريعة

**UI/UX:**
- واجهة عربية RTL كاملة + Dark mode + Responsive
- PageHeader مع tooltip شرح لكل صفحة
- ErrorBoundary بيظهر رسالة عربية بدل شاشة بيضاء

## Dependencies الرئيسية

**Backend:**
- `express` — Web framework
- `mysql2` — MySQL driver (promise-based pool)
- `jsonwebtoken` + `bcryptjs` — Auth
- `express-validator` — Validation
- `helmet` + `cors` — Security
- `multer` — File uploads
- `dayjs` — Date handling

**Frontend:**
- `react` + `react-router-dom` — UI + routing
- `axios` — HTTP client + `safeArray()` helper
- `zustand` — State management (auth store)
- `recharts` — Charts
- `@headlessui/react` — Modals (Dialog)
- `@heroicons/react` — Icons
- `react-hot-toast` — Notifications
- `tailwindcss` — Styling (Cairo font, RTL, dark mode)

## ملاحظات تقنية

- MySQL JSON columns بترجع كـ parsed JavaScript object مش string — متعملش `JSON.parse()` عليها
- `safeArray(response)` في `utils/api.js` لازم تستخدم مع أي API response هتتحول لـ array
- الـ count queries في الـ pagination لازم تكون query مستقلة — regex replace على الـ SELECT مش بيشتغل
- Seed data: admin user (admin/admin123)، 49 حساب محاسبي، 8 وحدات، 3 طرق دفع، سنة مالية 2026، 6 أقسام
- Font: Cairo من Google Fonts — `font-display: block`
- Design system: Primary #2563EB, Sidebar #1E293B, rounded-xl cards, rounded-lg inputs
