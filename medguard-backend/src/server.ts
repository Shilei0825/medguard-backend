import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';

// Import routes
import healthRoutes from './routes/healthRoutes';
import scanRoutes from './routes/scanRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import vendorRoutes from './routes/vendorRoutes';
import alertRoutes from './routes/alertRoutes';
import complianceRoutes from './routes/complianceRoutes';
import redactionRoutes from './routes/redactionRoutes';
import datasetRoutes from './routes/datasetRoutes';
import reportRoutes from './routes/reportRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Initialize Express app
const app: Express = express();

// ============================================================================
// Middleware
// ============================================================================

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',      // Local frontend development
    'http://localhost:5173',      // Vite dev server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    // Add production frontend URLs here
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON body parser
app.use(express.json({ limit: '50mb' }));

// URL-encoded body parser (for form data)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check routes
app.use('/api/health', healthRoutes);

// Core feature routes
app.use('/api/scans', scanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/redacted-files', redactionRoutes);
app.use('/api/safe-datasets', datasetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MedGuard Backend API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      scans: '/api/scans',
      dashboard: '/api/dashboard',
      vendors: '/api/vendors',
      alerts: '/api/alerts',
      compliance: '/api/compliance',
      redactedFiles: '/api/redacted-files',
      safeDatasets: '/api/safe-datasets',
      reports: '/api/reports',
      analytics: '/api/analytics',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  // Don't leak stack traces in production
  const isDev = env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('MedGuard Backend API');
  console.log('='.repeat(60));
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
