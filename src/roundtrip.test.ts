// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Simple roundtrip tests that encode a `ScopesInfo`, decode it, and
 * check that the same `ScopesInfo` falls out.
 */

import { beforeEach, describe, it } from "@std/testing/bdd";
import type { ScopeInfo } from "./scopes.ts";
import { encode } from "./encode/encode.ts";
import { decode } from "./decode/decode.ts";
import { assertEquals } from "@std/assert";
import { ScopeInfoBuilder } from "./builder/builder.ts";

function assertCodec(scopesInfo: ScopeInfo): void {
  const { scopes, ranges } = decode(encode(scopesInfo));
  assertEquals({ scopes, ranges }, scopesInfo);
}

describe("round trip", () => {
  let builder: ScopeInfoBuilder;

  beforeEach(() => {
    builder = new ScopeInfoBuilder();
  });

  it("handles null OriginalScopes", () => {
    builder.addNullScope().addNullScope().addNullScope();

    assertCodec(builder.build());
  });

  it("handles a single top-level OriginalScope", () => {
    builder.startScope(0, 0).endScope(10, 1);

    assertCodec(builder.build());
  });

  it("handles two simple top-level OriginalScopes", () => {
    builder.startScope(0, 0).endScope(10, 1);
    builder.startScope(0, 0).endScope(15, 1);

    assertCodec(builder.build());
  });

  it("handles a simple nested OriginalScope", () => {
    builder.startScope(0, 0).startScope(5, 1).endScope(10, 1).endScope(15, 0);

    assertCodec(builder.build());
  });

  it("handles multiple children of a top-level scope", () => {
    builder.startScope(0, 0).startScope(5, 1).endScope(10, 1).startScope(15, 0)
      .endScope(20, 0).endScope(25, 1);

    assertCodec(builder.build());
  });

  it("handles scopes that start on the same line", () => {
    builder.startScope(0, 5).startScope(0, 10).endScope(10, 5).endScope(10, 10);

    assertCodec(builder.build());
  });

  it("handles scope names", () => {
    builder.startScope(0, 0, { name: "foo" }).startScope(10, 0, { name: "bar" })
      .endScope(20, 0).endScope(30, 0);

    assertCodec(builder.build());
  });

  it("handles scope kinds", () => {
    builder.startScope(0, 0, { kind: "Global" }).startScope(10, 0, {
      kind: "Function",
    }).endScope(20, 0).endScope(30, 0);

    assertCodec(builder.build());
  });

  it("handles names/kinds across multiple top-level scopes", () => {
    builder.startScope(0, 0, { kind: "Global" }).startScope(10, 5, {
      kind: "Function",
      name: "foo",
    })
      .endScope(20, 0).endScope(30, 0);
    builder.startScope(0, 0, { kind: "Global" }).startScope(10, 5, {
      kind: "Function",
      name: "bar",
    })
      .endScope(20, 0).endScope(30, 0);

    assertCodec(builder.build());
  });

  it("handles isStackFrame flag on scopes", () => {
    builder.startScope(0, 0, { isStackFrame: true }).endScope(10, 0);

    assertCodec(builder.build());
  });

  it("handles a single top-level GeneratedRange on the same line", () => {
    builder.startRange(0, 5).endRange(0, 10);

    assertCodec(builder.build());
  });

  it("handles a single top-level GeneratedRange that spans multiple lines", () => {
    builder.startRange(0, 5).endRange(10, 2);

    assertCodec(builder.build());
  });

  it("handles multiple top-level GeneratedRagnes on the same line", () => {
    builder.startRange(0, 5).endRange(0, 10).startRange(0, 20).endRange(0, 30);

    assertCodec(builder.build());
  });

  it("handles multiple top-level GeneratedRanges that span multiple lines", () => {
    builder.startRange(0, 1).endRange(10, 2).startRange(20, 3).endRange(30, 4);

    assertCodec(builder.build());
  });

  it("handles a single GeneratedRange with a definition scope", () => {
    builder.startScope(0, 0, { key: 0 }).endScope(10, 0).startRange(0, 0, {
      scopeKey: 0,
    })
      .endRange(0, 10);

    assertCodec(builder.build());
  });

  it("handles multiple GeneratedRanges with different definition scopes", () => {
    builder.startScope(0, 0, { key: 0 }).endScope(10, 0).startScope(0, 0, {
      key: 1,
    }).endScope(20, 0)
      .startRange(0, 0)
      .startRange(0, 10, { scopeKey: 0 })
      .endRange(0, 40)
      .startRange(0, 50, { scopeKey: 1 })
      .endRange(0, 80)
      .endRange(0, 100);

    assertCodec(builder.build());
  });

  it("handles the isStackFrame flag on GeneratedRanges", () => {
    builder.startRange(0, 0, { isStackFrame: true }).endRange(0, 10);

    assertCodec(builder.build());
  });

  it("handles the isHidden flag on GeneratedRanges", () => {
    builder.startRange(0, 0, { isHidden: true }).endRange(0, 10);

    assertCodec(builder.build());
  });

  it("handles OriginalScope variables", () => {
    builder.startScope(0, 0, { variables: ["foo", "bar"] }).startScope(10, 0, {
      variables: ["local1", "local2"],
    }).endScope(20, 0).endScope(30, 0);

    assertCodec(builder.build());
  });

  it("handles value bindings expressions", () => {
    builder.startScope(0, 0, { variables: ["foo", "bar"], key: "outer" })
      .startScope(10, 0, { variables: ["local1", "local2"], key: "inner" })
      .endScope(20, 0).endScope(30, 0)
      .startRange(0, 0, { scopeKey: "outer", values: ["f", "b"] }).startRange(
        0,
        10,
        { scopeKey: "inner", values: [null, "g"] },
      ).endRange(0, 20).endRange(0, 30);

    assertCodec(builder.build());
  });

  it("handles callSites for inlined ranges", () => {
    builder.startScope(0, 0, { key: "global" }).startScope(10, 0, {
      key: "function",
    }).endScope(20, 0).endScope(30, 0)
      .startRange(0, 0, { scopeKey: "global" })
      .startRange(0, 10, {
        scopeKey: "function",
        callSite: { sourceIndex: 0, line: 30, column: 5 },
      })
      .endRange(0, 20)
      .startRange(0, 30, {
        scopeKey: "function",
        callSite: { sourceIndex: 0, line: 30, column: 20 },
      })
      .endRange(0, 40)
      .startRange(0, 50, {
        scopeKey: "function",
        callSite: { sourceIndex: 0, line: 40, column: 2 },
      })
      .endRange(0, 60)
      .endRange(0, 70);

    assertCodec(builder.build());
  });

  it("handles sub-range bindings", () => {
    builder.startScope(0, 0, {
      key: "scope",
      variables: ["v1", "v2", "v3", "v4"],
    }).endScope(10, 0);

    builder.startRange(0, 0, {
      scopeKey: "scope",
      values: [
        // v1: no sub-ranges
        "v1_expr",
        // v2: one sub-range transition
        [
          {
            from: { line: 0, column: 0 },
            to: { line: 5, column: 0 },
            value: "v2_initial_expr",
          },
          {
            from: { line: 5, column: 0 },
            to: { line: 10, column: 0 },
            value: "v2_final_expr",
          },
        ],
        // v3: multiple sub-range transitions
        [
          {
            from: { line: 0, column: 0 },
            to: { line: 2, column: 0 },
            value: "v3_expr1",
          },
          {
            from: { line: 2, column: 0 },
            to: { line: 6, column: 0 },
            value: "v3_expr2",
          },
          {
            from: { line: 6, column: 0 },
            to: { line: 10, column: 0 },
            value: "v3_expr3",
          },
        ],
        // v4: multiple sub-ranges with unavailable parts
        [
          {
            from: { line: 0, column: 0 },
            to: { line: 3, column: 0 },
            value: "v4_expr1",
          },
          {
            from: { line: 3, column: 0 },
            to: { line: 7, column: 0 },
            value: undefined, // unavailable
          },
          {
            from: { line: 7, column: 0 },
            to: { line: 10, column: 0 },
            value: "v4_expr2",
          },
        ],
      ],
    }).endRange(10, 0);

    assertCodec(builder.build());
  });

  // Regression test for issue #1.
  it("handles sub-ranges correctly when the range has children", () => {
    builder.startScope(0, 0, { variables: ["x"], key: "root" }).endScope(1, 19)
      .startRange(0, 0, {
        scopeKey: "root",
        values: [[{
          from: { line: 0, column: 0 },
          to: { line: 1, column: 0 },
          value: '"foo"',
        }, {
          from: { line: 1, column: 0 },
          to: { line: 1, column: 19 },
          value: '"bar"',
        }]],
      }).startRange(0, 5)
      .endRange(0, 10).endRange(1, 19);

    assertCodec(builder.build());
  });
});
