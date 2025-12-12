import { Router, Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { ReportType } from '../types/db';

const router = Router();

/**
 * GET /api/reports
 * List reports for an organization.
 * Query params: orgId (required), reportType (optional), limit (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, reportType, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const reports = await reportService.listReports(orgId, {
      reportType: reportType as ReportType | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ reports });
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({
      error: 'Failed to list reports',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/reports/financial-risk
 * Generate a financial risk estimate report.
 * 
 * This calculates the estimated breach cost based on:
 * - Total PHI count across all scanned files
 * - Breach cost per record (from org_settings or default ~$180)
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "label": "Q4 2025 Financial Risk Estimate",
 *   "createdByUserId": "uuid or null"
 * }
 */
router.post('/financial-risk', async (req: Request, res: Response) => {
  try {
    const { orgId, label, createdByUserId } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!label) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const result = await reportService.generateFinancialRiskReport(
      orgId,
      label,
      createdByUserId
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Generate financial risk report error:', err);
    res.status(500).json({
      error: 'Failed to generate financial risk report',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/reports/financial-risk/calculate
 * Calculate financial risk without creating a report.
 * Useful for previewing before generating official report.
 * Query params: orgId (required)
 */
router.get('/financial-risk/calculate', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const riskData = await reportService.calculateFinancialRisk(orgId);
    res.json(riskData);
  } catch (err) {
    console.error('Calculate financial risk error:', err);
    res.status(500).json({
      error: 'Failed to calculate financial risk',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/reports/phi-inventory
 * Generate a PHI inventory report.
 * 
 * This creates a comprehensive inventory of PHI across all scanned files.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "label": "PHI Inventory Report - December 2025",
 *   "createdByUserId": "uuid or null"
 * }
 */
router.post('/phi-inventory', async (req: Request, res: Response) => {
  try {
    const { orgId, label, createdByUserId } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!label) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const report = await reportService.generatePhiInventoryReport(
      orgId,
      label,
      createdByUserId
    );

    res.status(201).json(report);
  } catch (err) {
    console.error('Generate PHI inventory report error:', err);
    res.status(500).json({
      error: 'Failed to generate PHI inventory report',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/reports
 * Create a generic report record.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "reportType": "financial_risk | compliance_audit | phi_inventory | vendor_assessment | executive_summary | custom",
 *   "label": "string",
 *   "description": "string",
 *   "params": {},
 *   "results": {},
 *   "storageUrl": "string",
 *   "createdByUserId": "uuid or null"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      reportType,
      label,
      description,
      params,
      results,
      storageUrl,
      createdByUserId,
    } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!reportType) {
      res.status(400).json({ error: 'reportType is required' });
      return;
    }
    if (!label) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const report = await reportService.createReport({
      orgId,
      reportType,
      label,
      description,
      params,
      results,
      storageUrl,
      createdByUserId,
    });

    res.status(201).json(report);
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({
      error: 'Failed to create report',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/reports/:reportId
 * Get report by ID.
 */
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await reportService.getReportById(reportId);

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json(report);
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({
      error: 'Failed to get report',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/reports/:reportId
 * Delete a report.
 */
router.delete('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    await reportService.deleteReport(reportId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({
      error: 'Failed to delete report',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
