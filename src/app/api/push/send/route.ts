import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    // Lazy-load web-push to avoid issues during build/static generation
    const webpush = (await import("web-push")).default;

    // Configure VAPID details at request time
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    webpush.setVapidDetails(
        (process.env.NEXT_PUBLIC_VAPID_Subject || "mailto:admin@houseai.app").trim(),
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim(),
        process.env.VAPID_PRIVATE_KEY.trim()
    );

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { title, body, userId } = await request.json();

        let query = supabase.from("push_subscriptions").select("*");

        if (userId) {
            query = query.eq("user_id", userId);
        }

        const { data: subscriptions } = await query;

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: "No subscriptions found" });
        }

        const notifications = subscriptions.map((sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh,
                },
            };

            return webpush.sendNotification(
                pushSubscription,
                JSON.stringify({ title, body })
            ).catch((err: any) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    return supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
                console.error("Error sending push:", err);
            });
        });

        await Promise.all(notifications);

        return NextResponse.json({ success: true, count: notifications.length });
    } catch (error) {
        console.error("Error sending notifications:", error);
        return NextResponse.json(
            { error: "Error sending notifications" },
            { status: 500 }
        );
    }
}
