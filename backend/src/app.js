import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import materialsRoutes from './routes/materials.js';
import recipesRoutes from './routes/recipes.js';
import productionRoutes from './routes/production.js';
import inventoryRoutes from './routes/inventory.js';
import customersRoutes from './routes/customers.js';
import suppliersRoutes from './routes/suppliers.js';
import salesRoutes from './routes/sales.js';
import purchasesRoutes from './routes/purchases.js';
import accountingRoutes from './routes/accounting.js';
import expensesRoutes from './routes/expenses.js';
import paymentsRoutes from './routes/payments.js';
import assetsRoutes from './routes/assets.js';
import employeesRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import salariesRoutes from './routes/salaries.js';
import qualityRoutes from './routes/quality.js';
import reportsRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import pricingRoutes from './routes/pricing.js';

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// API Routes
const api = '/api/v1';
app.use(`${api}/auth`, authRoutes);
app.use(`${api}/users`, usersRoutes);
app.use(`${api}/products`, productsRoutes);
app.use(`${api}/materials`, materialsRoutes);
app.use(`${api}/recipes`, recipesRoutes);
app.use(`${api}/production`, productionRoutes);
app.use(`${api}/inventory`, inventoryRoutes);
app.use(`${api}/customers`, customersRoutes);
app.use(`${api}/suppliers`, suppliersRoutes);
app.use(`${api}/sales`, salesRoutes);
app.use(`${api}/purchases`, purchasesRoutes);
app.use(`${api}/accounting`, accountingRoutes);
app.use(`${api}/expenses`, expensesRoutes);
app.use(`${api}/payments`, paymentsRoutes);
app.use(`${api}/assets`, assetsRoutes);
app.use(`${api}/employees`, employeesRoutes);
app.use(`${api}/attendance`, attendanceRoutes);
app.use(`${api}/salaries`, salariesRoutes);
app.use(`${api}/quality`, qualityRoutes);
app.use(`${api}/reports`, reportsRoutes);
app.use(`${api}/settings`, settingsRoutes);
app.use(`${api}/dashboard`, dashboardRoutes);
app.use(`${api}/pricing`, pricingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

export default app;
