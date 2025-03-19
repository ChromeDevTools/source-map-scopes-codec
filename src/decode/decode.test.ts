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

  it("ignores wrong 'name' indices", () => {
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
    assertStrictEquals(info.scopes[0].name, undefined);
  });

  it("ignores wrong 'kind' indices", () => {
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
    assertStrictEquals(info.scopes[0].kind, undefined);
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

    const info = decode(map, { mode: DecodeMode.LOOSE });

    assertEquals(info.scopes, []);
  });

  it("throws in strict mode when there are 'open' scopes left at the end", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    assertThrows(() => decode(map, { mode: DecodeMode.STRICT }));
  });

  it("ignores 'open' scopes left at the end in loose mode", () => {
    const encoder = new ItemEncoder();
    encoder.addUnsignedVLQs(Tag.ORIGINAL_SCOPE_START, 0, 0, 0).finishItem();
    const map = createMap(encoder.encode(), []);

    const info = decode(map, { mode: DecodeMode.LOOSE });

    assertEquals(info.scopes, []);
  });
});
