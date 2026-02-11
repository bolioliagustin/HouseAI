export type NotificationPayload = {
    title: string;
    body: string;
};

export const NOTIFICATION_TEMPLATES = {
    NEW_EXPENSE: (amount: number, description: string, user?: string) => ({
        title: "💸 Nuevo gasto compartido",
        body: `${user ? user + ": " : ""}${description} — $${Math.ceil(amount).toLocaleString("es-AR")}`,
    }),
    NEW_SCAN: (amount: number, store: string, user?: string) => ({
        title: "🧾 Nuevo ticket escaneado",
        body: `${user ? user + ": " : ""}${store} — $${Math.ceil(amount).toLocaleString("es-AR")}`,
    }),
    NEW_MEMBER: (name: string) => ({
        title: "👋 Nuevo habitante",
        body: `¡${name} se unió a la casa!`,
    }),
    NEW_INSTALLMENT: (description: string, total: number, user?: string) => ({
        title: "💳 Nueva compra en cuotas",
        body: `${user ? user + ": " : ""}${description} — Total: $${Math.ceil(total).toLocaleString("es-AR")}`,
    }),
};

export async function sendNotification(payload: NotificationPayload) {
    try {
        const res = await fetch("/api/push/notify-house", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json();
            console.error("Notification error:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Failed to send notification:", error);
        return false;
    }
}
