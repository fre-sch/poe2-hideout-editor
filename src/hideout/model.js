/**
 * The document the editor edits: a hideout file's header, passed through
 * untouched, and its doodads as one flat array.
 *
 * Flat is the point. The 3D editor kept doodads in a scene graph that its
 * transform control re-parented them out of, and a doodad that lived in two
 * places at once is the direct cause of wiki issues 0001 and 0005. An array has
 * nowhere else to put anything.
 */

import * as file from "./file.js";

const DOODAD_FIELDS = ["hash", "x", "y", "r", "fv"];

/**
 * One placed object. `name` is its localized display name and is not unique --
 * a hideout holds hundreds of doodads under the same name, which is the whole
 * reason `file.js` exists. Identity is the object, not any field of it.
 */
export class Doodad {
  constructor(name, fields) {
    this.name = name;
    for (const field of DOODAD_FIELDS) {
      this[field] = fields[field];
    }
  }

  /** The five fields, in file order. */
  toFields() {
    return Object.fromEntries(
      DOODAD_FIELDS.map((field) => [field, this[field]]),
    );
  }
}

export class HideoutDocument {
  /**
   * `header` is whatever the file said, kept verbatim. The editor knows the
   * hideout type it is drawing bounds for, but that is a viewport concern and
   * must not reach back into the saved header: the 3D editor rewrote
   * `hideout_name` from its own table and wrote the typo "Limestone Hideoout"
   * into player files, wiki issue 0009.
   */
  constructor(header, doodads) {
    this.header = header;
    this.doodads = doodads;
  }

  static fromText(text) {
    const { doodads, ...header } = file.parse(text);
    return new HideoutDocument(
      header,
      doodads.map(([name, fields]) => new Doodad(name, fields)),
    );
  }

  toText() {
    return file.serialize({
      ...this.header,
      doodads: this.doodads.map((doodad) => [doodad.name, doodad.toFields()]),
    });
  }
}
