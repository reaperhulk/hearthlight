import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The build stamps itself so a deployed page can say exactly which commit
// it is. GITHUB_SHA is the authority in Actions (the checkout is shallow
// and detached, but the SHA is always right); a local build falls back to
// git and marks a dirty tree, so a hand-built page is never mistaken for
// something that actually shipped.
function buildStamp() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    const head = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().length > 0
    return dirty ? `${head}-dirty` : head
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __COMMIT__: JSON.stringify(buildStamp()),
  },
})
