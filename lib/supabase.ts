
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const createSafeClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    // Avoid crashing during build; throw only when actually used.
    return new Proxy({} as ReturnType<typeof createClient>, {
      get() {
        throw new Error('Supabase env missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
      },
    })
  }
  return createClient(supabaseUrl, supabaseKey)
}

export const supabase = createSafeClient()
