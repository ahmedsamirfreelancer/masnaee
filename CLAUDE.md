# مصنعي - Factory ERP System

## Tech Stack
- **Backend**: Node.js + Express (ES modules, port 5000)
- **Frontend**: React 18 + Vite + Tailwind CSS (port 3000, proxy → 5000)
- **Database**: MySQL 8 (utf8mb4, InnoDB)
- **Auth**: JWT + bcryptjs + role-based permissions

## Project Structure
```
E:/ai/masna3i/
├── backend/
│   ├── src/
│   │   ├── config/       # database.js, constants.js
│   │   ├── middleware/    # auth.js, validate.js, errorHandler.js
│   │   ├── routes/        # 22 route files
│   │   ├── utils/         # helpers.js
│   │   ├── app.js         # Express app
│   │   └── server.js      # Entry point
│   ├── migrations/        # 001_initial_schema.sql
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ui/ # Button, Input, Select, Card, Badge, Modal, DataTable, StatsCard
│   │   ├── hooks/         # useAuth.js (Zustand)
│   │   ├── layouts/       # DashboardLayout.jsx
│   │   ├── pages/         # 22 pages
│   │   ├── utils/         # api.js, formatters.js
│   │   └── styles/        # index.css
│   ├── public/            # logo.svg, logo-icon.svg, favicon.svg
│   └── package.json
└── CLAUDE.md
```

## Database
- 43 tables, schema at backend/migrations/001_initial_schema.sql
- Double-entry bookkeeping (journal_entries + journal_entry_lines)
- Chart of accounts: 49 accounts in 3-level tree
- Default admin: username=admin, password=admin123

## Modules (14)
Dashboard, Products, Materials, Recipes, Production, Inventory,
Sales, Purchases, Accounting, Expenses/Payments/Assets,
HR (Employees/Attendance/Salaries), Quality, Reports, Settings

## API Pattern
- All routes: /api/v1/{resource}
- Auth: Bearer JWT token
- Response: { success: true/false, data/message }
- Permissions: role-based via authorize() middleware

## Deploy
- Backend: `npm start` (or PM2)
- Frontend: `npm run build` → serve dist/ via Nginx
- DB: Run 001_initial_schema.sql to initialize
