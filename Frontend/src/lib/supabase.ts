import { createClient } from "@supabase/supabase-js";
import { appEnv, runtimeMode } from "./env";

export const supabase = runtimeMode.hasSupabase
  ? createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey)
  : null;
