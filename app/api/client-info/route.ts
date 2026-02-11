import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

function resolveClientIp(headerValue: string | null): string | null {
  if (!headerValue) return null
  const parts = headerValue.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  return parts[0]
}

function resolveClientApp(userAgent: string | null): string {
  const ua = (userAgent || '').toLowerCase()
  if (ua.includes('electron')) return 'Desktop App'
  if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'Mobile Web'
  return 'Web'
}

export async function GET() {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  const realIp = h.get('x-real-ip')
  const userAgent = h.get('user-agent') || ''

  let ip = resolveClientIp(forwarded) || realIp || null
  if (!ip && process.env.NODE_ENV !== 'production') {
    ip = '127.0.0.1'
  }
  const clientApp = resolveClientApp(userAgent)

  return NextResponse.json({ ip, userAgent, clientApp })
}
