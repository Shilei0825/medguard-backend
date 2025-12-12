import { Router, Request, Response } from 'express';
import { complianceService } from '../services/complianceService';
import { ComplianceFramework, TaskStatus, PhiSeverity } from '../types/db';

const router = Router();

/**
 * GET /api/compliance/snapshot
 * Get the latest compliance snapshot for an organization.
 * Query params: orgId (required), framework (optional)
 */
router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const { orgId, framework } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const snapshot = await complianceService.getLatestSnapshot(
      orgId,
      framework as ComplianceFramework | undefined
    );

    if (!snapshot) {
      res.status(404).json({ error: 'No compliance snapshot found' });
      return;
    }

    res.json(snapshot);
  } catch (err) {
    console.error('Get compliance snapshot error:', err);
    res.status(500).json({
      error: 'Failed to get compliance snapshot',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/compliance/items
 * List compliance items for an organization.
 * Query params: orgId (required), framework (optional), status (optional)
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const { orgId, framework, status } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const items = await complianceService.listComplianceItems(orgId, {
      framework: framework as ComplianceFramework | undefined,
      status: status as any,
    });

    res.json({ items });
  } catch (err) {
    console.error('List compliance items error:', err);
    res.status(500).json({
      error: 'Failed to list compliance items',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/compliance/items/:itemId
 * Update compliance item status.
 * Request body: { "status": "COMPLIANT | PARTIAL | NON_COMPLIANT", "evidenceNotes": "string" }
 */
router.patch('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { status, evidenceNotes } = req.body;

    const item = await complianceService.updateComplianceItem(itemId, {
      status,
      evidenceNotes,
    });

    res.json(item);
  } catch (err) {
    console.error('Update compliance item error:', err);
    res.status(500).json({
      error: 'Failed to update compliance item',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/compliance/tasks
 * List compliance tasks for an organization.
 * Query params: orgId (required), status (optional), severity (optional), assignedToUserId (optional), limit (optional)
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { orgId, status, severity, assignedToUserId, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const tasks = await complianceService.listTasks(orgId, {
      status: status as TaskStatus | undefined,
      severity: severity as PhiSeverity | undefined,
      assignedToUserId: assignedToUserId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ tasks });
  } catch (err) {
    console.error('List compliance tasks error:', err);
    res.status(500).json({
      error: 'Failed to list compliance tasks',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/compliance/tasks/:taskId
 * Get task by ID.
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const task = await complianceService.getTaskById(taskId);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (err) {
    console.error('Get compliance task error:', err);
    res.status(500).json({
      error: 'Failed to get compliance task',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/compliance/tasks
 * Create a compliance task.
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "createdByUserId": "uuid or null",
 *   "title": "string",
 *   "description": "string",
 *   "severity": "LOW | MEDIUM | HIGH | CRITICAL",
 *   "dueDate": "ISO date string",
 *   "relatedScanId": "uuid or null",
 *   "relatedFileId": "uuid or null",
 *   "relatedAlertId": "uuid or null"
 * }
 */
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      createdByUserId,
      assignedToUserId,
      title,
      description,
      severity,
      dueDate,
      relatedScanId,
      relatedFileId,
      relatedAlertId,
      relatedComplianceItemId,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!severity) {
      res.status(400).json({ error: 'severity is required' });
      return;
    }

    const task = await complianceService.createTask({
      orgId,
      createdByUserId,
      assignedToUserId,
      title,
      description,
      severity,
      dueDate,
      relatedScanId,
      relatedFileId,
      relatedAlertId,
      relatedComplianceItemId,
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create compliance task error:', err);
    res.status(500).json({
      error: 'Failed to create compliance task',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/compliance/tasks/:taskId/status
 * Update task status.
 * Request body: { "status": "pending | in_progress | completed | overdue" }
 */
router.patch('/tasks/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const task = await complianceService.updateTaskStatus(taskId, status);
    res.json(task);
  } catch (err) {
    console.error('Update task status error:', err);
    res.status(500).json({
      error: 'Failed to update task status',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/compliance/tasks/:taskId/assign
 * Assign task to a user.
 * Request body: { "userId": "uuid" }
 */
router.patch('/tasks/:taskId/assign', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const task = await complianceService.assignTask(taskId, userId);
    res.json(task);
  } catch (err) {
    console.error('Assign task error:', err);
    res.status(500).json({
      error: 'Failed to assign task',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/compliance/summary
 * Get compliance summary for an organization.
 * Query params: orgId (required)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const summary = await complianceService.getComplianceSummary(orgId);
    res.json(summary);
  } catch (err) {
    console.error('Get compliance summary error:', err);
    res.status(500).json({
      error: 'Failed to get compliance summary',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/compliance/snapshot
 * Create a compliance snapshot.
 * Request body: { "orgId": "uuid", "framework": "HIPAA | GDPR | ..." }
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { orgId, framework } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!framework) {
      res.status(400).json({ error: 'framework is required' });
      return;
    }

    const snapshot = await complianceService.createSnapshot(orgId, framework);
    res.status(201).json(snapshot);
  } catch (err) {
    console.error('Create compliance snapshot error:', err);
    res.status(500).json({
      error: 'Failed to create compliance snapshot',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/compliance/mark-overdue
 * Mark overdue tasks.
 * Request body: { "orgId": "uuid" }
 */
router.post('/mark-overdue', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    const count = await complianceService.markOverdueTasks(orgId);
    res.json({ markedOverdue: count });
  } catch (err) {
    console.error('Mark overdue tasks error:', err);
    res.status(500).json({
      error: 'Failed to mark overdue tasks',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
