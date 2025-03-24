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
import type { SourceMapJson } from "../scopes.d.ts";
import { OriginalScopeFlags, Tag } from "../codec.ts";

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
});
