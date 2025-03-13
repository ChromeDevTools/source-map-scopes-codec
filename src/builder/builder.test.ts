// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { ScopeInfoBuilder } from "./builder.ts";
import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "jsr:@std/assert";

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

    assertStrictEquals(info.scopes[0], info.scopes[0].children[0].parent);
  });

  it("can set the name via option", () => {
    const info = builder.startScope(0, 0, { name: "foo" }).endScope(5, 0)
      .build();

    assertStrictEquals(info.scopes[0]?.name, "foo");
  });

  it("can set kind via option", () => {
    const info = builder.startScope(0, 0, { kind: "Global" }).endScope(10, 0)
      .build();

    assertStrictEquals(info.scopes[0]?.kind, "Global");
  });

  it("can set isStackFrame via option", () => {
    const info = builder.startScope(0, 0, { isStackFrame: true }).endScope(
      10,
      0,
    ).build();

    assertStrictEquals(info.scopes[0]?.isStackFrame, true);
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

  describe("setScopeKind", () => {
    it("sets the kind", () => {
      const info = builder.startScope(0, 0).setScopeKind("Global").endScope(
        20,
        0,
      ).build();

      assertStrictEquals(info.scopes[0]?.kind, "Global");
    });

    it("does nothing when no scope is open", () => {
      builder.setScopeKind("Function");
    });
  });

  describe("setScopeStackFrame", () => {
    it("sets the isStackFrame flag", () => {
      const info = builder.startScope(0, 0).setScopeStackFrame(true).endScope(
        10,
        0,
      )
        .build();

      assertStrictEquals(info.scopes[0]?.isStackFrame, true);
    });
  });

  describe("endScope", () => {
    it("does nothing when no scope is open", () => {
      builder.endScope(10, 0);
    });
  });

  it("builds a simple generated range", () => {
    const info = builder.startRange(0, 0).endRange(0, 20).build();

    assertEquals(info.ranges[0]?.start, { line: 0, column: 0 });
    assertEquals(info.ranges[0]?.end, { line: 0, column: 20 });
  });

  it("builds a simple nested range", () => {
    const info = builder.startRange(0, 0).startRange(5, 0).endRange(10, 0)
      .endRange(15, 0).build();

    assertStrictEquals(info.ranges[0]?.children.length, 1);
    assertEquals(info.ranges[0].children[0].start, { line: 5, column: 0 });
    assertEquals(info.ranges[0].children[0].end, { line: 10, column: 0 });

    assertStrictEquals(info.ranges[0], info.ranges[0].children[0].parent);
  });

  describe("startRange", () => {
    it("sets the definition scope when it's provided as a number", () => {
      const info = builder.startScope(0, 0).endScope(10, 0).startRange(0, 0, {
        scope: 0,
      }).endRange(0, 10).build();

      assertStrictEquals(info.scopes[0], info.ranges[0].originalScope);
    });

    it("sets the definition scope when it's provided directly", () => {
      const scope = builder.startScope(0, 0).endScope(10, 0).lastScope();
      const info = builder.startRange(0, 0, { scope: scope! }).endRange(0, 10)
        .build();

      assertStrictEquals(info.scopes[0], info.ranges[0].originalScope);
      assertStrictEquals(info.ranges[0].originalScope, scope);
    });

    it("can set isStackFrame via option", () => {
      const info = builder.startRange(0, 0, { isStackFrame: true }).endRange(
        10,
        0,
      ).build();

      assertStrictEquals(info.ranges[0]?.isStackFrame, true);
    });
  });

  describe("setRangeDefinitionScope", () => {
    it("sets the definition scope when it's provided as a number", () => {
      const info = builder.startScope(0, 0).endScope(10, 0).startRange(0, 0)
        .setRangeDefinitionScope(0).endRange(0, 10).build();

      assertStrictEquals(info.scopes[0], info.ranges[0].originalScope);
    });

    it("sets the definition scope when it's provided directly", () => {
      const scope = builder.startScope(0, 0).endScope(10, 0).lastScope();
      const info = builder.startRange(0, 0).setRangeDefinitionScope(scope!)
        .endRange(0, 10).build();

      assertStrictEquals(info.scopes[0], info.ranges[0].originalScope);
      assertStrictEquals(info.ranges[0].originalScope, scope);
    });
  });

  describe("setRangeStackFrame", () => {
    it("sets the isStackFrame flag", () => {
      const info = builder.startRange(0, 0).setRangeStackFrame(true).endRange(
        10,
        0,
      )
        .build();

      assertStrictEquals(info.ranges[0]?.isStackFrame, true);
    });
  });

  describe("endRange", () => {
    it("does nothing when no range is open", () => {
      builder.endRange(0, 20);
    });
  });

  describe("currentScope", () => {
    it("returns 'null' when no scope is on the stack", () => {
      assertStrictEquals(builder.currentScope(), null);
    });

    it("returns the currently open scope (top-level)", () => {
      builder.startScope(0, 0);

      assertNotStrictEquals(builder.currentScope(), null);
    });

    it("returns the currently open scope (nested)", () => {
      builder.startScope(0, 0).startScope(10, 0);

      assertEquals(builder.currentScope()?.start, { line: 10, column: 0 });
    });
  });

  describe("lastScope", () => {
    it("returns 'null' when no scope was closed yet", () => {
      assertStrictEquals(builder.lastScope(), null);
    });

    it("returns the last closed scope (top-level)", () => {
      builder.startScope(0, 0).endScope(10, 0);

      assertNotStrictEquals(builder.lastScope(), null);
    });

    it("returns the last closed scope (nested)", () => {
      builder.startScope(0, 0).startScope(10, 0).endScope(20, 0);

      assertEquals(builder.lastScope()?.start, { line: 10, column: 0 });
    });

    it("returns the last closed scope after starting new ones", () => {
      builder.startScope(0, 0).startScope(10, 0).endScope(20, 0).startScope(
        30,
        0,
      );

      assertEquals(builder.lastScope()?.start, { line: 10, column: 0 });
    });
  });
});
