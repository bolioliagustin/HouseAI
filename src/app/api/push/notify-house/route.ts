import { createClient as createClientSSR } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const webpush = (await import("web-push")).default;

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    webpush.setVapidDetails(
        (process.env.NEXT_PUBLIC_VAPID_Subject || "mailto:admin@houseai.app").trim(),
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim(),
        process.env.VAPID_PRIVATE_KEY.trim()
    );

    // Use Service Role to bypass RLS and fetch other users' subscriptions
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );

    // Standard client for auth check
    const supabaseAuth = await createClientSSR();
    const {
        data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { title, body } = await request.json();

        // Get user's house
        const { data: membership } = await supabaseAdmin
            .from("house_members")
            .select("house_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership?.house_id) {
            return NextResponse.json({ message: "No house found" });
        }

        // Get all house members EXCEPT the current user
        const { data: houseMembers } = await supabaseAdmin
            .from("house_members")
            .select("user_id")
            .eq("house_id", membership.house_id)
            .neq("user_id", user.id);

        if (!houseMembers || houseMembers.length === 0) {
            return NextResponse.json({ message: "No other members to notify" });
        }

        const memberIds = houseMembers.map((m) => m.user_id);

        // Get push subscriptions for those members
        const { data: subscriptions } = await supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .in("user_id", memberIds);

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: "No subscriptions found for house members" });
        }

        const notifications = subscriptions.map((sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh,
                },
            };

            return webpush
                .sendNotification(pushSubscription, JSON.stringify({ title, body }))
                .catch((err: any) => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        return supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                    console.error("Error sending push:", err);
                });
        });

        await Promise.all(notifications);

        return NextResponse.json({ success: true, count: notifications.length });
    } catch (error) {
        console.error("Error notifying house:", error);
        return NextResponse.json(
            { error: "Error sending notifications" },
            { status: 500 }
        );
    }
}
