import { supabase } from '../config/supabaseClient';
import {
  ComplianceItem,
  ComplianceSnapshot,
  ComplianceTask,
  ComplianceTaskInsert,
  ComplianceFramework,
  ComplianceStatus,
  TaskStatus,
  PhiSeverity,
} from '../types/db';

export const complianceService = {
  /**
   * Get the latest compliance snapshot for an organization.
   */
  async getLatestSnapshot(
    orgId: string,
    framework?: ComplianceFramework
  ): Promise<ComplianceSnapshot | null> {
    let query = supabase
      .from('compliance_snapshots')
      .select('*')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (framework) {
      query = query.eq('framework', framework);
    }

    const { data, error } = await query.single();

    if (error) return null;
    return data as ComplianceSnapshot;
  },

  /**
   * List compliance items for an organization.
   */
  async listComplianceItems(
    orgId: string,
    options: {
      framework?: ComplianceFramework;
      status?: ComplianceStatus;
    } = {}
  ): Promise<ComplianceItem[]> {
    let query = supabase
      .from('compliance_items')
      .select('*')
      .eq('org_id', orgId)
      .order('requirement_code');

    if (options.framework) {
      query = query.eq('framework', options.framework);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list compliance items: ${error.message}`);

    return (data || []) as ComplianceItem[];
  },

  /**
   * Update compliance item status.
   */
  async updateComplianceItem(
    itemId: string,
    updates: {
      status?: ComplianceStatus;
      evidenceNotes?: string;
    }
  ): Promise<ComplianceItem> {
    const updateData: Partial<ComplianceItem> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status) {
      updateData.status = updates.status;
      updateData.last_assessed_at = new Date().toISOString();
    }

    if (updates.evidenceNotes !== undefined) {
      updateData.evidence_notes = updates.evidenceNotes;
    }

    const { data, error } = await supabase
      .from('compliance_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update compliance item: ${error.message}`);
    return data as ComplianceItem;
  },

  /**
   * List compliance tasks for an organization.
   */
  async listTasks(
    orgId: string,
    options: {
      status?: TaskStatus;
      severity?: PhiSeverity;
      assignedToUserId?: string;
      limit?: number;
    } = {}
  ): Promise<ComplianceTask[]> {
    let query = supabase
      .from('compliance_tasks')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options.assignedToUserId) {
      query = query.eq('assigned_to_user_id', options.assignedToUserId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list compliance tasks: ${error.message}`);

    return (data || []) as ComplianceTask[];
  },

  /**
   * Get task by ID.
   */
  async getTaskById(taskId: string): Promise<ComplianceTask | null> {
    const { data, error } = await supabase
      .from('compliance_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) return null;
    return data as ComplianceTask;
  },

  /**
   * Create a compliance task.
   */
  async createTask(taskData: {
    orgId: string;
    createdByUserId?: string | null;
    assignedToUserId?: string | null;
    title: string;
    description?: string;
    severity: PhiSeverity;
    dueDate?: string;
    relatedScanId?: string | null;
    relatedFileId?: string | null;
    relatedAlertId?: string | null;
    relatedComplianceItemId?: string | null;
  }): Promise<ComplianceTask> {
    const taskInsert: ComplianceTaskInsert = {
      org_id: taskData.orgId,
      created_by_user_id: taskData.createdByUserId || null,
      assigned_to_user_id: taskData.assignedToUserId || null,
      title: taskData.title,
      description: taskData.description || null,
      severity: taskData.severity,
      status: 'pending',
      due_date: taskData.dueDate || null,
      related_scan_id: taskData.relatedScanId || null,
      related_file_id: taskData.relatedFileId || null,
      related_alert_id: taskData.relatedAlertId || null,
      related_compliance_item_id: taskData.relatedComplianceItemId || null,
      completed_at: null,
    };

    const { data, error } = await supabase
      .from('compliance_tasks')
      .insert(taskInsert)
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data as ComplianceTask;
  },

  /**
   * Update task status.
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<ComplianceTask> {
    const updateData: Partial<ComplianceTask> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('compliance_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);
    return data as ComplianceTask;
  },

  /**
   * Assign task to user.
   */
  async assignTask(taskId: string, userId: string): Promise<ComplianceTask> {
    const { data, error } = await supabase
      .from('compliance_tasks')
      .update({
        assigned_to_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw new Error(`Failed to assign task: ${error.message}`);
    return data as ComplianceTask;
  },

  /**
   * Create a compliance snapshot for the organization.
   * Should be called periodically or after compliance updates.
   */
  async createSnapshot(
    orgId: string,
    framework: ComplianceFramework
  ): Promise<ComplianceSnapshot> {
    // Get compliance items for this framework
    const items = await this.listComplianceItems(orgId, { framework });

    const totalRequirements = items.length;
    let compliantCount = 0;
    let partialCount = 0;
    let nonCompliantCount = 0;

    for (const item of items) {
      switch (item.status) {
        case 'COMPLIANT':
          compliantCount++;
          break;
        case 'PARTIAL':
          partialCount++;
          break;
        case 'NON_COMPLIANT':
          nonCompliantCount++;
          break;
      }
    }

    const compliancePercentage = totalRequirements > 0
      ? Math.round((compliantCount / totalRequirements) * 100)
      : 0;

    const snapshotData = {
      org_id: orgId,
      snapshot_date: new Date().toISOString().split('T')[0],
      framework,
      total_requirements: totalRequirements,
      compliant_count: compliantCount,
      partial_count: partialCount,
      non_compliant_count: nonCompliantCount,
      compliance_percentage: compliancePercentage,
    };

    const { data, error } = await supabase
      .from('compliance_snapshots')
      .upsert(snapshotData, {
        onConflict: 'org_id,snapshot_date,framework',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create compliance snapshot: ${error.message}`);
    return data as ComplianceSnapshot;
  },

  /**
   * Get compliance summary for an organization.
   */
  async getComplianceSummary(orgId: string): Promise<{
    byFramework: Record<ComplianceFramework, {
      totalRequirements: number;
      compliantCount: number;
      compliancePercentage: number;
    }>;
    overallPercentage: number;
    pendingTasks: number;
    overdueTasks: number;
  }> {
    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('compliance_items')
      .select('framework, status')
      .eq('org_id', orgId);

    if (itemsError) throw new Error(`Failed to get compliance items: ${itemsError.message}`);

    const byFramework: Record<string, {
      totalRequirements: number;
      compliantCount: number;
      compliancePercentage: number;
    }> = {};

    let totalItems = 0;
    let totalCompliant = 0;

    for (const item of items || []) {
      if (!byFramework[item.framework]) {
        byFramework[item.framework] = {
          totalRequirements: 0,
          compliantCount: 0,
          compliancePercentage: 0,
        };
      }

      byFramework[item.framework].totalRequirements++;
      totalItems++;

      if (item.status === 'COMPLIANT') {
        byFramework[item.framework].compliantCount++;
        totalCompliant++;
      }
    }

    // Calculate percentages
    for (const framework of Object.keys(byFramework)) {
      const fw = byFramework[framework];
      fw.compliancePercentage = fw.totalRequirements > 0
        ? Math.round((fw.compliantCount / fw.totalRequirements) * 100)
        : 0;
    }

    // Get task counts
    const { count: pendingTasks } = await supabase
      .from('compliance_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending');

    const { count: overdueTasks } = await supabase
      .from('compliance_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'overdue');

    return {
      byFramework: byFramework as Record<ComplianceFramework, {
        totalRequirements: number;
        compliantCount: number;
        compliancePercentage: number;
      }>,
      overallPercentage: totalItems > 0
        ? Math.round((totalCompliant / totalItems) * 100)
        : 0,
      pendingTasks: pendingTasks || 0,
      overdueTasks: overdueTasks || 0,
    };
  },

  /**
   * Mark overdue tasks.
   */
  async markOverdueTasks(orgId: string): Promise<number> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('compliance_tasks')
      .update({
        status: 'overdue',
        updated_at: now,
      })
      .eq('org_id', orgId)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', now)
      .select('id');

    if (error) throw new Error(`Failed to mark overdue tasks: ${error.message}`);
    return data?.length || 0;
  },
};

export default complianceService;
