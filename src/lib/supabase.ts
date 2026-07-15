import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xnxmzgmgmfesrathfnnl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhueG16Z21nbWZlc3JhdGhmbm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTE4OTAsImV4cCI6MjA5OTU4Nzg5MH0.PHLXOelFFqk8ugweQTgJgbHs4aKye9sQZHshJHJQ0R8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: {
    persistSession: true,      // 会话存 localStorage：关网页/重启浏览器仍保持登录
    autoRefreshToken: true,    // 通行证过期自动续期，用户无感知
    detectSessionInUrl: true,
  },
})
