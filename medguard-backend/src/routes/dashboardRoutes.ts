import { Router, Request, Response } from 'express';
import dashboardService from '../services/dashboardService';
import { RiskSimulationRequest } from '../types/db';

const router = Router();

/**
 * GET /api/dashboard/overview
 * Get comprehensive dashboard overview for an organization.
 * Query params: orgId (required)
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const overview = await dashboardService.getOverview(orgId);

    // IMPORTANT: keep key names aligned with DashboardOverview interface
    res.status(200).json({
      totalScans: overview.totalScans,
      totalFiles: overview.totalFiles,
      totalPhiCount: overview.totalPhiCount,
      overallRiskScore: overview.overallRiskScore,
      highRiskFileCount: overview.highRiskFileCount,
      criticalRiskFileCount: overview.criticalRiskFileCount,
      recentAlerts: overview.recentAlerts,
      recentScans: overview.recentScans,
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({
      error: 'Failed to get dashboard overview',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/exposure-map
 * Query params: orgId (required), scanId (optional)
 */
router.get('/exposure-map', async (req: Request, res: Response) => {
  try {
    const { orgId, scanId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const exposureMap = await dashboardService.getExposureMap(orgId, scanId as string | undefined);
    res.status(200).json(exposureMap);
  } catch (err) {
    console.error('Exposure map error:', err);
    res.status(500).json({
      error: 'Failed to get exposure map',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/risk-timeline
 * Query params: orgId (required), days (optional, default 30)
 */
router.get('/risk-timeline', async (req: Request, res: Response) => {
  try {
    const { orgId, days } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const timeline = await dashboardService.getRiskTimeline(orgId, {
      days: days ? parseInt(days as string, 10) : undefined,
    });

    res.status(200).json(timeline);
  } catch (err) {
    console.error('Risk timeline error:', err);
    res.status(500).json({
      error: 'Failed to get risk timeline',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/dashboard/risk-simulation
 * Body: { orgId: string, fileIdsToRemove: string[] }
 */
router.post('/risk-simulation', async (req: Request, res: Response) => {
  try {
    const body = req.body as RiskSimulationRequest;

    if (!body.orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!body.fileIdsToRemove || !Array.isArray(body.fileIdsToRemove)) {
      res.status(400).json({ error: 'fileIdsToRemove array is required' });
      return;
    }

    const simulation = await dashboardService.simulateRiskReduction(body);
    res.status(200).json(simulation);
  } catch (err) {
    console.error('Risk simulation error:', err);
    res.status(500).json({
      error: 'Failed to simulate risk reduction',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/phi-density
 * Query params: orgId (required)
 */
router.get('/phi-density', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const density = await dashboardService.getPhiDensity(orgId);
    res.status(200).json({ folders: density });
  } catch (err) {
    console.error('PHI density error:', err);
    res.status(500).json({
      error: 'Failed to get PHI density',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/dashboard/snapshot
 * Body: { orgId: string }
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    const snapshot = await dashboardService.createRiskSnapshot(orgId);
    res.status(201).json(snapshot);
  } catch (err) {
    console.error('Create snapshot error:', err);
    res.status(500).json({
      error: 'Failed to create risk snapshot',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
