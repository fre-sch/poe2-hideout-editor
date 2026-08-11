import { defineConfig } from "vite"

export default defineConfig({
  // GitHub Pages serves the project from a subdirectory, not the domain root.
  base: "/poe2-hideout-editor/",
  plugins: [google_site_verification()],
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

/**
 * Google Search Console proves ownership of a site by a tag in the head of the
 * page it serves at the property root.
 *
 * The token is injected at build rather than written into `index.html`, so that
 * a fork of this repository builds the same page without inheriting an
 * ownership claim it cannot use. The deploy workflow passes the repository
 * variable; a build without it -- a fork's, and every local one -- gets no tag.
 *
 * Read from `process.env` and not `import.meta.env`: the config runs in Node,
 * and a `VITE_`-prefixed name would put the value in the client bundle for the
 * sake of putting it in the head.
 */
function google_site_verification() {
  const token = process.env.GOOGLE_SITE_VERIFICATION
  return {
    name: "google-site-verification",
    transformIndexHtml() {
      if (!token) return []
      return [
        {
          tag: "meta",
          attrs: { name: "google-site-verification", content: token },
          injectTo: "head",
        },
      ]
    },
  }
}
