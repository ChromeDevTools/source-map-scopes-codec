// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { ScopeInfoBuilder } from "./builder.ts";
import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

describe("ScopeInfoBuilder", () => {
  let builder: ScopeInfoBuilder;

  beforeEach(() => {
    builder = new ScopeInfoBuilder();
  });

  it("adds null OriginalScopes", () => {
    const info = builder.addNullScope().addNullScope().build();

    assertEquals(info.scopes, [null, null]);
  });

  it("builds simple OriginalScopes", () => {
    const info = builder.startScope(0, 0).endScope(5, 10).build();

    assertEquals(info.scopes[0]?.start, { line: 0, column: 0 });
    assertEquals(info.scopes[0]?.end, { line: 5, column: 10 });
  });

  it("builds a simple nested OriginalScope", () => {
    const info = builder.startScope(0, 0).startScope(5, 0).endScope(10, 0)
      .endScope(15, 0).build();

    assertStrictEquals(info.scopes[0]?.children.length, 1);
    assertEquals(info.scopes[0].children[0].start, { line: 5, column: 0 });
    assertEquals(info.scopes[0].children[0].end, { line: 10, column: 0 });
  });

  it("can set the name via option", () => {
    const info = builder.startScope(0, 0, { name: "foo" }).endScope(5, 0)
      .build();

    assertStrictEquals(info.scopes[0]?.name, "foo");
  });

  describe("setScopeName", () => {
    it("sets the name", () => {
      const info = builder.startScope(0, 0).setScopeName("foo").endScope(5, 0)
        .build();

      assertStrictEquals(info.scopes[0]?.name, "foo");
    });

    it("does nothing when no scope is open", () => {
      builder.setScopeName("ignored");
    });
  });
});
