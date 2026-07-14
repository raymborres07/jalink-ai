// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // `inlineDynamicImports` isn't in this wrapper's typed `nitro` option surface, but it's
  // forwarded to Nitro's Vite plugin as-is. It disables Nitro/Rolldown's automatic per-npm-package
  // `_libs/<pkg>.mjs` chunk splitting for the server bundle (bundles everything into one file
  // instead). Needed to work around a Nitro v3 beta + Rolldown bug where CJS-wrapped React pulled
  // in through Radix UI packages ends up split into a separate chunk from the runtime helper
  // (`__commonJSMin`) it needs, and that helper is still `undefined` at the point the split chunk
  // calls it — a circular ESM chunk-initialization-order bug (nitrojs/nitro#4171,
  // rolldown/rolldown#8809). Only affects the server bundle; client asset code-splitting is
  // untouched.
  nitro: {
    inlineDynamicImports: true,
  } as never,
});
