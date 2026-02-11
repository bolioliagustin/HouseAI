// Custom Service Worker code for Push Notifications
// This file is automatically included by next-pwa via customWorkerSrc

self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "MitAI";
    const options = {
        body: data.body || "Tienes una nueva notificación",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        vibrate: [100, 50, 100],
        data: {
            url: "/dashboard",
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/dashboard";
    event.waitUntil(clients.openWindow(url));
});
