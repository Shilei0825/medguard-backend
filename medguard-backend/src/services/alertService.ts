import { supabase } from '../config/supabaseClient';
import { Alert, AlertInsert, PhiSeverity, AlertType } from '../types/db';

export const alertService = {
  /**
   * Create a new alert.
   */
  async createAlert(alertData: AlertInsert): Promise<Alert> {
    const { data, error } = await supabase
      .from('alerts')
      .insert(alertData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create alert: ${error.message}`);
    return data as Alert;
  },

  /**
   * List alerts for an organization with optional filters.
   */
  async listAlerts(
    orgId: string,
    options: {
      severity?: PhiSeverity;
      alertType?: AlertType;
      isResolved?: boolean;
      limit?: number;
    } = {}
  ): Promise<Alert[]> {
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options.alertType) {
      query = query.eq('alert_type', options.alertType);
    }

    if (options.isResolved !== undefined) {
      query = query.eq('is_resolved', options.isResolved);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list alerts: ${error.message}`);

    return (data || []) as Alert[];
  },

  /**
   * Get alert by ID.
   */
  async getAlertById(alertId: string): Promise<Alert | null> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (error) return null;
    return data as Alert;
  },

  /**
   * Resolve an alert.
   */
  async resolveAlert(alertId: string, userId?: string): Promise<Alert> {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: userId || null,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resolve alert: ${error.message}`);
    return data as Alert;
  },

  /**
   * Get alert counts by severity for an organization.
   */
  async getAlertCounts(orgId: string): Promise<{
    total: number;
    unresolved: number;
    bySeverity: Record<PhiSeverity, number>;
  }> {
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('severity, is_resolved')
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to get alert counts: ${error.message}`);

    const counts = {
      total: alerts?.length || 0,
      unresolved: 0,
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      } as Record<PhiSeverity, number>,
    };

    for (const alert of alerts || []) {
      if (!alert.is_resolved) counts.unresolved++;
      if (alert.severity in counts.bySeverity) {
        counts.bySeverity[alert.severity as PhiSeverity]++;
      }
    }

    return counts;
  },

  /**
   * Create alert for PHI spike detection.
   */
  async createPhiSpikeAlert(
    orgId: string,
    scanId: string,
    previousCount: number,
    newCount: number,
    percentageIncrease: number
  ): Promise<Alert> {
    return this.createAlert({
      org_id: orgId,
      alert_type: 'PHI_SPIKE',
      severity: percentageIncrease > 100 ? 'CRITICAL' : 'HIGH',
      title: `PHI spike detected: ${percentageIncrease.toFixed(0)}% increase`,
      description: `PHI count increased from ${previousCount} to ${newCount} (${percentageIncrease.toFixed(1)}% increase)`,
      related_scan_id: scanId,
      related_file_id: null,
      related_vendor_id: null,
      is_resolved: false,
      resolved_at: null,
      resolved_by_user_id: null,
    });
  },

  /**
   * Create alert for vendor risk.
   */
  async createVendorRiskAlert(
    orgId: string,
    vendorId: string,
    vendorName: string,
    riskScore: number
  ): Promise<Alert> {
    return this.createAlert({
      org_id: orgId,
      alert_type: 'VENDOR_RISK',
      severity: riskScore >= 80 ? 'CRITICAL' : 'HIGH',
      title: `High-risk vendor detected: ${vendorName}`,
      description: `Vendor ${vendorName} has a risk score of ${riskScore}`,
      related_scan_id: null,
      related_file_id: null,
      related_vendor_id: vendorId,
      is_resolved: false,
      resolved_at: null,
      resolved_by_user_id: null,
    });
  },

  /**
   * Delete alerts older than retention period.
   */
  async deleteOldAlerts(orgId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await supabase
      .from('alerts')
      .delete()
      .eq('org_id', orgId)
      .eq('is_resolved', true)
      .lt('resolved_at', cutoffDate.toISOString())
      .select('id');

    if (error) throw new Error(`Failed to delete old alerts: ${error.message}`);
    return data?.length || 0;
  },
};

export default alertService;
