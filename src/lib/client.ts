import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export const demoAllowed=process.env.NEXT_PUBLIC_DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
