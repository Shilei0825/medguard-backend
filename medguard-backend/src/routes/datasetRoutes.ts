import { Router, Request, Response } from 'express';
import { datasetService } from '../services/datasetService';

const router = Router();

/**
 * GET /api/safe-datasets
 * List safe datasets for an organization.
 * Query params: orgId (required), format (optional), limit (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, format, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const datasets = await datasetService.listSafeDatasets(orgId, {
      format: format as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ datasets });
  } catch (err) {
    console.error('List safe datasets error:', err);
    res.status(500).json({
      error: 'Failed to list safe datasets',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/safe-datasets
 * Create a safe dataset record.
 * 
 * NOTE: This endpoint stores a reference to a PHI-sanitized dataset.
 * The actual dataset generation would be handled by a separate service.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "name": "Safe Training Dataset (Dec 2025)",
 *   "sourceDescription": "Derived from lab_results_2024",
 *   "fileCount": 42,
 *   "recordCount": 10000,
 *   "storageUrl": "https://.../safe-dataset.json",
 *   "format": "json | csv | parquet",
 *   "createdByUserId": "uuid or null"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      name,
      sourceDescription,
      fileCount,
      recordCount,
      storageUrl,
      format,
      createdByUserId,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (fileCount === undefined || fileCount === null) {
      res.status(400).json({ error: 'fileCount is required' });
      return;
    }

    const dataset = await datasetService.createSafeDataset({
      orgId,
      name,
      sourceDescription,
      fileCount,
      recordCount,
      storageUrl,
      format,
      createdByUserId,
    });

    res.status(201).json(dataset);
  } catch (err) {
    console.error('Create safe dataset error:', err);
    res.status(500).json({
      error: 'Failed to create safe dataset',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/safe-datasets/stats
 * Get dataset statistics for an organization.
 * Query params: orgId (required)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const stats = await datasetService.getDatasetStats(orgId);
    res.json(stats);
  } catch (err) {
    console.error('Get dataset stats error:', err);
    res.status(500).json({
      error: 'Failed to get dataset statistics',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/safe-datasets/:datasetId
 * Get safe dataset by ID.
 */
router.get('/:datasetId', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params;

    const dataset = await datasetService.getSafeDatasetById(datasetId);

    if (!dataset) {
      res.status(404).json({ error: 'Safe dataset not found' });
      return;
    }

    res.json(dataset);
  } catch (err) {
    console.error('Get safe dataset error:', err);
    res.status(500).json({
      error: 'Failed to get safe dataset',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/safe-datasets/:datasetId
 * Update safe dataset metadata.
 * Request body: { "name": "string", "sourceDescription": "string", "recordCount": number, "storageUrl": "string" }
 */
router.patch('/:datasetId', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params;
    const { name, sourceDescription, recordCount, storageUrl } = req.body;

    const dataset = await datasetService.updateSafeDataset(datasetId, {
      name,
      sourceDescription,
      recordCount,
      storageUrl,
    });

    res.json(dataset);
  } catch (err) {
    console.error('Update safe dataset error:', err);
    res.status(500).json({
      error: 'Failed to update safe dataset',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/safe-datasets/:datasetId
 * Delete a safe dataset record.
 * Note: This only deletes the database record, not the actual dataset.
 */
router.delete('/:datasetId', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params;

    await datasetService.deleteSafeDataset(datasetId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete safe dataset error:', err);
    res.status(500).json({
      error: 'Failed to delete safe dataset',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
