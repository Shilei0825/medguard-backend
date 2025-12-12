import { Router, Request, Response } from 'express';
import { vendorService } from '../services/vendorService';

const router = Router();

/**
 * GET /api/vendors
 * List all vendors for an organization.
 * Query params: orgId (required)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const vendors = await vendorService.listVendors(orgId);
    res.json({ vendors });
  } catch (err) {
    console.error('List vendors error:', err);
    res.status(500).json({
      error: 'Failed to list vendors',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/vendors
 * Create or update a vendor.
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "name": "string",
 *   "contactEmail": "string",
 *   "domain": "string",
 *   "baseScore": 80,
 *   "notes": "optional"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orgId, name, contactEmail, domain, baseScore, notes } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const vendor = await vendorService.upsertVendor({
      orgId,
      name,
      contactEmail,
      domain,
      baseScore,
      notes,
    });

    res.status(201).json(vendor);
  } catch (err) {
    console.error('Create/update vendor error:', err);
    res.status(500).json({
      error: 'Failed to create/update vendor',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/vendors/analytics
 * Get vendor behavior analytics for an organization.
 * Query params: orgId (required)
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const analytics = await vendorService.getVendorAnalytics(orgId);
    res.json(analytics);
  } catch (err) {
    console.error('Vendor analytics error:', err);
    res.status(500).json({
      error: 'Failed to get vendor analytics',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/vendors/:vendorId
 * Get vendor details with associated files and PHI summary.
 */
router.get('/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const result = await vendorService.getVendorDetails(vendorId);

    if (!result) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Get vendor error:', err);
    res.status(500).json({
      error: 'Failed to get vendor details',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/vendors/:vendorId/files
 * Associate a file with a vendor.
 * Request body:
 * {
 *   "fileId": "uuid",
 *   "relationshipType": "shared_with | received_from | processed_by",
 *   "notes": "optional"
 * }
 */
router.post('/:vendorId/files', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { fileId, relationshipType, notes } = req.body;

    if (!fileId) {
      res.status(400).json({ error: 'fileId is required' });
      return;
    }
    if (!relationshipType) {
      res.status(400).json({ error: 'relationshipType is required' });
      return;
    }

    const vendorFile = await vendorService.associateFile(
      vendorId,
      fileId,
      relationshipType,
      notes
    );

    // Recalculate vendor scores after adding file
    await vendorService.updateVendorScores(vendorId);

    res.status(201).json(vendorFile);
  } catch (err) {
    console.error('Associate file error:', err);
    res.status(500).json({
      error: 'Failed to associate file with vendor',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/vendors/:vendorId/recalculate
 * Recalculate vendor scores based on associated files.
 */
router.post('/:vendorId/recalculate', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const vendor = await vendorService.updateVendorScores(vendorId);
    res.json(vendor);
  } catch (err) {
    console.error('Recalculate vendor scores error:', err);
    res.status(500).json({
      error: 'Failed to recalculate vendor scores',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/vendors/:vendorId
 * Delete a vendor.
 */
router.delete('/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    await vendorService.deleteVendor(vendorId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete vendor error:', err);
    res.status(500).json({
      error: 'Failed to delete vendor',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
