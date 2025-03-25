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

  describe("startScope", () => {
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

    it("can set variables via option", () => {
      const info = builder.startScope(0, 0, { variables: ["a", "b"] }).endScope(
        10,
        0,
      ).build();

      assertEquals(info.scopes[0]?.variables, ["a", "b"]);
    });

    it("copies the variables passed via options", () => {
      const variables = ["a", "b"];
      const info = builder.startScope(0, 0, { variables }).endScope(10, 0)
        .build();
      variables.push("c");

      assertEquals(info.scopes[0]?.variables, ["a", "b"]);
    });
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

  describe("setScopeVariables", () => {
    it("sets variables", () => {
      const info = builder.startScope(0, 0).setScopeVariables(["a", "b"])
        .endScope(10, 0).build();

      assertEquals(info.scopes[0]?.variables, ["a", "b"]);
    });

    it("creates a copy of the variables", () => {
      const variables = ["a", "b"];
      const info = builder.startScope(0, 0).setScopeVariables(variables)
        .endScope(10, 0).build();
      variables.push("c");

      assertEquals(info.scopes[0]?.variables, ["a", "b"]);
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
      const info = builder.startScope(0, 0, { key: 0 }).endScope(10, 0)
        .startRange(0, 0, {
          scopeKey: 0,
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

    it("can set isHidden via option", () => {
      const info = builder.startRange(0, 0, { isHidden: true }).endRange(
        10,
        0,
      ).build();

      assertStrictEquals(info.ranges[0]?.isHidden, true);
    });

    it("can set simple values via option", () => {
      const info = builder.startRange(0, 0, { values: ["a", null, "b"] })
        .endRange(0, 10).build();

      assertEquals(info.ranges[0]?.values, ["a", null, "b"]);
    });

    it("can set the callSite position via option", () => {
      const info = builder.startRange(0, 0, {
        callSite: { line: 10, column: 20, sourceIndex: 0 },
      }).endRange(0, 10).build();

      assertEquals(info.ranges[0].callSite, {
        line: 10,
        column: 20,
        sourceIndex: 0,
      });
    });
  });

  describe("setRangeDefinitionScope", () => {
    it("sets the definition scope when it's provided directly", () => {
      const scope = builder.startScope(0, 0).endScope(10, 0).lastScope()!;
      const info = builder.startRange(0, 0).setRangeDefinitionScope(scope)
        .endRange(0, 10).build();

      assertStrictEquals(info.scopes[0], info.ranges[0].originalScope);
      assertStrictEquals(info.ranges[0].originalScope, scope);
    });

    it("does nothing when no range is on the stack", () => {
      const scope = builder.startScope(0, 0).endScope(10, 0).lastScope()!;
      builder.setRangeDefinitionScope(scope);
    });
  });

  describe("setRangeDefinitionScopeKey", () => {
    it("sets the definition scope when it's provided directly", () => {
      builder.startScope(0, 0, { key: "my key" }).endScope(10, 0);
      const info = builder.startRange(0, 0).setRangeDefinitionScopeKey("my key")
        .endRange(0, 10).build();

      assertStrictEquals(info.ranges[0].originalScope, info.scopes[0]);
    });

    it("does nothing when no range is on the stack", () => {
      builder.setRangeDefinitionScopeKey("foo");
    });
  });

  describe("setRangeStackFrame", () => {
    it("sets the isStackFrame flag", () => {
      const info = builder.startRange(0, 0).setRangeStackFrame(true).endRange(
        10,
        0,
      ).build();

      assertStrictEquals(info.ranges[0]?.isStackFrame, true);
    });
  });

  describe("setRangeHidden", () => {
    it("sets the isHidden flag", () => {
      const info = builder.startRange(0, 0).setRangeHidden(true).endRange(
        10,
        0,
      ).build();

      assertStrictEquals(info.ranges[0]?.isHidden, true);
    });
  });

  describe("setRangeValues", () => {
    it("sets the values", () => {
      const info = builder.startRange(0, 0).setRangeValues(["a", null, null])
        .endRange(0, 10).build();

      assertEquals(info.ranges[0]?.values, ["a", null, null]);
    });

    it("does nothing when no range is on the stack", () => {
      builder.setRangeValues(["a", null, "b"]);
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

  describe("scope key", () => {
    it("can set the scope key via options", () => {
      builder.startScope(0, 0, { key: "my custom key" }).endScope(10, 0);
      builder.startRange(0, 0, { scopeKey: "my custom key" }).endRange(0, 10);
      const info = builder.build();

      assertStrictEquals(info.ranges[0].originalScope, info.scopes[0]);
    });
  });
});
