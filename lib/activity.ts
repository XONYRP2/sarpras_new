import { supabase } from '@/lib/supabase'

interface LogActivityParams {
  userId: string | null
  action: string
  module: string
  description: string
  dataBefore?: Record<string, any> | null
  dataAfter?: Record<string, any> | null
}

interface ClientInfo {
  ip: string | null
  userAgent: string
  clientApp: string
}

const CLIENT_INFO_KEY = 'clientInfoCache'

function resolveClientApp(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('electron')) return 'Desktop App'
  if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'Mobile Web'
  return 'Web'
}

async function getClientInfo(): Promise<ClientInfo> {
  const fallbackUa = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const fallback = {
    ip: null,
    userAgent: fallbackUa,
    clientApp: resolveClientApp(fallbackUa),
  }

  try {
    const cached = localStorage.getItem(CLIENT_INFO_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as ClientInfo
      if (parsed?.userAgent && parsed.ip) return parsed
    }
  } catch {
    // ignore cache errors
  }

  try {
    const res = await fetch('/api/client-info', { method: 'GET' })
    if (res.ok) {
      const data = (await res.json()) as ClientInfo
      localStorage.setItem(CLIENT_INFO_KEY, JSON.stringify(data))
      return data
    }
  } catch {
    // fallback below
  }

  try {
    localStorage.setItem(CLIENT_INFO_KEY, JSON.stringify(fallback))
  } catch {
    // ignore cache errors
  }
  return fallback
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
    const clientInfo = await getClientInfo()
    await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_action: action,
      p_module: module,
      p_description: description,
      p_data_before: dataBefore,
      p_data_after: dataAfter,
      p_ip_address: clientInfo.ip,
      p_user_agent: clientInfo.userAgent,
      p_client_app: clientInfo.clientApp,
    })
  } catch (err) {
    // Silent fail to avoid blocking UX on logging failures
    console.error('Failed to log activity:', err)
  }
}
