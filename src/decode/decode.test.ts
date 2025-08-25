// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { describe, it } from "jsr:@std/testing/bdd";
import { ScopeInfoBuilder } from "../builder/builder.ts";
import { encode } from "../encode/encode.ts";
import {
  assertEquals,
  assertExists,
  assertStrictEquals,
  assertThrows,
} from "jsr:@std/assert";
import { encodeSigned, encodeUnsigned } from "../vlq.ts";
import { decode, DecodeMode } from "./decode.ts";
import type { IndexSourceMapJson, SourceMapJson } from "../scopes.ts";
import { GeneratedRangeFlags, OriginalScopeFlags, Tag } from "../codec.ts";

class ItemEncoder {
  #encodedItems: string[] = [];
  #currentItem = "";

  encode(): string {
    const result = this.#encodedItems.join(",");
    this.#encodedItems = [];
    this.#currentItem = "";
    return result;
  }

  finishItem(): this {
    this.#encodedItems.push(this.#currentItem);
    this.#currentItem = "";
    return this;
  }

  addUnsignedVLQs(...ns: number[]): this {
    for (const n of ns) {
      this.#currentItem += encodeUnsigned(n);
    }
    return this;
  }

  addSignedVLQs(...ns: number[]): this {
    for (const n of ns) {
      this.#currentItem += encodeSigned(n);
    }
    return this;
  }
}

function createMap(scopes: string, names: string[]): SourceMapJson {
  return {
    version: 3,
    mappings: "",
    sources: [],
    scopes,
    names,
  };
}

