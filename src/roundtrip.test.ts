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
});
