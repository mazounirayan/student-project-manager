/**
 * Build de la démo statique (GitHub Pages), multiplateforme.
 * Équivalent de : NEXT_PUBLIC_STATIC_DEMO=1 next build
 * Sans cette variable, `next build` garde son comportement classique (API réelle).
 */
import { spawnSync } from "node:child_process"

process.env.NEXT_PUBLIC_STATIC_DEMO = "1"

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
