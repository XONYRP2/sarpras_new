import { supabase } from '@/lib/supabase'

interface LogActivityParams {
  userId: string | null
  action: string
  module: string
  description: string
  dataBefore?: Record<string, any> | null
  dataAfter?: Record<string, any> | null
}

export async function logActivity({
  userId,
  action,
  module,
  description,
  dataBefore = null,
  dataAfter = null,
}: LogActivityParams) {
  if (!userId) return
  try {
    await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_action: action,
      p_module: module,
      p_description: description,
      p_data_before: dataBefore,
      p_data_after: dataAfter,
    })
  } catch (err) {
    // Silent fail to avoid blocking UX on logging failures
    console.error('Failed to log activity:', err)
  }
}
