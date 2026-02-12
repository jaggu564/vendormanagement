require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');
const { tenantMiddleware } = require('./middleware/tenantMiddleware');

// Route imports
const authRoutes = require('./routes/auth');
const rfpRoutes = require('./routes/rfp');
const contractRoutes = require('./routes/contract');
const procurementRoutes = require('./routes/procurement');
const performanceRoutes = require('./routes/performance');
const riskRoutes = require('./routes/risk');
const analyticsRoutes = require('./routes/analytics');
const helpdeskRoutes = require('./routes/helpdesk');
const surveyRoutes = require('./routes/survey');
const integrationRoutes = require('./routes/integration');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Audit logging middleware (must be early in chain)
app.use(auditLogger);

// Tenant isolation middleware
//app.use('/api/', tenantMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

app.use(`${API_PREFIX}/auth`, authRoutes);

// 🔐 Authentication middleware (JWT)
const { authenticate } = require('./middleware/auth');
app.use(authenticate);

// 🏢 TENANT ENFORCEMENT (POST-AUTH ONLY)
app.use(tenantMiddleware);

app.use(`${API_PREFIX}/rfp`, rfpRoutes);
app.use(`${API_PREFIX}/contracts`, contractRoutes);
app.use(`${API_PREFIX}/procurement`, procurementRoutes);
app.use(`${API_PREFIX}/performance`, performanceRoutes);
app.use(`${API_PREFIX}/risk`, riskRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/helpdesk`, helpdeskRoutes);
app.use(`${API_PREFIX}/surveys`, surveyRoutes);
app.use(`${API_PREFIX}/integrations`, integrationRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);

// Error handling (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}${API_PREFIX}`);
});

module.exports = app;
