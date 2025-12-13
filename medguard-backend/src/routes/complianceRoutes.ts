import { Router, Request, Response } from "express";
import complianceService from "../services/complianceService";
import { ComplianceFramework, TaskStatus, PhiSeverity } from "../types/db";

const router = Router();

/**
 * GET /api/compliance/snapshot
 * Query params: orgId (required), framework (optional)
 *
 * IMPORTANT:
 * - Always return 200 + JSON (Lovable expects 200, not 404).
 * - If no snapshot exists yet, we can auto-create one (recommended).
 */
router.get("/snapshot", async (req: Request, res: Response) => {
  try {
    const { orgId, framework } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const fw =
      typeof framework === "string" && framework.length > 0
        ? (framework as ComplianceFramework)
        : ("HIPAA" as ComplianceFramework);

    // Try to get latest snapshot
    const snapshot = await complianceService.getLatestSnapshot(orgId, fw);

    // ✅ If missing, AUTO-CREATE one so frontend has data
    if (!snapshot) {
      try {
        const created = await complianceService.createSnapshot(orgId, fw);
        return res.status(200).json(created);
      } catch (createErr) {
        console.error("Auto-create snapshot failed:", createErr);

        // Still return 200 so frontend doesn't hard-fail
        return res.status(200).json({
          snapshot: null,
          framework: fw,
          message: "No snapshot existed yet; auto-create failed.",
        });
      }
    }

    // ✅ Always 200
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error("Get compliance snapshot error:", err);
    return res.status(500).json({
      error: "Failed to get compliance snapshot",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance/items
 * Query params: orgId (required), framework (optional), status (optional)
 */
router.get("/items", async (req: Request, res: Response) => {
  try {
    const { orgId, framework, status } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const items = await complianceService.listComplianceItems(orgId, {
      framework: typeof framework === "string" ? (framework as ComplianceFramework) : undefined,
      status: status as any,
    });

    return res.status(200).json({ items: items ?? [] });
  } catch (err) {
    console.error("List compliance items error:", err);
    return res.status(500).json({
      error: "Failed to list compliance items",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * PATCH /api/compliance/items/:itemId
 * Body: { status, evidenceNotes }
 */
router.patch("/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { status, evidenceNotes } = req.body;

    const item = await complianceService.updateComplianceItem(itemId, {
      status,
      evidenceNotes,
    });

    return res.status(200).json(item);
  } catch (err) {
    console.error("Update compliance item error:", err);
    return res.status(500).json({
      error: "Failed to update compliance item",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance/tasks
 * Query params: orgId (required), status(optional), severity(optional), assignedToUserId(optional), limit(optional)
 */
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { orgId, status, severity, assignedToUserId, limit } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const tasks = await complianceService.listTasks(orgId, {
      status: typeof status === "string" ? (status as TaskStatus) : undefined,
      severity: typeof severity === "string" ? (severity as PhiSeverity) : undefined,
      assignedToUserId: typeof assignedToUserId === "string" ? assignedToUserId : undefined,
      limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
    });

    return res.status(200).json({ tasks: tasks ?? [] });
  } catch (err) {
    console.error("List compliance tasks error:", err);
    return res.status(500).json({
      error: "Failed to list compliance tasks",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance/tasks/:taskId
 */
router.get("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const task = await complianceService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(200).json(task);
  } catch (err) {
    console.error("Get compliance task error:", err);
    return res.status(500).json({
      error: "Failed to get compliance task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/compliance/tasks
 */
router.post("/tasks", async (req: Request, res: Response) => {
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

    if (!orgId) return res.status(400).json({ error: "orgId is required" });
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!severity) return res.status(400).json({ error: "severity is required" });

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

    return res.status(201).json(task);
  } catch (err) {
    console.error("Create compliance task error:", err);
    return res.status(500).json({
      error: "Failed to create compliance task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * PATCH /api/compliance/tasks/:taskId/status
 */
router.patch("/tasks/:taskId/status", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "status is required" });

    const task = await complianceService.updateTaskStatus(taskId, status);
    return res.status(200).json(task);
  } catch (err) {
    console.error("Update task status error:", err);
    return res.status(500).json({
      error: "Failed to update task status",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * PATCH /api/compliance/tasks/:taskId/assign
 */
router.patch("/tasks/:taskId/assign", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });

    const task = await complianceService.assignTask(taskId, userId);
    return res.status(200).json(task);
  } catch (err) {
    console.error("Assign task error:", err);
    return res.status(500).json({
      error: "Failed to assign task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance/summary
 * Query: orgId
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const summary = await complianceService.getComplianceSummary(orgId);
    return res.status(200).json(summary);
  } catch (err) {
    console.error("Get compliance summary error:", err);
    return res.status(500).json({
      error: "Failed to get compliance summary",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/compliance/snapshot
 * Body: { orgId, framework }
 */
router.post("/snapshot", async (req: Request, res: Response) => {
  try {
    const { orgId, framework } = req.body;

    if (!orgId) return res.status(400).json({ error: "orgId is required" });
    if (!framework) return res.status(400).json({ error: "framework is required" });

    const snapshot = await complianceService.createSnapshot(orgId, framework);
    return res.status(201).json(snapshot);
  } catch (err) {
    console.error("Create compliance snapshot error:", err);
    return res.status(500).json({
      error: "Failed to create compliance snapshot",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/compliance/mark-overdue
 * Body: { orgId }
 */
router.post("/mark-overdue", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.body;

    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const count = await complianceService.markOverdueTasks(orgId);
    return res.status(200).json({ markedOverdue: count });
  } catch (err) {
    console.error("Mark overdue tasks error:", err);
    return res.status(500).json({
      error: "Failed to mark overdue tasks",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
