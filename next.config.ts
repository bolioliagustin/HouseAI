import withPWA from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const pwa = withPWA({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    customWorkerSrc: "worker",
    workboxOptions: {
        disableDevLogs: true,
    },
});

const nextConfig: NextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.supabase.co",
            },
        ],
    },
};

export default pwa(nextConfig);
