import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabaseClient';

const router = Router();

/**
 * GET /api/health
 * Basic health check endpoint.
 */
router.get('/', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'medguard-backend',
  });
});

/**
 * GET /api/health/db
 * Health check with database connectivity test.
 */
router.get('/db', async (_req: Request, res: Response) => {
  try {
    // Test database connection by running a simple query
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message,
      });
      return;
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
