import { Router, Request, Response } from 'express';
import { redactionService } from '../services/redactionService';
import { RedactionMethod, PhiType } from '../types/db';

const router = Router();

/**
 * GET /api/redacted-files
 * List redacted files for an organization.
 * Query params: orgId (required), method (optional), limit (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, method, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const redactedFiles = await redactionService.listRedactedFiles(orgId, {
      method: method as RedactionMethod | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ redactedFiles });
  } catch (err) {
    console.error('List redacted files error:', err);
    res.status(500).json({
      error: 'Failed to list redacted files',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/redacted-files
 * Create a redacted file record.
 * 
 * NOTE: This endpoint stores a reference to a redacted file.
 * The actual redaction process would be handled by a separate service.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "originalFileId": "uuid",
 *   "redactedFileUrl": "string",
 *   "method": "ai_redaction | manual | pattern_based | llm_assisted",
 *   "phiTypesRedacted": ["SSN", "DOB", ...],
 *   "redactionCount": 15,
 *   "notes": "optional",
 *   "createdByUserId": "uuid or null"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      originalFileId,
      redactedFileUrl,
      method,
      phiTypesRedacted,
      redactionCount,
      notes,
      createdByUserId,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!originalFileId) {
      res.status(400).json({ error: 'originalFileId is required' });
      return;
    }
    if (!redactedFileUrl) {
      res.status(400).json({ error: 'redactedFileUrl is required' });
      return;
    }
    if (!method) {
      res.status(400).json({ error: 'method is required' });
      return;
    }

    const redactedFile = await redactionService.createRedactedFile({
      orgId,
      originalFileId,
      redactedFileUrl,
      method,
      phiTypesRedacted: phiTypesRedacted as PhiType[] | undefined,
      redactionCount,
      notes,
      createdByUserId,
    });

    res.status(201).json(redactedFile);
  } catch (err) {
    console.error('Create redacted file error:', err);
    res.status(500).json({
      error: 'Failed to create redacted file',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/redacted-files/stats
 * Get redaction statistics for an organization.
 * Query params: orgId (required)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const stats = await redactionService.getRedactionStats(orgId);
    res.json(stats);
  } catch (err) {
    console.error('Get redaction stats error:', err);
    res.status(500).json({
      error: 'Failed to get redaction statistics',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/redacted-files/:redactedFileId
 * Get redacted file by ID.
 */
router.get('/:redactedFileId', async (req: Request, res: Response) => {
  try {
    const { redactedFileId } = req.params;

    const redactedFile = await redactionService.getRedactedFileById(redactedFileId);

    if (!redactedFile) {
      res.status(404).json({ error: 'Redacted file not found' });
      return;
    }

    res.json(redactedFile);
  } catch (err) {
    console.error('Get redacted file error:', err);
    res.status(500).json({
      error: 'Failed to get redacted file',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/redacted-files/original/:originalFileId
 * Get all redacted versions of an original file.
 */
router.get('/original/:originalFileId', async (req: Request, res: Response) => {
  try {
    const { originalFileId } = req.params;

    const redactedVersions = await redactionService.getRedactedVersions(originalFileId);
    res.json({ redactedVersions });
  } catch (err) {
    console.error('Get redacted versions error:', err);
    res.status(500).json({
      error: 'Failed to get redacted versions',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/redacted-files/:redactedFileId
 * Delete a redacted file record.
 * Note: This only deletes the database record, not the actual file.
 */
router.delete('/:redactedFileId', async (req: Request, res: Response) => {
  try {
    const { redactedFileId } = req.params;

    await redactionService.deleteRedactedFile(redactedFileId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete redacted file error:', err);
    res.status(500).json({
      error: 'Failed to delete redacted file',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
