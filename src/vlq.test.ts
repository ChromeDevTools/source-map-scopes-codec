// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { describe, it } from "jsr:@std/testing/bdd";
import { TokenIterator } from "./vlq.ts";
import { assertFalse, assertStrictEquals } from "jsr:@std/assert";

describe("TokenIterator", () => {
  describe("nextUnsignedVLQ", () => {
    it("handles multi-digit numbers", () => {
      const iter = new TokenIterator("hB");

      assertStrictEquals(iter.nextUnsignedVLQ(), 33);
      assertFalse(iter.hasNext());
    });

    it("returns zero when no more characters are available", () => {
      const iter = new TokenIterator("");
      assertFalse(iter.hasNext());

      assertStrictEquals(iter.nextUnsignedVLQ(), 0);
    });

    it("treats unknown characters as 0", () => {
      const iter = new TokenIterator("h,C"); // 'h' has the continuation bit set. ',' is treated as 0 so we stop decoding.

      assertStrictEquals(iter.nextUnsignedVLQ(), 1);
      assertStrictEquals(iter.peek(), "C");
    });

    it("treats unknown unicode characters as 0", () => {
      const iter = new TokenIterator("hæC"); // 'h' has the continuation bit set. 'æ' falls outside the array so has 'undefined as its digit value.

      assertStrictEquals(iter.nextUnsignedVLQ(), 1);
      assertStrictEquals(iter.peek(), "C");
    });
  });

  describe("nextSignedVLQ", () => {
    it("returns zero when no more characters are available", () => {
      const iter = new TokenIterator("");
      assertFalse(iter.hasNext());

      assertStrictEquals(iter.nextSignedVLQ(), 0);
    });

    it("treats unknown characters as 0", () => {
      const iter = new TokenIterator("i,C"); // 'i' has the continuation bit set. ',' is treated as 0 so we stop decoding.

      assertStrictEquals(iter.nextSignedVLQ(), 1);
      assertStrictEquals(iter.peek(), "C");
    });

    it("treats unknown unicode characters as 0", () => {
      const iter = new TokenIterator("iæC"); // 'i' has the continuation bit set. 'æ' falls outside the array so has 'undefined as its digit value.

      assertStrictEquals(iter.nextSignedVLQ(), 1);
      assertStrictEquals(iter.peek(), "C");
    });
  });

  describe("current", () => {
    it("returns the empty string when calling it without advancing the iterator", () => {
      const iter = new TokenIterator("CCCC");

      assertStrictEquals(iter.currentChar(), "");
    });
  });
});
