import { Router, Request, Response } from 'express';
import { scanService } from '../services/scanService';
import { FileScanRequest, FolderScanRequest } from '../types/db';
// import { analyticsService } from '../services/analyticsService';

const router = Router();

/**
 * POST /api/scans/file
 * Create and execute a single file scan.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "userId": "uuid or null",
 *   "sourceLabel": "string",
 *   "file": {
 *     "fileName": "patient_notes.pdf",
 *     "filePath": "optional logical path",
 *     "sizeBytes": 12345,
 *     "mimeType": "application/pdf",
 *     "content": "optional raw text for now"
 *   }
 * }
 */
router.post('/file', async (req: Request, res: Response) => {
  try {
    const body = req.body as FileScanRequest;

    // Validate required fields
    if (!body.orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!body.file?.fileName) {
      res.status(400).json({ error: 'file.fileName is required' });
      return;
    }

    const result = await scanService.createFileScan(body);

    // TODO: Log access event
    // await analyticsService.logAccessEvent(
    //   body.orgId,
    //   body.userId || null,
    //   result.file.id,
    //   'SCAN',
    //   { scanType: 'file', scanId: result.scan.id }
    // );

    res.status(201).json(result);
  } catch (err) {
    console.error('File scan error:', err);
    res.status(500).json({
      error: 'Failed to create file scan',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/scans/folder
 * Create and execute a folder scan.
 * 
 * This endpoint handles:
 * - Local folder scans (sourceType: 'local_folder')
 * - Google Drive scans (sourceType: 'google_drive')
 * - OneDrive scans (sourceType: 'onedrive')
 * - S3 bucket scans (sourceType: 's3')
 * - SharePoint scans (sourceType: 'sharepoint')
 * - Dropbox scans (sourceType: 'dropbox')
 * 
 * The frontend is responsible for gathering file metadata from these sources.
 * This endpoint processes the metadata uniformly regardless of source.
 * 
 * Request body:
 * {
 *   "orgId": "uuid",
 *   "userId": "uuid or null",
 *   "sourceLabel": "Shared Drive / Billing",
 *   "rootPath": "Shared/Billing",
 *   "sourceType": "local_folder | google_drive | onedrive | s3",
 *   "files": [
 *     {
 *       "fileName": "invoice1.pdf",
 *       "filePath": "Shared/Billing/2024/invoice1.pdf",
 *       "sizeBytes": 12345,
 *       "mimeType": "application/pdf",
 *       "content": "optional raw text for demo"
 *     }
 *   ]
 * }
 */
router.post('/folder', async (req: Request, res: Response) => {
  try {
    const body = req.body as FolderScanRequest;

    // Validate required fields
    if (!body.orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }
    if (!body.rootPath) {
      res.status(400).json({ error: 'rootPath is required' });
      return;
    }
    if (!body.sourceType) {
      res.status(400).json({ error: 'sourceType is required' });
      return;
    }
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      res.status(400).json({ error: 'files array is required and must not be empty' });
      return;
    }

    const result = await scanService.createFolderScan(body);

    // TODO: Log access event for each file
    // for (const file of result.files) {
    //   await analyticsService.logAccessEvent(
    //     body.orgId,
    //     body.userId || null,
    //     file.id,
    //     'SCAN',
    //     { scanType: 'folder', scanId: result.scan.id }
    //   );
    // }

    res.status(201).json({
      scan: result.scan,
      fileCount: result.files.length,
      highRiskFileCount: result.highRiskFiles.length,
      highRiskFiles: result.highRiskFiles.slice(0, 10), // Return top 10
      folderRisks: result.folderRisks,
    });
  } catch (err) {
    console.error('Folder scan error:', err);
    res.status(500).json({
      error: 'Failed to create folder scan',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scans/:scanId
 * Get scan details by ID.
 */
router.get('/:scanId', async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;

    const result = await scanService.getScanById(scanId);

    if (!result) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Get scan error:', err);
    res.status(500).json({
      error: 'Failed to get scan',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scans
 * List scans for an organization.
 * Query params: orgId (required), status (optional), limit (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, status, limit } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'orgId query parameter is required' });
      return;
    }

    const scans = await scanService.listScans(orgId, {
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ scans });
  } catch (err) {
    console.error('List scans error:', err);
    res.status(500).json({
      error: 'Failed to list scans',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scans/files/:fileId
 * Get file details with PHI findings.
 */
router.get('/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const result = await scanService.getFileById(fileId);

    if (!result) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({
      error: 'Failed to get file',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scans/files/:fileId/duplicates
 * Find duplicate files based on PHI fingerprints.
 */
router.get('/files/:fileId/duplicates', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const duplicates = await scanService.findDuplicateFiles(fileId);

    res.json({ duplicates });
  } catch (err) {
    console.error('Find duplicates error:', err);
    res.status(500).json({
      error: 'Failed to find duplicates',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
