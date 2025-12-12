import { supabase } from '../config/supabaseClient';
import {
  Report,
  ReportInsert,
  ReportType,
  RiskLevel,
  FinancialRiskEstimate,
  OrgSettings,
} from '../types/db';

// Default breach cost per record if not set in org settings
// Based on HIPAA average breach cost estimates ($150-$400 per record)
const DEFAULT_BREACH_COST_PER_RECORD = 180;

export const reportService = {
  /**
   * Create a report record.
   */
  async createReport(data: {
    orgId: string;
    reportType: ReportType;
    label: string;
    description?: string;
    params?: Record<string, unknown>;
    results?: Record<string, unknown>;
    storageUrl?: string;
    createdByUserId?: string | null;
  }): Promise<Report> {
    const insertData: ReportInsert = {
      org_id: data.orgId,
      report_type: data.reportType,
      label: data.label,
      description: data.description || null,
      params: data.params || null,
      results: data.results || null,
      storage_url: data.storageUrl || null,
      created_by_user_id: data.createdByUserId || null,
    };

    const { data: result, error } = await supabase
      .from('reports')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create report: ${error.message}`);
    return result as Report;
  },

  /**
   * List reports for an organization.
   */
  async listReports(
    orgId: string,
    options: {
      reportType?: ReportType;
      limit?: number;
    } = {}
  ): Promise<Report[]> {
    let query = supabase
      .from('reports')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.reportType) {
      query = query.eq('report_type', options.reportType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list reports: ${error.message}`);

    return (data || []) as Report[];
  },

  /**
   * Get report by ID.
   */
  async getReportById(reportId: string): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) return null;
    return data as Report;
  },

  /**
   * Get organization settings for breach cost calculation.
   */
  async getOrgSettings(orgId: string): Promise<OrgSettings | null> {
    const { data, error } = await supabase
      .from('org_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) return null;
    return data as OrgSettings;
  },

  /**
   * Calculate financial risk estimate for an organization.
   * 
   * The financial risk is estimated based on:
   * - Total PHI count (from phi_findings or scanned_files.phi_count)
   * - Breach cost per record (from org_settings or default)
   * - Risk level based on exposure
   */
  async calculateFinancialRisk(orgId: string): Promise<{
    totalPhiCount: number;
    breachCostPerRecord: number;
    estimatedExposureCost: number;
    riskLevel: RiskLevel;
    breakdown: {
      highRiskFileCount: number;
      criticalRiskFileCount: number;
      avgRiskScore: number;
    };
  }> {
    // Get org settings for breach cost
    const orgSettings = await this.getOrgSettings(orgId);
    const breachCostPerRecord = orgSettings?.breach_cost_per_record || DEFAULT_BREACH_COST_PER_RECORD;

    // Get total PHI count from findings
    const { data: phiData, error: phiError } = await supabase
      .from('phi_findings')
      .select('occurrences')
      .eq('org_id', orgId);

    if (phiError) throw new Error(`Failed to get PHI count: ${phiError.message}`);

    const totalPhiCount = (phiData || []).reduce(
      (sum, f) => sum + (f.occurrences || 0),
      0
    );

    // Calculate exposure cost
    const estimatedExposureCost = totalPhiCount * breachCostPerRecord;

    // Get file risk breakdown
    const { data: files, error: filesError } = await supabase
      .from('scanned_files')
      .select('risk_score, risk_level')
      .eq('org_id', orgId);

    if (filesError) throw new Error(`Failed to get file data: ${filesError.message}`);

    let highRiskFileCount = 0;
    let criticalRiskFileCount = 0;
    let totalRiskScore = 0;

    for (const file of files || []) {
      totalRiskScore += file.risk_score || 0;
      if (file.risk_level === 'HIGH') highRiskFileCount++;
      if (file.risk_level === 'CRITICAL') criticalRiskFileCount++;
    }

    const avgRiskScore = files && files.length > 0
      ? Math.round(totalRiskScore / files.length)
      : 0;

    // Determine overall risk level based on exposure
    let riskLevel: RiskLevel;
    if (estimatedExposureCost >= 1000000 || criticalRiskFileCount >= 10) {
      riskLevel = 'CRITICAL';
    } else if (estimatedExposureCost >= 500000 || highRiskFileCount >= 20) {
      riskLevel = 'HIGH';
    } else if (estimatedExposureCost >= 100000 || highRiskFileCount >= 5) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    return {
      totalPhiCount,
      breachCostPerRecord,
      estimatedExposureCost,
      riskLevel,
      breakdown: {
        highRiskFileCount,
        criticalRiskFileCount,
        avgRiskScore,
      },
    };
  },

  /**
   * Generate and store a financial risk report.
   */
  async generateFinancialRiskReport(
    orgId: string,
    label: string,
    createdByUserId?: string | null
  ): Promise<FinancialRiskEstimate> {
    // Calculate risk
    const riskData = await this.calculateFinancialRisk(orgId);

    // Create report record
    const report = await this.createReport({
      orgId,
      reportType: 'financial_risk',
      label,
      description: `Financial risk assessment generated on ${new Date().toISOString()}`,
      params: {
        generatedAt: new Date().toISOString(),
        breachCostPerRecord: riskData.breachCostPerRecord,
      },
      results: {
        totalPhiCount: riskData.totalPhiCount,
        estimatedExposureCost: riskData.estimatedExposureCost,
        riskLevel: riskData.riskLevel,
        breakdown: riskData.breakdown,
      },
      createdByUserId,
    });

    return {
      totalPhiCount: riskData.totalPhiCount,
      breachCostPerRecord: riskData.breachCostPerRecord,
      estimatedExposureCost: riskData.estimatedExposureCost,
      riskLevel: riskData.riskLevel,
      report,
    };
  },

  /**
   * Generate PHI inventory report.
   */
  async generatePhiInventoryReport(
    orgId: string,
    label: string,
    createdByUserId?: string | null
  ): Promise<Report> {
    // Get PHI summary by type
    const { data: phiData, error: phiError } = await supabase
      .from('phi_findings')
      .select('phi_type, occurrences, severity')
      .eq('org_id', orgId);

    if (phiError) throw new Error(`Failed to get PHI data: ${phiError.message}`);

    const phiByType: Record<string, { count: number; severity: string }> = {};
    
    for (const finding of phiData || []) {
      if (!phiByType[finding.phi_type]) {
        phiByType[finding.phi_type] = { count: 0, severity: finding.severity };
      }
      phiByType[finding.phi_type].count += finding.occurrences;
    }

    // Get file counts
    const { count: totalFiles } = await supabase
      .from('scanned_files')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    const { count: filesWithPhi } = await supabase
      .from('scanned_files')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gt('phi_count', 0);

    const report = await this.createReport({
      orgId,
      reportType: 'phi_inventory',
      label,
      description: `PHI inventory report generated on ${new Date().toISOString()}`,
      params: {
        generatedAt: new Date().toISOString(),
      },
      results: {
        totalFiles: totalFiles || 0,
        filesWithPhi: filesWithPhi || 0,
        phiByType,
        totalPhiCount: Object.values(phiByType).reduce((sum, p) => sum + p.count, 0),
      },
      createdByUserId,
    });

    return report;
  },

  /**
   * Delete a report.
   */
  async deleteReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) throw new Error(`Failed to delete report: ${error.message}`);
  },
};

export default reportService;
