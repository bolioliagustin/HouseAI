import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const subscription = await request.json();

        // Insert or update subscription
        const { error } = await supabase.from("push_subscriptions").upsert(
            {
                user_id: user.id,
                endpoint: subscription.endpoint,
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" }
        );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving subscription:", error);
        return NextResponse.json(
            { error: "Error saving subscription" },
            { status: 500 }
        );
    }
}