describe("decode", () => {
  it("handles unknown items interspersed in an known items", () => {
    const info = new ScopeInfoBuilder().startScope(0, 0).endScope(10, 0)
      .build();
    const map = encode(info);

    assertExists(map.scopes);

    const parts = map.scopes.split(",");
    const items = [
      encodeUnsigned(42) + encodeUnsigned(5),
      parts[0],
      encodeUnsigned(100) + encodeSigned(21) + encodeUnsigned(0),
      parts[1],
      encodeUnsigned(256),
    ];
    map.scopes = items.join(",");
    assertEquals(decode(map), info);
  });

  it("handles trailing VLQs in ORIGINAL_SCOPE_START items", () => {
    const info = new ScopeInfoBuilder().startScope(0, 0).endScope(10, 0)
      .build();
    const map = encode(info);

    assertExists(map.scopes);

    const parts = map.scopes.split(",");
    parts[0] += encodeUnsigned(42);
    parts[0] += encodeSigned(-16);
    map.scopes = parts.join(",");

    assertEquals(decode(map), info);
  });

  it("handles trailing VLQs in ORIGINAL_SCOPE_END items", () => {
    const info = new ScopeInfoBuilder().startScope(0, 0).endScope(10, 0)
      .build();
    const map = encode(info);

    assertExists(map.scopes);

    const parts = map.scopes.split(",");
    parts[1] += encodeUnsigned(42);
    parts[1] += encodeSigned(-16);
    map.scopes = parts.join(",");

    assertEquals(decode(map), info);
  });

  it("ignores wrong 'name' indices in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.ORIGINAL_SCOPE_START,
      OriginalScopeFlags.HAS_NAME,
      0,
      0,
    ).addSignedVLQs(2)
      .finishItem().addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 5, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map);

    assertExists(info.scopes[0]);
    assertStrictEquals(info.scopes[0].name, "");
  });

  it("ignores wrong 'kind' indices in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.ORIGINAL_SCOPE_START,
      OriginalScopeFlags.HAS_KIND,
      0,
      0,
    ).addSignedVLQs(2)
      .finishItem().addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 5, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map);

    assertExists(info.scopes[0]);
    assertStrictEquals(info.scopes[0].kind, "");
  });

  it("throws when encountering an ORIGINAL_SCOPE_END without start in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores miss-matched ORIGINAL_SCOPE_END items", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes, []);
  });

  it("throws in strict mode when there are 'open' scopes left at the end", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores 'open' scopes left at the end in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes, []);
  });

  it("throws in strict mode when encountering an GENERATED_RANGE_END without START", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END);
    encoder.addSignedVLQs(42).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores GENERATED_RANGE_END items without START in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END);
    encoder.addSignedVLQs(42).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.ranges, []);
  });

  it("throws for un-matched GENERATED_RANGE_START at the end in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_START, 0);
    encoder.addSignedVLQs(42).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores un-matched GENERATED_RANGE_START at the end in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_START, 0);
    encoder.addSignedVLQs(42).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.ranges, []);
  });

  it("throws for free ORIGINAL_SCOPE_VARIABLES items in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, 1).finishItem();
    const map = createMap(encoder.encode(), ["foo", "bar"]);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores free ORIGINAL_SCOPE_VARIABLES items in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, 1).finishItem();
    const map = createMap(encoder.encode(), ["foo", "bar"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes, []);
  });

  it("throws for free GENERATED_RANGE_BINDINGS items in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_BINDINGS);
    encoder.addSignedVLQs(0, -1).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores free ORIGINAL_SCOPE_VARIABLES items in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_BINDINGS);
    encoder.addSignedVLQs(0, -1).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes, []);
  });

  it("throws if ORIGINAL_SCOPE_VARIABLES indices are out-of-bounds (upper) in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, 2).finishItem(); // The '2' is illegal as we only have 1 name.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "index into the 'names'",
    );
  });

  it("throws if ORIGINAL_SCOPE_VARIABLES indices are out-of-bounds (lower) in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, -1).finishItem(); // The '-1' is illegal as we only have 1 name.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "index into the 'names'",
    );
  });

  it("ignores if ORIGINAL_SCOPE_VARIABLES indices are out-of-bounds (upper) in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, 2).finishItem(); // The '2' is illegal as we only have 1 name.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes[0]?.variables, ["foo", ""]);
  });

  it("ignores if ORIGINAL_SCOPE_VARIABLES indices are out-of-bounds (lower) in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES);
    encoder.addSignedVLQs(0, -1).finishItem(); // The '-1' is illegal as we only have 1 name.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.scopes[0]?.variables, ["foo", ""]);
  });

  it("throws if ORIGINAL_SCOPE_START.name is out-of-bounds in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.ORIGINAL_SCOPE_START,
      OriginalScopeFlags.HAS_NAME,
      0,
      0,
    ).addSignedVLQs(1).finishItem(); // The last '1' is the illegal name index.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "index into the 'names' array",
    );
  });

  it("throws if ORIGINAL_SCOPE_START.kind is out-of-bounds in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.ORIGINAL_SCOPE_START,
      OriginalScopeFlags.HAS_KIND,
      0,
      0,
    ).addSignedVLQs(1).finishItem(); // The last '1' is the illegal name index.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "index into the 'names' array",
    );
  });

  it("throws if GENERATED_RANGE_BINDINGS is out-of-bounds in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_START, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_BINDINGS).addSignedVLQs(2)
      .finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 2).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "index into the 'names' array",
    );
  });

  it("ignores if GENERATED_RANGE_BINDINGS is out-of-bounds in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_START, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_BINDINGS).addSignedVLQs(2)
      .finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 2).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.ranges[0]?.values, [""]);
  });

  it("throws if GENERATED_RANGE_START.definition is not a valid original scope in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.GENERATED_RANGE_START,
      GeneratedRangeFlags.HAS_DEFINITION,
      0,
      1,
    ).finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 2).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores if GENERATED_RANGE_START.definition is not a valid original scope in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(
      Tag.GENERATED_RANGE_START,
      GeneratedRangeFlags.HAS_DEFINITION,
      0,
      1,
    ).finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 2).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertExists(info.ranges[0]);
    assertStrictEquals(info.ranges[0].originalScope, undefined);
  });

  it("throws for free GENERATED_RANGE_CALL_SITE items in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_CALL_SITE);
    encoder.addSignedVLQs(0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores free GENERATED_RANGE_CALL_SITE items in lax mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_CALL_SITE);
    encoder.addSignedVLQs(0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertEquals(info.ranges, []);
  });

  it("throws for multiple GENERATED_RANGE_SUBRANGE_BINDING items for the same variable in strict mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_START, 0, 0).finishItem();
    // Sub-range binding for variable 0
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_SUBRANGE_BINDING, 0, 1, 1, 0)
      .finishItem();
    // Duplicate sub-range binding for variable 0
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_SUBRANGE_BINDING, 0, 1, 2, 0)
      .finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 2, 0).finishItem();
    const map = createMap(encoder.encode(), ["foo"]);

    assertThrows(
      () => decode(map, { mode: DecodeMode.STRICT }),
      Error,
      "Encountered multiple GENERATED_RANGE_SUBRANGE_BINDING items for the same variable",
    );
  });

  it("ignores multiple GENERATED_RANGE_SUBRANGE_BINDING items for the same variable in lax mode", () => {
    const encoder = new ItemEncoder();
    // Original scope with 1 variable.
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_VARIABLES, 0).finishItem();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_END, 1, 0).finishItem();

    // Generated range from 0,0 to 3,0, referencing the original scope.
    encoder.addUnsignedVLQs(
      Tag.GENERATED_RANGE_START,
      GeneratedRangeFlags.HAS_DEFINITION,
      0,
      0,
    ).addSignedVLQs(0).finishItem();
    // Initial binding for the variable is "bar" (index 2).
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_BINDINGS, 2).finishItem();

    // 1st sub-range binding for variable 0. from 1,0, value is "var1" (index 1)
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_SUBRANGE_BINDING, 0, 1, 1, 0)
      .finishItem();
    // 2nd sub-range binding for variable 0. from 2,0, value is "baz" (index 3)
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_SUBRANGE_BINDING, 0, 3, 1, 0)
      .finishItem();
    encoder.addUnsignedVLQs(Tag.GENERATED_RANGE_END, 3, 0).finishItem();
    const map = createMap(encoder.encode(), ["var1", "bar", "baz"]);

    const info = decode(map, { mode: DecodeMode.LAX });

    assertExists(info.ranges[0]);
    assertEquals(info.ranges[0].values, [
      [
        {
          value: "bar",
          from: { line: 0, column: 0 },
          to: { line: 1, column: 0 },
        },
        {
          value: "var1",
          from: { line: 1, column: 0 },
          to: { line: 3, column: 0 },
        },
      ],
    ]);
  });

  it("applies 'generatedOffset' option correctly for line 0", () => {
    const scopes = new ScopeInfoBuilder().startRange(0, 0).endRange(0, 10)
      .build();
    const map = encode(scopes);

    const info = decode(map, { generatedOffset: { line: 0, column: 20 } });

    assertEquals(info.ranges[0].start, { line: 0, column: 20 });
    assertEquals(info.ranges[0].end, { line: 0, column: 30 });
  });

  it("applies 'generatedOffset' option correctly for non-zero line and column", () => {
    const scopes = new ScopeInfoBuilder().startRange(0, 10).endRange(0, 20)
      .build();
    const map = encode(scopes);

    const info = decode(map, { generatedOffset: { line: 2, column: 5 } });

    assertEquals(info.ranges[0].start, { line: 2, column: 15 });
    assertEquals(info.ranges[0].end, { line: 2, column: 25 });
  });

  it("decodes index source maps", () => {
    const map1 = encode(
      new ScopeInfoBuilder().startRange(0, 0).endRange(0, 10)
        .build(),
    );
    const map2 = encode(
      new ScopeInfoBuilder().startRange(0, 0).endRange(1, 20)
        .build(),
    );
    const map: IndexSourceMapJson = {
      version: 3,
      sections: [
        { offset: { line: 0, column: 0 }, map: map1 },
        { offset: { line: 1, column: 42 }, map: map2 },
      ],
    };

    const info = decode(map);

    assertEquals(info.ranges[0].start, { line: 0, column: 0 });
    assertEquals(info.ranges[0].end, { line: 0, column: 10 });
    assertEquals(info.ranges[1].start, { line: 1, column: 42 });
    assertEquals(info.ranges[1].end, { line: 2, column: 20 });
  });

  it("ignores 'generatedOffset' option for index source maps", () => {
    const map1 = encode(
      new ScopeInfoBuilder().startRange(0, 0).endRange(0, 10)
        .build(),
    );
    const map: IndexSourceMapJson = {
      version: 3,
      sections: [
        { offset: { line: 0, column: 0 }, map: map1 },
      ],
    };

    const info = decode(map, { generatedOffset: { line: 4, column: 42 } });

    assertEquals(info.ranges[0].start, { line: 0, column: 0 });
    assertEquals(info.ranges[0].end, { line: 0, column: 10 });
  });
});
