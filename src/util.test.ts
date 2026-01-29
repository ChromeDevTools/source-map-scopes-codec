// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { assertGreater, assertLess, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { comparePositions } from "./util.ts";

describe("comparePositions", () => {
  it("returns a negative number if a precedes b", () => {
    assertLess(
      comparePositions({ line: 5, column: 10 }, { line: 10, column: 0 }),
      0,
    );
    assertLess(
      comparePositions({ line: 5, column: 10 }, { line: 5, column: 20 }),
      0,
    );
  });

  it("returns 0 if a and be are equal", () => {
    assertStrictEquals(
      comparePositions({ line: 5, column: 0 }, { line: 5, column: 0 }),
      0,
    );
    assertStrictEquals(
      comparePositions({ line: 5, column: 2 }, { line: 5, column: 2 }),
      0,
    );
  });

  it("returns a positive number if b precedes a", () => {
    assertGreater(
      comparePositions({ line: 10, column: 0 }, { line: 5, column: 10 }),
      0,
    );
    assertGreater(
      comparePositions({ line: 5, column: 20 }, { line: 5, column: 10 }),
      0,
    );
  });
});
