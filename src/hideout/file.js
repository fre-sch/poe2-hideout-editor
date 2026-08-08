/**
 * Reader and writer for `.hideout` files.
 *
 * The format looks like JSON but its `doodads` object has repeating keys, so
 * `JSON.parse` would keep only the last entry per display name -- 22 of
 * Limestone's 687 doodads. See wiki/specifications/hideout-file-format.md.
 * Hence the hand-written recursive descent parser: it is the only reason this
 * module exists.
 *
 * `doodads` parses to an ordered array of `[name, fields]` pairs; everything
 * else parses as ordinary JSON would.
 */

const BOM = "﻿";

/**
 * Parse `.hideout` text into its raw structure. A leading byte order mark is
 * stripped; `serialize` writes it back.
 *
 * Throws `SyntaxError` with a character offset on malformed input.
 */
export function parse(text) {
  return new Parser(stripBom(text)).parseDocument();
}

/**
 * Write the structure `parse` returns back to `.hideout` text, the way the
 * game writes it: byte order mark, two-space indent, LF, no trailing newline.
 */
export function serialize(data) {
  const doodads = data.doodads
    .map(([name, fields]) => `"${name}": ${JSON.stringify(fields, null, 2)}`)
    .join(",\n")
    .replaceAll(/^/gm, "    ");
  return `${BOM}{
  "version": ${data.version},
  "language": "${data.language}",
  "hideout_name": "${data.hideout_name}",
  "hideout_hash": ${data.hideout_hash},
  "doodads": {
${doodads}
  }
}`;
}

export function stripBom(text) {
  return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}

const KEYWORDS = [
  ["true", true],
  ["false", false],
  ["null", null],
];

/**
 * Recursive descent over the whole text, with `offset` as the read cursor.
 *
 * Every scanning loop tests for end of input. Without that a truncated string
 * spins forever comparing `undefined` to its terminator, which froze the
 * browser tab -- wiki issue 0002.
 */
class Parser {
  constructor(text) {
    this.text = text;
    this.offset = 0;
  }

  parseDocument() {
    const document = this.parseValue();
    this.skipWhitespace();
    if (!this.atEnd()) this.fail("Expected end of input");
    return document;
  }

  fail(message) {
    throw new SyntaxError(`${message} at offset ${this.offset}`);
  }

  atEnd() {
    return this.offset >= this.text.length;
  }

  current() {
    return this.text[this.offset];
  }

  skipWhitespace() {
    while (!this.atEnd() && /\s/.test(this.current())) {
      this.offset++;
    }
  }

  /**
   * `parentKey` names the key this value was found under, so that the one key
   * whose object repeats -- `doodads` -- can be kept as ordered pairs.
   */
  parseValue(parentKey = null) {
    this.skipWhitespace();
    if (this.atEnd()) this.fail("Expected a value");

    const character = this.current();
    if (character === "{") return this.parseObject(parentKey);
    if (character === "[") return this.parseArray();
    if (character === '"') return this.parseString();
    if (isDigit(character)) return this.parseNumber();
    return this.parseKeyword();
  }

  parseObject(parentKey) {
    this.offset++;

    const asPairs = parentKey === "doodads";
    const result = asPairs ? [] : {};
    let firstMember = true;

    this.skipWhitespace();
    while (this.current() !== "}") {
      if (this.atEnd()) this.fail("Unterminated object");
      if (!firstMember) {
        if (this.current() !== ",") {
          this.fail("Expected ',' between object members");
        }
        this.offset++;
        this.skipWhitespace();
      }

      if (this.current() !== '"') this.fail("Expected a string key");
      const key = this.parseString();

      this.skipWhitespace();
      if (this.current() !== ":") this.fail("Expected ':' after key");
      this.offset++;

      const value = this.parseValue(key);
      if (asPairs) {
        result.push([key, value]);
      } else {
        result[key] = value;
      }

      this.skipWhitespace();
      firstMember = false;
    }

    this.offset++;
    return result;
  }

  parseArray() {
    this.offset++;

    const result = [];
    let firstElement = true;

    this.skipWhitespace();
    while (this.current() !== "]") {
      if (this.atEnd()) this.fail("Unterminated array");
      if (!firstElement) {
        if (this.current() !== ",") {
          this.fail("Expected ',' between array elements");
        }
        this.offset++;
      }
      result.push(this.parseValue());
      this.skipWhitespace();
      firstElement = false;
    }

    this.offset++;
    return result;
  }

  /**
   * Unsigned decimal only. Signs and exponents appear in no observed file, see
   * wiki issue 0003.
   */
  parseNumber() {
    const start = this.offset;
    while (!this.atEnd() && isDigit(this.current())) {
      this.offset++;
    }

    const digits = this.text.slice(start, this.offset);
    const value = Number(digits);
    if (Number.isNaN(value)) {
      this.offset = start;
      this.fail(`Not a number: '${digits}'`);
    }
    return value;
  }

  /**
   * Escape sequences appear in no observed file and are rejected rather than
   * silently mangled, see wiki issue 0003. A backslash read as a literal would
   * be written back out doubled.
   */
  parseString() {
    const start = this.offset;
    this.offset++;

    let result = "";
    while (this.current() !== '"') {
      if (this.atEnd()) {
        this.offset = start;
        this.fail("Unterminated string");
      }
      if (this.current() === "\\") this.fail("Escape sequences unsupported");
      result += this.text[this.offset++];
    }

    this.offset++;
    return result;
  }

  parseKeyword() {
    for (const [keyword, value] of KEYWORDS) {
      if (this.text.startsWith(keyword, this.offset)) {
        this.offset += keyword.length;
        return value;
      }
    }
    this.fail(`Expected a value`);
  }
}

// A leading '.' is not valid JSON, but the original parser accepted it and no
// observed file has one either way; `parseNumber` rejects what `Number` does.
function isDigit(character) {
  return (character >= "0" && character <= "9") || character === ".";
}
