import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nwjferusflezbwspjmix.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53amZlcnVzZmxlemJ3c3BqbWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0ODgxODUsImV4cCI6MjA4NTA2NDE4NX0.zh0wdMYOlkiVtBK3Mf-Tyavd3WJoV3erwSnhX3tqJ5A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 簡易的なユーザーID（後でちゃんとした認証に変更可能）
export function getUserId(): string {
  let userId = localStorage.getItem('conan_user_id')
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('conan_user_id', userId)
  }
  return userId
}
