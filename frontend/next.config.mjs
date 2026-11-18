import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Mode démo (GitHub Pages) :
 *   NEXT_PUBLIC_STATIC_DEMO=1 next build
 * produit un export statique sous out/ avec le basePath du dépôt.
 * Sans cette variable, le comportement (build classique avec API) est inchangé.
 */
const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  ...(isStaticDemo
    ? {
        output: 'export',
        basePath: '/student-project-manager',
        trailingSlash: true,
      }
    : {}),
  webpack(config) {
    config.resolve.alias['@'] = path.dirname(fileURLToPath(import.meta.url))
    return config
  },
}

export default nextConfig
