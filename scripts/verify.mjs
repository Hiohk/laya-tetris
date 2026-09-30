import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// 用最小化 DOM 垫片在 Node 里跑通运行时主循环
globalThis.window = globalThis
globalThis.localStorage = {
  store: new Map(),
  getItem(key) {
    return this.store.get(key) ?? null
  },
  setItem(key, value) {
    this.store.set(key, value)
  },
  removeItem(key) {
    this.store.delete(key)
  },
}
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 16)
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle)

const resolveAlias = {
  name: 'at-alias',
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.resolve('src', args.path.slice(2))
      for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const candidate = base + suffix
        if (existsSync(candidate) && statSync(candidate).isFile()) return { path: candidate }
      }
      return { path: base }
    })
  },
}

await build({
  entryPoints: ['scripts/verify-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'scripts/.verify.bundle.mjs',
  logLevel: 'warning',
  plugins: [resolveAlias],
  define: { 'import.meta.env': '{}' },
})

await import(pathToFileURL('scripts/.verify.bundle.mjs').href)
