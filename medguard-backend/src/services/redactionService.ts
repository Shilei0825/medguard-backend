import { supabase } from '../config/supabaseClient';
import {
  RedactedFile,
  RedactedFileInsert,
  RedactionMethod,
  PhiType,
} from '../types/db';

export const redactionService = {
  /**
   * Create a redacted file record.
   * 
   * NOTE: This service stores references to redacted files.
   * The actual redaction logic would be implemented separately:
   * - Pattern-based: Regex replacement for known PHI patterns
   * - AI redaction: Using LLMs like Claude for intelligent redaction
   * - Manual: Human review and redaction
   * 
   * TODO: Integrate with actual redaction pipeline:
   * - File storage (S3/GCS) for redacted files
   * - Redaction engine (LLM or rules-based)
   * - Audit trail for redactions
   */
  async createRedactedFile(data: {
    orgId: string;
    originalFileId: string;
    redactedFileUrl: string;
    method: RedactionMethod;
    phiTypesRedacted?: PhiType[];
    redactionCount?: number;
    notes?: string;
    createdByUserId?: string | null;
  }): Promise<RedactedFile> {
    const insertData: RedactedFileInsert = {
      org_id: data.orgId,
      original_file_id: data.originalFileId,
      redacted_file_url: data.redactedFileUrl,
      method: data.method,
      phi_types_redacted: data.phiTypesRedacted || [],
      redaction_count: data.redactionCount || 0,
      notes: data.notes || null,
      created_by_user_id: data.createdByUserId || null,
    };

    const { data: result, error } = await supabase
      .from('redacted_files')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create redacted file: ${error.message}`);
    return result as RedactedFile;
  },

  /**
   * List redacted files for an organization.
   */
  async listRedactedFiles(
    orgId: string,
    options: {
      method?: RedactionMethod;
      limit?: number;
    } = {}
  ): Promise<RedactedFile[]> {
    let query = supabase
      .from('redacted_files')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.method) {
      query = query.eq('method', options.method);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list redacted files: ${error.message}`);

    return (data || []) as RedactedFile[];
  },

  /**
   * Get redacted file by ID.
   */
  async getRedactedFileById(redactedFileId: string): Promise<RedactedFile | null> {
    const { data, error } = await supabase
      .from('redacted_files')
      .select('*')
      .eq('id', redactedFileId)
      .single();

    if (error) return null;
    return data as RedactedFile;
  },

  /**
   * Get redacted versions of an original file.
   */
  async getRedactedVersions(originalFileId: string): Promise<RedactedFile[]> {
    const { data, error } = await supabase
      .from('redacted_files')
      .select('*')
      .eq('original_file_id', originalFileId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get redacted versions: ${error.message}`);
    return (data || []) as RedactedFile[];
  },

  /**
   * Get redaction statistics for an organization.
   */
  async getRedactionStats(orgId: string): Promise<{
    totalRedactedFiles: number;
    totalRedactions: number;
    byMethod: Record<RedactionMethod, number>;
    recentRedactions: RedactedFile[];
  }> {
    const { data: files, error } = await supabase
      .from('redacted_files')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get redaction stats: ${error.message}`);

    const byMethod: Record<RedactionMethod, number> = {
      ai_redaction: 0,
      manual: 0,
      pattern_based: 0,
      llm_assisted: 0,
    };

    let totalRedactions = 0;

    for (const file of files || []) {
      byMethod[file.method as RedactionMethod]++;
      totalRedactions += file.redaction_count || 0;
    }

    return {
      totalRedactedFiles: files?.length || 0,
      totalRedactions,
      byMethod,
      recentRedactions: ((files || []).slice(0, 5)) as RedactedFile[],
    };
  },

  /**
   * Delete a redacted file record.
   * Note: This only deletes the database record.
   * The actual file in storage should be handled separately.
   */
  async deleteRedactedFile(redactedFileId: string): Promise<void> {
    const { error } = await supabase
      .from('redacted_files')
      .delete()
      .eq('id', redactedFileId);

    if (error) throw new Error(`Failed to delete redacted file: ${error.message}`);
  },
};

export default redactionService;
