// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { describe, it } from "jsr:@std/testing/bdd";
import { ScopeInfoBuilder } from "../builder/builder.ts";
import { encode } from "../encode/encode.ts";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { encodeSigned, encodeUnsigned } from "../vlq.ts";
import { decode } from "./decode.ts";

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
});
