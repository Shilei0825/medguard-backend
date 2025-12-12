import { supabase } from '../config/supabaseClient';
import {
  SafeDataset,
  SafeDatasetInsert,
} from '../types/db';

export const datasetService = {
  /**
   * Create a safe dataset record.
   * 
   * NOTE: This service stores references to PHI-sanitized datasets.
   * The actual dataset generation would involve:
   * - Extracting data from multiple files
   * - Removing or anonymizing all PHI
   * - Generating synthetic replacements where needed
   * - Exporting to a safe format (JSON, CSV, Parquet)
   * 
   * TODO: Integrate with dataset generation pipeline:
   * - Data extraction from scanned files
   * - Anonymization engine (k-anonymity, differential privacy)
   * - Synthetic data generation
   * - Quality validation
   */
  async createSafeDataset(data: {
    orgId: string;
    name: string;
    sourceDescription?: string;
    fileCount: number;
    recordCount?: number;
    storageUrl?: string;
    format?: string;
    createdByUserId?: string | null;
  }): Promise<SafeDataset> {
    const insertData: SafeDatasetInsert = {
      org_id: data.orgId,
      name: data.name,
      source_description: data.sourceDescription || null,
      file_count: data.fileCount,
      record_count: data.recordCount || null,
      storage_url: data.storageUrl || null,
      format: data.format || null,
      created_by_user_id: data.createdByUserId || null,
    };

    const { data: result, error } = await supabase
      .from('safe_datasets')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create safe dataset: ${error.message}`);
    return result as SafeDataset;
  },

  /**
   * List safe datasets for an organization.
   */
  async listSafeDatasets(
    orgId: string,
    options: {
      format?: string;
      limit?: number;
    } = {}
  ): Promise<SafeDataset[]> {
    let query = supabase
      .from('safe_datasets')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.format) {
      query = query.eq('format', options.format);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list safe datasets: ${error.message}`);

    return (data || []) as SafeDataset[];
  },

  /**
   * Get safe dataset by ID.
   */
  async getSafeDatasetById(datasetId: string): Promise<SafeDataset | null> {
    const { data, error } = await supabase
      .from('safe_datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error) return null;
    return data as SafeDataset;
  },

  /**
   * Update safe dataset metadata.
   */
  async updateSafeDataset(
    datasetId: string,
    updates: {
      name?: string;
      sourceDescription?: string;
      recordCount?: number;
      storageUrl?: string;
    }
  ): Promise<SafeDataset> {
    const updateData: Partial<SafeDataset> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.sourceDescription !== undefined) {
      updateData.source_description = updates.sourceDescription;
    }
    if (updates.recordCount !== undefined) {
      updateData.record_count = updates.recordCount;
    }
    if (updates.storageUrl !== undefined) {
      updateData.storage_url = updates.storageUrl;
    }

    const { data, error } = await supabase
      .from('safe_datasets')
      .update(updateData)
      .eq('id', datasetId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update safe dataset: ${error.message}`);
    return data as SafeDataset;
  },

  /**
   * Delete a safe dataset record.
   * Note: This only deletes the database record.
   * The actual dataset in storage should be handled separately.
   */
  async deleteSafeDataset(datasetId: string): Promise<void> {
    const { error } = await supabase
      .from('safe_datasets')
      .delete()
      .eq('id', datasetId);

    if (error) throw new Error(`Failed to delete safe dataset: ${error.message}`);
  },

  /**
   * Get dataset statistics for an organization.
   */
  async getDatasetStats(orgId: string): Promise<{
    totalDatasets: number;
    totalFiles: number;
    totalRecords: number;
    byFormat: Record<string, number>;
  }> {
    const { data: datasets, error } = await supabase
      .from('safe_datasets')
      .select('file_count, record_count, format')
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to get dataset stats: ${error.message}`);

    const byFormat: Record<string, number> = {};
    let totalFiles = 0;
    let totalRecords = 0;

    for (const dataset of datasets || []) {
      totalFiles += dataset.file_count || 0;
      totalRecords += dataset.record_count || 0;

      const format = dataset.format || 'unknown';
      byFormat[format] = (byFormat[format] || 0) + 1;
    }

    return {
      totalDatasets: datasets?.length || 0,
      totalFiles,
      totalRecords,
      byFormat,
    };
  },
};

export default datasetService;
