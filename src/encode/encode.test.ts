// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "@std/testing/bdd";
import type { ScopeInfo, SourceMapJson } from "../scopes.ts";
import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { encode } from "./encode.ts";
import { ScopeInfoBuilder } from "../builder/builder.ts";

describe("encode", () => {
  let builder: ScopeInfoBuilder;

  beforeEach(() => {
    builder = new ScopeInfoBuilder();
  });

  it("throws when sources.length and scopes.length don't match", () => {
    const info: ScopeInfo = {
      scopes: [null, null],
      ranges: [],
    };

    const map: SourceMapJson = {
      version: 3,
      sources: ["foo.ts"],
      mappings: "",
    };

    assertThrows(() => encode(info, map));
  });

  it("returns the provided SourceMapJson object", () => {
    const info: ScopeInfo = {
      scopes: [null],
      ranges: [],
    };

    const map: SourceMapJson = {
      version: 3,
      sources: ["foo.ts"],
      mappings: "",
    };

    assertStrictEquals(encode(info, map), map);
  });

  it("encodes null sources correctly", () => {
    const info = builder.addNullSource().addNullSource().addNullSource()
      .build();

    const encoded = encode(info);
    assertEquals(encoded.scopes, [null, null, null]);
    assertEquals(encoded.ranges, []);
  });

  it("throws when a subsequent root scope precedes the previous root scope in the same source", () => {
    const info = builder.startSource()
      .startScope(10, 0).endScope(20, 0)
      .startScope(5, 0).endScope(15, 0)
      .endSource().build();

    assertThrows(() => encode(info));
  });

  it("throws when a child scope' start is not nested properly within its parent", () => {
    const info = builder.startSource().startScope(10, 0).startScope(0, 0)
      .endScope(20, 0)
      .endScope(30, 0).endSource().build();

    assertThrows(() => encode(info));
  });

  it("throws when a scopes' end precedes the scopes' start", () => {
    const info = builder.startSource().startScope(10, 0).endScope(0, 0)
      .endSource().build();

    assertThrows(() => encode(info));
  });

  it("throws when a child range' start is not nested properly within its parent", () => {
    const info = builder.startRange(10, 0).startRange(0, 0).endRange(20, 0)
      .endRange(30, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a ranges' end precedes the ranges' start", () => {
    const info = builder.startRange(10, 0).endRange(0, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a ranges' definition scope is not known to the encoder", () => {
    const scope = builder.startSource().startScope(0, 0).endScope(10, 0)
      .endSource().lastScope()!;
    const info = builder.startRange(0, 10).endRange(0, 20).build();

    // Set the range's definition as a copy of `scope`.
    info.ranges[0].originalScope = { ...scope };

    assertThrows(() => encode(info));
  });

  it("throws when a range has bindings but no definition scope", () => {
    const info = builder.startRange(0, 0, { values: ["a", null] }).endRange(
      0,
      10,
    ).build();

    assertThrows(() => encode(info));
  });

  it("throws when range bindings don't match with scope variables", () => {
    const info = builder.startSource().startScope(0, 0, {
      key: "key",
      variables: ["foo", "bar"],
    }).endScope(10, 0).endSource().startRange(0, 0, {
      scopeKey: "key",
      values: ["a", null, "b"],
    }).endRange(0, 10).build();

    assertThrows(() => encode(info));
  });

  it("throws when sub-range bindings are not sorted", () => {
    const info = builder.startSource().startScope(0, 0, {
      key: "key",
      variables: ["a"],
    })
      .endScope(10, 0).endSource().startRange(0, 0, {
        scopeKey: "key",
        values: [[{
          from: { line: 5, column: 0 },
          to: { line: 10, column: 0 },
        }, {
          from: { line: 0, column: 0 },
          to: { line: 5, column: 0 },
        }]],
      }).endRange(10, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when sub-range bindings have a gap", () => {
    const info = builder.startSource().startScope(0, 0, {
      key: "key",
      variables: ["a"],
    })
      .endScope(10, 0).endSource().startRange(0, 0, {
        scopeKey: "key",
        values: [[{
          from: { line: 0, column: 0 },
          to: { line: 4, column: 0 },
        }, {
          from: { line: 5, column: 0 },
          to: { line: 10, column: 0 },
        }]],
      }).endRange(10, 0).build();

    assertThrows(() => encode(info));
  });
});
