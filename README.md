# poe2-hideout-editor

Edit PoE2 `.hideout` files visually in browser.

Very much only a *scratch-your-own-itch*-project at this time.

## Development

    npm ci
    npm run dev      # dev server
    npm run build    # production build into dist/
    npm test         # vitest
    npm run format   # prettier over src/

A Preact application on a 2D canvas, rewritten from an earlier 3D one. The
application under `src/` is the whole of it; the 3D predecessor is gone.

## Wishful thinking

* Copy/paste selections
* Copy/paste across files
* Change hideout type, language
* (Primitive) visuals for objects
