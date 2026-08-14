# poe2-hideout-editor

Edit PoE2 `.hideout` files visually in your browser.

https://fre-sch.github.io/poe2-hideout-editor/

Very much a *scratch-your-own-itch*-project at this time.

## Features

### Layers!

Group and organize your hideout decorations into layers. Delete them, duplicate
them. Every layer gets its own colour, so you can see at a glance which layer a
decoration belongs to -- pick another colour whenever you like.

### Generators!

Generate arrays of decorations from grids, circles, polygons, and paths.
Randomize the decorations and variations!

### Doodad Palette!

Pick hideout decorations from a palette. No guarantees they'll survive
importing, though. Make sure to only place decorations you own.

## Development

    npm ci
    npm run dev      # dev server
    npm run build    # production build into dist/
    npm test         # vitest
    npm run format   # prettier over src/


## Wishful thinking

* Copy/paste selections
* Copy/paste across files
* Change hideout type, language
* (Primitive) visuals for objects
