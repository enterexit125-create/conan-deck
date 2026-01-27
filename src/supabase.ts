import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nwjferusflezbwspjmix.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53amZlcnVzZmxlemJ3c3BqbWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0ODgxODUsImV4cCI6MjA4NTA2NDE4NX0.zh0wdMYOlkiVtBK3Mf-Tyavd3WJoV3erwSnhX3tqJ5A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 固定のユーザーID（全デバイスで共通）
const SHARED_USER_ID = 'conan_deck_user_main';

export function getUserId(): string {
  // 常に同じIDを返す
  return SHARED_USER_ID;
}
