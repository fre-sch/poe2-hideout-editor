/**
 * The generated layer colours.
 *
 * What is asserted is what the colours are *for*: that they differ, and that
 * they differ in hue alone. The exact hex of the first one is not a fact worth
 * pinning -- moving the lightness a little is a design change and not a
 * regression -- so lightness is checked by converting back rather than by
 * comparing against a stored list.
 */

import { describe, expect, it } from "vitest";

import * as colors from "../src/hideout/colors.js";

/**
 * The Oklab lightness of a `#rrggbb`, which is the round trip of what
 * `colors.js` does: the sRGB transfer function undone, then the two published
 * matrices. Written out here rather than exported from the module, so that a
 * mistake in the conversion cannot agree with itself.
 */
function lightnessOf(color) {
  const [red, green, blue] = [1, 3, 5].map((at) =>
    gammaDecode(parseInt(color.slice(at, at + 2), 16) / 255),
  );

  const long = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  );
  const medium = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  );
  const short = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  );

  return 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
}

function gammaDecode(channel) {
  if (channel <= 0.04045) return channel / 12.92;
  return ((channel + 0.055) / 1.055) ** 2.4;
}

/** Ten colours, which is more layers than a hideout is usually organised into. */
function sequence(count) {
  const generated = [];
  for (let step = 0; step < count; step++) {
    generated.push(colors.generate(generated));
  }
  return generated;
}

describe("generate", () => {
  it("answers a colour a canvas and a colour input both read", () => {
    expect(colors.generate()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("never repeats a colour already taken", () => {
    const generated = sequence(10);

    expect(new Set(generated).size).toBe(10);
  });

  it("holds every colour at one perceived lightness", () => {
    const lightnesses = sequence(10).map(lightnessOf);

    for (const lightness of lightnesses) {
      // A rounding to eight bits per channel is what separates these, not a
      // difference anybody can see.
      expect(lightness).toBeCloseTo(lightnesses[0], 2);
    }
  });

  /**
   * The property the golden angle is chosen for: the first few colours are
   * spread, not clustered at one end of the circle waiting for the rest of the
   * sequence to arrive. Distance in sRGB is a crude measure of it and is enough
   * -- these are all the same lightness, so what is left to differ is hue.
   */
  it("spreads the first few colours rather than the finished set", () => {
    const [first, second, third] = sequence(3);

    expect(distance(first, second)).toBeGreaterThan(0.3);
    expect(distance(second, third)).toBeGreaterThan(0.3);
    expect(distance(first, third)).toBeGreaterThan(0.3);
  });

  it("steps past a colour already in use", () => {
    const first = colors.generate();

    expect(colors.generate([first])).not.toBe(first);
  });

  it("ignores what is taken but was never generated", () => {
    expect(colors.generate(["#123456"])).toBe(colors.generate());
  });
});

describe("outline", () => {
  it("is lighter than the colour it is for, in every channel", () => {
    const color = colors.generate();

    for (const [lit, plain] of zip(colors.outline(color), color)) {
      expect(lit).toBeGreaterThanOrEqual(plain);
    }
  });

  it("stays a colour and does not wash out to white", () => {
    expect(colors.outline("#008080")).not.toBe("#ffffff");
  });

  it("refuses anything but '#rrggbb'", () => {
    expect(() => colors.outline("teal")).toThrow(/#rrggbb/);
  });
});

function channels(color) {
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255);
}

function zip(one, other) {
  return channels(one).map((channel, at) => [channel, channels(other)[at]]);
}

function distance(one, other) {
  const [red, green, blue] = zip(one, other).map(([a, b]) => a - b);
  return Math.sqrt(red ** 2 + green ** 2 + blue ** 2);
}
