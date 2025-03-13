// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Simple roundtrip tests that encode a `ScopesInfo`, decode it, and
 * check that the same `ScopesInfo` falls out.
 */

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import type { ScopeInfo } from "./scopes.d.ts";
import { encode } from "./encode/encode.ts";
import { decode } from "./decode/decode.ts";
import { assertEquals } from "jsr:@std/assert";
import { ScopeInfoBuilder } from "./builder/builder.ts";

function assertCodec(scopesInfo: ScopeInfo): void {
  assertEquals(decode(encode(scopesInfo)), scopesInfo);
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
});
