import { supabase } from './supabase';

export interface SchemaMapping {
  hideField: string | null;
  passField: string | null;
  detected: string[];
}

let cachedMapping: SchemaMapping | null = null;

/**
 * Auto-detects the actual database schema for confessions.
 */
export const detectSchema = async (): Promise<SchemaMapping> => {
  if (cachedMapping) return cachedMapping;

  console.group('🔍 [Schema Discovery]');
  try {
    const { data, error } = await supabase
      .from('confessions')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Failed to detect schema:', error);
      return { hideField: null, passField: null, detected: [] };
    }

    const keys = Object.keys(data);
    console.log('Fields found in DB:', keys);

    const mapping: SchemaMapping = {
      hideField: keys.includes('is_hidden') ? 'is_hidden' : (keys.includes('hidden') ? 'hidden' : (keys.includes('hidden_at') ? 'hidden_at' : null)),
      passField: keys.includes('reviewed_at') ? 'reviewed_at' : (keys.includes('reviewed') ? 'reviewed' : null),
      detected: keys
    };

    console.log('Mapped logic fields:', { hide: mapping.hideField, pass: mapping.passField });
    cachedMapping = mapping;
    return mapping;
  } catch (e) {
    console.error('Schema discovery exception:', e);
    return { hideField: null, passField: null, detected: [] };
  } finally {
    console.groupEnd();
  }
};

/**
 * Fetches current row state for debugging.
 */
export const getRowSnapshot = async (id: string) => {
  const { data, error } = await supabase
    .from('confessions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return { error: error.message };
  return data;
};

/**
 * Performs update with verification and logs a detailed receipt.
 */
export const updateWithReceipt = async (action: 'hide' | 'unhide' | 'pass', id: string) => {
  const schema = await detectSchema();
  const before = await getRowSnapshot(id);
  
  console.group(`🚀 [Admin Action: ${action.toUpperCase()}]`);
  console.log('Target ID:', id);
  console.log('Snapshot BEFORE:', before);

  let patch: any = {};
  const now = new Date().toISOString();

  if (action === 'hide') {
    if (!schema.hideField) {
      console.error('❌ ABORT: No field found in DB to support "hide" action.');
      console.groupEnd();
      return { success: false, error: 'Incompatible Schema' };
    }
    patch[schema.hideField] = schema.hideField.endsWith('_at') ? now : true;
  } else if (action === 'unhide') {
    if (!schema.hideField) {
      console.error('❌ ABORT: No field found in DB to support "unhide" action.');
      console.groupEnd();
      return { success: false, error: 'Incompatible Schema' };
    }
    patch[schema.hideField] = schema.hideField.endsWith('_at') ? null : false;
  } else if (action === 'pass') {
    if (!schema.passField) {
      console.error('❌ ABORT: No field found in DB to support "pass" action.');
      console.groupEnd();
      return { success: false, error: 'Incompatible Schema' };
    }
    patch[schema.passField] = schema.passField.endsWith('_at') ? now : true;
  }

  const { data, error, status } = await supabase
    .from('confessions')
    .update(patch)
    .eq('id', id)
    .select();

  const after = await getRowSnapshot(id);
  
  const receipt = {
    action,
    id,
    attempt: { patch, status },
    result: { 
      error: error || null, 
      matchedRows: data?.length || 0,
      hasEffect: JSON.stringify(before) !== JSON.stringify(after)
    },
    before,
    after
  };

  console.log('Action Receipt:', receipt);

  if (!receipt.result.hasEffect) {
    console.warn('⚠️ [TRAP D DETECTED] Update returned OK but database values did not change! Check RLS policies or field logic.');
  }

  if (receipt.result.matchedRows === 0) {
    console.warn('⚠️ [ZERO ROWS] Filter matched 0 rows. Target ID might not exist or filter is too restrictive.');
  }

  console.groupEnd();
  return { success: receipt.result.hasEffect, receipt };
};
