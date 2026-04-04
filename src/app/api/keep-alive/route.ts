import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple ping to keep Supabase project alive
export async function GET() {
    try {
        const supabase = await createClient();
        const { count, error } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true });

        if (error) throw error;

        return NextResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            users: count,
        });
    } catch (error) {
        console.error("Keep-alive ping failed:", error);
        return NextResponse.json({ status: "error" }, { status: 500 });
    }
}
