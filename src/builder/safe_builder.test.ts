// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { SafeScopeInfoBuilder } from "./safe_builder.ts";
import { assert, assertThrows } from "jsr:@std/assert";

describe("SafeScopeInfoBuilder", () => {
  let builder: SafeScopeInfoBuilder;

  beforeEach(() => {
    builder = new SafeScopeInfoBuilder();
  });

  it("throws when trying to build the info without closing OriginalScopes", () => {
    builder.startScope(0, 0);

    assertThrows(() => builder.build());
  });

  it("throws when trying to build the info without closing GeneratedRanges", () => {
    builder.startRange(0, 0);

    assertThrows(() => builder.build());
  });

  it("throws when trying to add a null scope with open OriginalScopes", () => {
    builder.startScope(0, 0);

    assertThrows(() => builder.addNullScope());
  });

  it("throws when trying t add a null scope with open GeneratedRanges", () => {
    builder.startRange(0, 0);

    assertThrows(() => builder.addNullScope());
  });

  describe("startScope", () => {
    it("throws when trying to start a scope while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.startScope(0, 0));
    });

    it("throws when trying to start a scope that precedes the current scope", () => {
      builder.startScope(10, 0);

      assertThrows(() => builder.startScope(5, 0));
    });

    it("throws when trying to start a scope that overlaps with the preceding sibling scope", () => {
      builder.startScope(0, 0).startScope(5, 0).endScope(10, 0);

      assertThrows(() => builder.startScope(7, 0));
    });

    it("allows starting a scope on the preceding scope' end", () => {
      builder.startScope(0, 0).endScope(10, 5);

      builder.startScope(10, 5);
    });
  });

  describe("setScopeName", () => {
    it("throws when no scope is on open", () => {
      assertThrows(() => builder.setScopeName("foo"));
    });

    it("throws while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setScopeName("foo"));
    });
  });

  describe("setScopeKind", () => {
    it("throws when no scope is on open", () => {
      assertThrows(() => builder.setScopeKind("Global"));
    });

    it("throws while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setScopeKind("Global"));
    });
  });

  describe("setStackFrame", () => {
    it("throws when no scope is on open", () => {
      assertThrows(() => builder.setStackFrame(true));
    });

    it("throws while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setStackFrame(true));
    });
  });

  describe("endScope", () => {
    it("throws when the scope stack is empty", () => {
      assertThrows(() => builder.endScope(5, 0));
    });

    it("allows scopes with zero length", () => {
      builder.startScope(10, 0);

      builder.endScope(10, 0);
    });

    it("throws when scope end precedes scope start", () => {
      builder.startScope(10, 0);

      assertThrows(() => builder.endScope(5, 0));
    });
  });

  describe("startRange", () => {
    it("throws when trying to start a range while building a scope", () => {
      builder.startScope(0, 0);

      assertThrows(() => builder.startRange(0, 0));
    });

    it("throws when trying to start a range that precedes its' parent", () => {
      builder.startRange(10, 0);

      assertThrows(() => builder.startRange(5, 0));
    });

    it("throws when trying to start a range that overlaps with the preceding sibling range", () => {
      builder.startRange(0, 0).startRange(5, 0).endRange(10, 0);

      assertThrows(() => builder.startRange(7, 0));
    });

    it("allows starting a range on the preceding range' end", () => {
      builder.startRange(0, 0).endRange(10, 5);

      builder.startRange(10, 5);
    });

    it("throws when the definition scope doesnt point to a valid scope", () => {
      assertThrows(() => builder.startRange(0, 0, { scope: 0 }));
    });

    it("throws when the definition scope is not known to the builder", () => {
      assertThrows(() =>
        builder.startRange(0, 0, {
          scope: {
            start: { line: 0, column: 0 },
            end: { line: 10, column: 10 },
            isStackFrame: false,
            variables: [],
            children: [],
          },
        })
      );
    });
  });

  describe("endRange", () => {
    it("throws when the range stack is empty", () => {
      assertThrows(() => builder.endRange(5, 0));
    });

    it("allows range with zero length", () => {
      builder.startRange(10, 0);

      builder.endRange(10, 0);
    });

    it("throws when range end precedes range start", () => {
      builder.startRange(10, 0);

      assertThrows(() => builder.endRange(5, 0));
    });
  });
});
