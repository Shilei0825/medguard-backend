import { Router, Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { AccessEventType } from '../types/db';

const router = Router();

/**
 * GET /api/analytics/access-summary
 * Get access summary analytics for an organization.
 * Query params: orgId (required), days (optional, default 30), limit (optional, default 10)
 */
router.get('/access-summary', async (req: Request, res: Response) => {
  try {
    const { orgId, days, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const summary = await analyticsService.getAccessSummary(orgId, {
      days: days ? parseInt(days as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(summary);
  } catch (err) {
    console.error('Get access summary error:', err);
    res.status(500).json({
      error: 'Failed to get access summary',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/file/:fileId
 * Get access history for a specific file.
 * Query params: limit (optional)
 */
router.get('/file/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { limit } = req.query;

    const events = await analyticsService.getFileAccessHistory(fileId, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ events });
  } catch (err) {
    console.error('Get file access history error:', err);
    res.status(500).json({
      error: 'Failed to get file access history',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/user/:userId
 * Get access history for a specific user.
 * Query params: orgId (required), limit (optional), eventType (optional)
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { orgId, limit, eventType } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const events = await analyticsService.getUserAccessHistory(userId, orgId, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      eventType: eventType as AccessEventType | undefined,
    });

    res.json({ events });
  } catch (err) {
    console.error('Get user access history error:', err);
    res.status(500).json({
      error: 'Failed to get user access history',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/anomalies
 * Detect access anomalies (files with unusually high access).
 * Query params: orgId (required), thresholdMultiplier (optional, default 3), recentHours (optional, default 24)
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const { orgId, thresholdMultiplier, recentHours } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const anomalies = await analyticsService.detectAccessAnomalies(orgId, {
      thresholdMultiplier: thresholdMultiplier 
        ? parseFloat(thresholdMultiplier as string) 
        : undefined,
      recentHours: recentHours 
        ? parseInt(recentHours as string, 10) 
        : undefined,
    });

    res.json({ anomalies });
  } catch (err) {
    console.error('Detect access anomalies error:', err);
    res.status(500).json({
      error: 'Failed to detect access anomalies',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/analytics/events
 * Log an access event.
 * 
 * This endpoint can be called by frontend/other services to log access events.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "userId": "uuid or null",
 *   "fileId": "uuid or null",
 *   "eventType": "VIEW | DOWNLOAD | SHARE | EDIT | DELETE | SCAN | EXPORT",
 *   "metadata": {},
 *   "ipAddress": "string",
 *   "userAgent": "string"
 * }
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      userId,
      fileId,
      eventType,
      metadata,
      ipAddress,
      userAgent,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!eventType) {
      res.status(400).json({ error: 'eventType is required' });
      return;
    }

    const event = await analyticsService.logAccessEvent(
      orgId,
      userId || null,
      fileId || null,
      eventType,
      metadata,
      ipAddress,
      userAgent
    );

    res.status(201).json(event);
  } catch (err) {
    console.error('Log access event error:', err);
    res.status(500).json({
      error: 'Failed to log access event',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/analytics/events/old
 * Delete old access events beyond retention period.
 * Request body: { "orgId": "uuid", "retentionDays": 365 }
 */
router.delete('/events/old', async (req: Request, res: Response) => {
  try {
    const { orgId, retentionDays } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    const deletedCount = await analyticsService.deleteOldEvents(
      orgId,
      retentionDays || 365
    );

    res.json({ deletedCount });
  } catch (err) {
    console.error('Delete old events error:', err);
    res.status(500).json({
      error: 'Failed to delete old events',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
