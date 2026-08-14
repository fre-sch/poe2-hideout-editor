/**
 * The colours a layer's doodads are drawn in: how a new one is generated, and
 * the lighter shade the outline takes.
 *
 * **Generated in OKLCh, so that hue is the only thing that differs.** A colour
 * here says "these doodads belong together" and nothing else, so no layer may
 * read as brighter, louder or more important than another. sRGB cannot state
 * that -- `#00FF00` and `#0000FF` are the same three numbers rearranged and
 * nowhere near the same brightness -- while OKLCh's lightness is perceived
 * lightness, which is the whole reason to convert rather than to pick hues out
 * of a hat. See (Oklab)[https://bottosson.github.io/posts/oklab/].
 *
 * Answers are `#rrggbb`, which is what Konva and `<input type="color">` both
 * speak. `oklch()` is a CSS colour a canvas would accept, and it is converted
 * here anyway: the swatch in the layer row cannot show one, and a document that
 * holds two spellings of a colour is a document that has to compare them.
 */

/**
 * The lightness every generated colour shares, and the chroma it asks for.
 *
 * Lightness is measured against the viewport's black background: dark enough
 * that the white outline and the selection colours stay louder, light enough
 * that a doodad is visible at a zoom showing a whole hideout.
 *
 * The chroma is what a hue asks for and not what it gets -- see `atHue`.
 */
const LIGHTNESS = 0.72;
const CHROMA = 0.15;

/**
 * Where the sequence starts, and how far each step turns.
 *
 * The golden angle is the arrangement that spreads *every* prefix of a sequence
 * rather than only the finished set: three layers are as far apart as three
 * layers can be, and so are the next three. Dividing the circle by a layer count
 * would have to renumber every colour whenever a layer is added.
 */
const FIRST_HUE = 200;
const GOLDEN_ANGLE = 137.508;

/** How far a colour is mixed toward white to become an outline. */
const OUTLINE_MIX = 0.45;

/** Steps of chroma given up by a hue that cannot be shown, see `atHue`. */
const CHROMA_STEP = 0.005;

/**
 * A colour none of `taken` carries, from the hue sequence.
 *
 * A hue whose colour is already in use is stepped past rather than nudged, so
 * that the colours in a document are always members of one evenly spread set.
 *
 * The search is bounded by the number of colours taken, because that many steps
 * cannot all collide -- and a bound is what keeps a document of many layers from
 * turning a colour into a hang. The last candidate is the answer if they somehow
 * do: a repeated colour is worth less than a working editor.
 */
export function generate(taken = []) {
  const used = new Set(taken);
  let color = null;
  for (let step = 0; step <= used.size; step++) {
    color = atHue(FIRST_HUE + step * GOLDEN_ANGLE);
    if (!used.has(color)) return color;
  }
  return color;
}

/**
 * The colour a doodad is outlined in: its own, mixed toward white.
 *
 * Derived rather than fixed, because a fixed outline is a ring every doodad
 * wears in the same colour -- and at the zoom where a hideout fits on screen the
 * ring is most of what is seen, which would take back most of what the fill
 * says. Mixing toward white keeps the hue and leaves the outline the lighter of
 * the two, which is what an outline against a black background has to be.
 */
export function outline(color) {
  const [red, green, blue] = readHex(color);
  return toHex([mixToWhite(red), mixToWhite(green), mixToWhite(blue)]);
}

function mixToWhite(channel) {
  return channel + (1 - channel) * OUTLINE_MIX;
}

/**
 * The colour of a hue at the shared lightness, at as much chroma as sRGB can
 * show it at.
 *
 * Most hues cannot be shown at one chroma -- the sRGB gamut is a lopsided solid
 * and a saturated blue reaches much further than a saturated yellow. Something
 * has to give, and it is the chroma: lightness is what these colours are being
 * kept equal in, and a hue changed to fit is a different colour rather than a
 * duller one.
 */
function atHue(hue) {
  for (let chroma = CHROMA; chroma > 0; chroma -= CHROMA_STEP) {
    const rgb = toLinearRgb(LIGHTNESS, chroma, hue);
    if (rgb.every(shows)) return toHex(rgb.map(gammaEncode));
  }
  return toHex(toLinearRgb(LIGHTNESS, 0, hue).map(gammaEncode));
}

/** Whether a linear channel is a colour sRGB has, rather than one it clips. */
function shows(channel) {
  return channel >= 0 && channel <= 1;
}

/**
 * OKLCh to linear sRGB, by the published matrices: polar to Oklab, Oklab to the
 * cone responses it is defined against, and those to linear sRGB.
 *
 * The numbers are the constants of the colour space and are not derived from
 * anything here; changing one is changing which colour space this is.
 */
function toLinearRgb(lightness, chroma, hue) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

/** The sRGB transfer function: linear light to the numbers a file holds. */
function gammaEncode(channel) {
  if (channel <= 0.0031308) return 12.92 * channel;
  return 1.055 * channel ** (1 / 2.4) - 0.055;
}

function toHex(channels) {
  const digits = channels.map((channel) =>
    Math.round(clamp(channel) * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${digits.join("")}`;
}

/**
 * `#rrggbb` as three channels of 0 to 1. Anything else is refused: a colour
 * arrives either from `generate` or from a colour input, and both write that
 * form, so a third form is a bug rather than a colour to guess at.
 */
function readHex(color) {
  const digits = /^#([0-9a-f]{6})$/i.exec(color);
  if (!digits) throw new Error(`Not a '#rrggbb' colour: '${color}'`);

  return [0, 2, 4].map((at) => parseInt(digits[1].slice(at, at + 2), 16) / 255);
}

function clamp(channel) {
  return Math.min(Math.max(channel, 0), 1);
}
