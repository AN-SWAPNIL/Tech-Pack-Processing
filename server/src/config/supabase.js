import { createClient } from "@supabase/supabase-js";

let supabaseInstance = null;

// Create Supabase client with lazy initialization
export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    // Validate required environment variables
    if (!process.env.SUPABASE_URL) {
      throw new Error("SUPABASE_URL environment variable is required");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
      );
    }

    // Create Supabase client instance
    supabaseInstance = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("✅ Supabase client initialized successfully");
  }

  return supabaseInstance;
};

// Export default for convenience
export default getSupabaseClient;
