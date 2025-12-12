import { supabase } from '../config/supabaseClient';
import {
  Vendor,
  VendorFile,
  ScannedFile,
  VendorInsert,
  RiskTier,
  PhiType,
} from '../types/db';
import { alertService } from './alertService';

interface VendorPhiSummary {
  totalPhiCount: number;
  phiByType: Record<string, number>;
  avgRiskScore: number;
  highRiskFileCount: number;
}

export const vendorService = {
  /**
   * List all vendors for an organization.
   */
  async listVendors(orgId: string): Promise<Vendor[]> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('org_id', orgId)
      .order('overall_score', { ascending: false, nullsFirst: false });

    if (error) throw new Error(`Failed to list vendors: ${error.message}`);
    return (data || []) as Vendor[];
  },

  /**
   * Get vendor by ID.
   */
  async getVendorById(vendorId: string): Promise<Vendor | null> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) return null;
    return data as Vendor;
  },

  /**
   * Create or update a vendor.
   */
  async upsertVendor(vendorData: {
    orgId: string;
    name: string;
    contactEmail?: string;
    domain?: string;
    baseScore?: number;
    notes?: string;
  }): Promise<Vendor> {
    // Check if vendor with same name exists
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .eq('org_id', vendorData.orgId)
      .eq('name', vendorData.name)
      .single();

    const vendorInsert: Partial<VendorInsert> = {
      org_id: vendorData.orgId,
      name: vendorData.name,
      contact_email: vendorData.contactEmail || null,
      domain: vendorData.domain || null,
      base_score: vendorData.baseScore || null,
      notes: vendorData.notes || null,
      risk_tier: 'UNASSESSED',
      behavior_score: null,
      overall_score: vendorData.baseScore || null,
      last_assessed_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          ...vendorInsert,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update vendor: ${error.message}`);
      return data as Vendor;
    } else {
      const { data, error } = await supabase
        .from('vendors')
        .insert(vendorInsert)
        .select()
        .single();

      if (error) throw new Error(`Failed to create vendor: ${error.message}`);
      return data as Vendor;
    }
  },

  /**
   * Get vendor details with associated files and PHI summary.
   */
  async getVendorDetails(vendorId: string): Promise<{
    vendor: Vendor;
    files: Array<{ vendorFile: VendorFile; scannedFile: ScannedFile }>;
    phiSummary: VendorPhiSummary;
  } | null> {
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (vendorError || !vendor) return null;

    const { data: vendorFiles, error: vfError } = await supabase
      .from('vendor_files')
      .select('*')
      .eq('vendor_id', vendorId);

    if (vfError) throw new Error(`Failed to get vendor files: ${vfError.message}`);

    const fileIds = (vendorFiles || []).map(vf => vf.file_id);
    let scannedFiles: ScannedFile[] = [];

    if (fileIds.length > 0) {
      const { data: files, error: filesError } = await supabase
        .from('scanned_files')
        .select('*')
        .in('id', fileIds);

      if (filesError) throw new Error(`Failed to get scanned files: ${filesError.message}`);
      scannedFiles = (files || []) as ScannedFile[];
    }

    const fileMap = new Map(scannedFiles.map(f => [f.id, f]));
    const filesWithDetails = (vendorFiles || [])
      .map(vf => ({
        vendorFile: vf as VendorFile,
        scannedFile: fileMap.get(vf.file_id)!,
      }))
      .filter(f => f.scannedFile);

    let phiSummary: VendorPhiSummary = {
      totalPhiCount: 0,
      phiByType: {},
      avgRiskScore: 0,
      highRiskFileCount: 0,
    };

    if (fileIds.length > 0) {
      const { data: phiFindings, error: phiError } = await supabase
        .from('phi_findings')
        .select('phi_type, occurrences')
        .in('file_id', fileIds);

      if (phiError) throw new Error(`Failed to get PHI findings: ${phiError.message}`);

      for (const finding of phiFindings || []) {
        phiSummary.totalPhiCount += finding.occurrences;
        const phiType = finding.phi_type;
        phiSummary.phiByType[phiType] = (phiSummary.phiByType[phiType] || 0) + finding.occurrences;
      }

      let totalRisk = 0;
      for (const file of scannedFiles) {
        totalRisk += file.risk_score || 0;
        if (file.risk_level === 'HIGH' || file.risk_level === 'CRITICAL') {
          phiSummary.highRiskFileCount++;
        }
      }
      phiSummary.avgRiskScore = scannedFiles.length > 0 
        ? Math.round(totalRisk / scannedFiles.length) 
        : 0;
    }

    const updatedVendor = await this.updateVendorScores(vendorId, scannedFiles);

    return {
      vendor: updatedVendor,
      files: filesWithDetails,
      phiSummary,
    };
  },

  /**
   * Associate a file with a vendor.
   */
  async associateFile(
    vendorId: string,
    fileId: string,
    relationshipType: 'shared_with' | 'received_from' | 'processed_by',
    notes?: string
  ): Promise<VendorFile> {
    const { data, error } = await supabase
      .from('vendor_files')
      .insert({
        vendor_id: vendorId,
        file_id: fileId,
        relationship_type: relationshipType,
        shared_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to associate file: ${error.message}`);
    return data as VendorFile;
  },

  /**
   * Update vendor scores based on associated files.
   */
  async updateVendorScores(vendorId: string, files?: ScannedFile[]): Promise<Vendor> {
    if (!files) {
      const { data: vendorFiles } = await supabase
        .from('vendor_files')
        .select('file_id')
        .eq('vendor_id', vendorId);

      const fileIds = (vendorFiles || []).map(vf => vf.file_id);
      
      if (fileIds.length > 0) {
        const { data: scannedFiles } = await supabase
          .from('scanned_files')
          .select('*')
          .in('id', fileIds);
        
        files = (scannedFiles || []) as ScannedFile[];
      } else {
        files = [];
      }
    }

    let behaviorScore: number | null = null;
    
    if (files.length > 0) {
      let totalRisk = 0;
      let highRiskCount = 0;
      
      for (const file of files) {
        totalRisk += file.risk_score || 0;
        if (file.risk_level === 'HIGH' || file.risk_level === 'CRITICAL') {
          highRiskCount++;
        }
      }
      
      const avgRisk = totalRisk / files.length;
      const highRiskPenalty = (highRiskCount / files.length) * 30;
      behaviorScore = Math.max(0, Math.round(100 - avgRisk - highRiskPenalty));
    }

    const { data: currentVendor } = await supabase
      .from('vendors')
      .select('base_score, org_id')
      .eq('id', vendorId)
      .single();

    const baseScore = currentVendor?.base_score || 50;
    let overallScore: number;
    
    if (behaviorScore !== null) {
      overallScore = Math.round(baseScore * 0.4 + behaviorScore * 0.6);
    } else {
      overallScore = baseScore;
    }

    const riskTier: RiskTier = 
      overallScore >= 80 ? 'LOW' :
      overallScore >= 60 ? 'MEDIUM' :
      overallScore >= 40 ? 'HIGH' : 'CRITICAL';

    const { data: updatedVendor, error } = await supabase
      .from('vendors')
      .update({
        behavior_score: behaviorScore,
        overall_score: overallScore,
        risk_tier: riskTier,
        last_assessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update vendor scores: ${error.message}`);

    if (riskTier === 'HIGH' || riskTier === 'CRITICAL') {
      if (currentVendor?.org_id) {
        await alertService.createVendorRiskAlert(
          currentVendor.org_id,
          vendorId,
          updatedVendor.name,
          overallScore
        );
      }
    }

    return updatedVendor as Vendor;
  },

  /**
   * Get vendor behavior analytics.
   */
  async getVendorAnalytics(orgId: string): Promise<{
    totalVendors: number;
    byRiskTier: Record<RiskTier, number>;
    avgOverallScore: number;
    topRiskyVendors: Vendor[];
    topSecureVendors: Vendor[];
  }> {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to get vendor analytics: ${error.message}`);

    const byRiskTier: Record<RiskTier, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      UNASSESSED: 0,
    };

    let totalScore = 0;
    let scoredCount = 0;

    for (const vendor of vendors || []) {
      byRiskTier[vendor.risk_tier as RiskTier]++;
      if (vendor.overall_score !== null) {
        totalScore += vendor.overall_score;
        scoredCount++;
      }
    }

    const sortedVendors = [...(vendors || [])].sort(
      (a, b) => (a.overall_score || 100) - (b.overall_score || 100)
    );

    return {
      totalVendors: vendors?.length || 0,
      byRiskTier,
      avgOverallScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
      topRiskyVendors: sortedVendors.slice(0, 5) as Vendor[],
      topSecureVendors: sortedVendors.slice(-5).reverse() as Vendor[],
    };
  },

  /**
   * Delete a vendor.
   */
  async deleteVendor(vendorId: string): Promise<void> {
    await supabase
      .from('vendor_files')
      .delete()
      .eq('vendor_id', vendorId);

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', vendorId);

    if (error) throw new Error(`Failed to delete vendor: ${error.message}`);
  },
};

export default vendorService;
