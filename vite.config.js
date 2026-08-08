import { defineConfig } from "vite"

export default defineConfig({
  // GitHub Pages serves the project from a subdirectory, not the domain root.
  base: "/poe2-hideout-editor/",
  // Preact components are JSX; the automatic runtime needs no plugin.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  build: {
    // The deployed application is not the source, see
    // wiki/decisions/build-step-and-preact-app.md
    sourcemap: true,
  },
})
