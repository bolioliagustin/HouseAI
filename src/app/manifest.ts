import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'HouseAI - Gastos Compartidos',
        short_name: 'HouseAI',
        description: 'Gestiona tus gastos compartidos de forma inteligente',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#059669',
        icons: [
            {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            }
        ],
    }
}
