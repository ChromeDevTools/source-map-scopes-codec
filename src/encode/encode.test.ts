// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import type { ScopeInfo, SourceMapJson } from "../scopes.d.ts";
import { assertStrictEquals, assertThrows } from "jsr:@std/assert";
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

  it("encodes null OriginalScopes correctly", () => {
    const info = builder.addNullScope().addNullScope().addNullScope().build();

    assertStrictEquals(encode(info).scopes, ",,");
  });

  it("throws when a child scope' start is not nested properly within its parent", () => {
    const info = builder.startScope(10, 0).startScope(0, 0).endScope(20, 0)
      .endScope(30, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a scopes' end precedes the scopes' start", () => {
    const info = builder.startScope(10, 0).endScope(0, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a child range' start is not nested propertly within its parent", () => {
    const info = builder.startRange(10, 0).startRange(0, 0).endRange(20, 0)
      .endRange(30, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a ranges' end precedes the ranges' start", () => {
    const info = builder.startRange(10, 0).endRange(0, 0).build();

    assertThrows(() => encode(info));
  });

  it("throws when a ranges' definition scope has not known to the encoder", () => {
    const scope = builder.startScope(0, 0).endScope(10, 0).lastScope()!;
    const info = builder.startRange(0, 10).endRange(0, 20).build();

    // Set the range's definition as a copy of `scope`.
    info.ranges[0].originalScope = { ...scope };

    assertThrows(() => encode(info));
  });
});
