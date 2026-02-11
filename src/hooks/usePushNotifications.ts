"use client";

import { useState, useEffect, useCallback } from "react";

const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();

export function usePushNotifications() {
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        async function init() {
            try {
                // Check basic support
                if (!("Notification" in window)) {
                    setError("Tu navegador no soporta notificaciones");
                    setIsLoading(false);
                    return;
                }

                setPermission(Notification.permission);

                // Try to register service worker
                if ("serviceWorker" in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.register("/sw.js");
                        setRegistration(reg);

                        // Check existing subscription
                        if ("pushManager" in reg) {
                            const sub = await reg.pushManager.getSubscription();
                            setSubscription(sub);
                        }
                    } catch (swErr) {
                        console.warn("Service Worker registration failed:", swErr);
                        // SW failed but notifications might still work via Notification API
                    }
                }
            } catch (err) {
                console.warn("Push init error:", err);
            } finally {
                setIsLoading(false);
            }
        }

        init();
    }, []);

    const subscribeToPush = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        setError(null);

        // Step 1: Request notification permission
        if (!("Notification" in window)) {
            const msg = "Tu navegador no soporta notificaciones. En iPhone, instalá la app primero (Compartir → Agregar a inicio).";
            setError(msg);
            return { success: false, error: msg };
        }

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult === "denied") {
                const msg = "Permiso denegado. Cambialo en los ajustes de tu navegador.";
                setError(msg);
                return { success: false, error: msg };
            }

            if (permissionResult !== "granted") {
                const msg = "Permiso no concedido.";
                setError(msg);
                return { success: false, error: msg };
            }

            // Step 2: Subscribe to push (requires SW + PushManager)
            if (!registration) {
                // Try to register SW again
                if ("serviceWorker" in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.register("/sw.js");
                        setRegistration(reg);
                        return await doSubscribe(reg);
                    } catch (e) {
                        const msg = "No se pudo activar el servicio de push. Probá desde Chrome en computadora.";
                        setError(msg);
                        return { success: false, error: msg };
                    }
                } else {
                    const msg = "Tu navegador no soporta Service Workers. Probá desde Chrome.";
                    setError(msg);
                    return { success: false, error: msg };
                }
            }

            return await doSubscribe(registration);
        } catch (err: any) {
            const msg = err?.message || "Error desconocido al activar notificaciones.";
            setError(msg);
            return { success: false, error: msg };
        }
    }, [registration]);

    async function doSubscribe(reg: ServiceWorkerRegistration): Promise<{ success: boolean; error?: string }> {
        if (!("pushManager" in reg)) {
            const msg = "Push no disponible. En iPhone necesitás iOS 16.4+ y abrir desde el ícono de inicio.";
            setError(msg);
            return { success: false, error: msg };
        }

        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        });

        setSubscription(sub);

        // Save to backend
        await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub),
        });

        return { success: true };
    }

    const unsubscribeFromPush = useCallback(async () => {
        if (subscription) {
            await subscription.unsubscribe();
            setSubscription(null);
            setError(null);
        }
    }, [subscription]);

    return {
        permission,
        subscription,
        subscribeToPush,
        unsubscribeFromPush,
        isLoading,
        error,
    };
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
