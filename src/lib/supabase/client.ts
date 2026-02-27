import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // During build time, env vars may not be available.
        // Return a dummy client that won't be used for actual requests.
        return createBrowserClient(
            "https://placeholder.supabase.co",
            "placeholder-key"
        );
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
