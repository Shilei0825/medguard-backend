import { Router, Request, Response } from 'express';
import { alertService } from '../services/alertService';
import { PhiSeverity, AlertType } from '../types/db';

const router = Router();

/**
 * GET /api/alerts
 * List alerts for an organization.
 * Query params: orgId (required), severity (optional), alertType (optional), isResolved (optional), limit (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, severity, alertType, isResolved, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const alerts = await alertService.listAlerts(orgId, {
      severity: severity as PhiSeverity | undefined,
      alertType: alertType as AlertType | undefined,
      isResolved: isResolved === 'true' ? true : isResolved === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ alerts });
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({
      error: 'Failed to list alerts',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/alerts/counts
 * Get alert counts by severity for an organization.
 * Query params: orgId (required)
 */
router.get('/counts', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const counts = await alertService.getAlertCounts(orgId);
    res.json(counts);
  } catch (err) {
    console.error('Get alert counts error:', err);
    res.status(500).json({
      error: 'Failed to get alert counts',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/alerts/:alertId
 * Get alert by ID.
 */
router.get('/:alertId', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    const alert = await alertService.getAlertById(alertId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json(alert);
  } catch (err) {
    console.error('Get alert error:', err);
    res.status(500).json({
      error: 'Failed to get alert',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/alerts/:alertId/resolve
 * Resolve an alert.
 * Request body (optional): { "userId": "uuid" }
 */
router.post('/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;

    const alert = await alertService.resolveAlert(alertId, userId);
    res.json(alert);
  } catch (err) {
    console.error('Resolve alert error:', err);
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/alerts
 * Create a new alert (for manual alert creation).
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "alertType": "HIGH_FILE_RISK | PHI_SPIKE | ...",
 *   "severity": "LOW | MEDIUM | HIGH | CRITICAL",
 *   "title": "string",
 *   "description": "string",
 *   "relatedScanId": "uuid or null",
 *   "relatedFileId": "uuid or null",
 *   "relatedVendorId": "uuid or null"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      alertType,
      severity,
      title,
      description,
      relatedScanId,
      relatedFileId,
      relatedVendorId,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!alertType) {
      res.status(400).json({ error: 'alertType is required' });
      return;
    }
    if (!severity) {
      res.status(400).json({ error: 'severity is required' });
      return;
    }
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const alert = await alertService.createAlert({
      org_id: orgId,
      alert_type: alertType,
      severity,
      title,
      description: description || null,
      related_scan_id: relatedScanId || null,
      related_file_id: relatedFileId || null,
      related_vendor_id: relatedVendorId || null,
      is_resolved: false,
      resolved_at: null,
      resolved_by_user_id: null,
    });

    res.status(201).json(alert);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({
      error: 'Failed to create alert',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/alerts/old
 * Delete resolved alerts older than retention period.
 * Request body: { "orgId": "uuid", "retentionDays": 90 }
 */
router.delete('/old', async (req: Request, res: Response) => {
  try {
    const { orgId, retentionDays } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    const deletedCount = await alertService.deleteOldAlerts(
      orgId,
      retentionDays || 90
    );

    res.json({ deletedCount });
  } catch (err) {
    console.error('Delete old alerts error:', err);
    res.status(500).json({
      error: 'Failed to delete old alerts',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
