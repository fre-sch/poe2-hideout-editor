# poe2-hideout-editor

Edit PoE2 `.hideout` files visually in browser.

Very much only a *scratch-your-own-itch*-project at this time.

## Development

    npm ci
    npm run dev      # dev server
    npm run build    # production build into dist/
    npm test         # vitest
    npm run format   # prettier over src/

Being rewritten from a three.js application to a Preact application on a 2D
canvas. The application under `src/` is a shell for now; the previous version
is still in `hideoutEditor/` and is still what the deployed page serves.

## Wishful thinking

* Copy/paste selections
* Copy/paste across files
* Change hideout type, language
* (Primitive) visuals for objects
