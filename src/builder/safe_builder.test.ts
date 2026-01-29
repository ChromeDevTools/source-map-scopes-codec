// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { beforeEach, describe, it } from "@std/testing/bdd";
import { SafeScopeInfoBuilder } from "./safe_builder.ts";
import { assertThrows } from "@std/assert";

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

  describe("setScopeStackFrame", () => {
    it("throws when no scope is on open", () => {
      assertThrows(() => builder.setScopeStackFrame(true));
    });

    it("throws while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setScopeStackFrame(true));
    });
  });

  describe("setScopeVariables", () => {
    it("throws when no scope is on open", () => {
      assertThrows(() => builder.setScopeVariables(["foo"]));
    });

    it("throws while building a range", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setScopeVariables(["foo"]));
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

    it("throws when the definition scope doesn't point to a valid scope", () => {
      assertThrows(() => builder.startRange(0, 0, { scopeKey: 0 }));
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

    it("throws when 'values' is provided without a scope", () => {
      assertThrows(() => builder.startRange(0, 0, { values: ["a", null] }));
    });

    it("throws when 'values' length does not match OriginalScope.variables length (via scope)", () => {
      const scope = builder.startScope(0, 0, { variables: ["foo", "bar"] })
        .endScope(10, 0).lastScope()!;

      assertThrows(() =>
        builder.startRange(0, 0, { scope, values: ["a", null, "b"] })
      );
    });

    it("throws when 'values' length does not match OriginalScope.variables length (via scopeKey)", () => {
      builder.startScope(0, 0, { variables: ["foo", "bar"], key: "my key" })
        .endScope(10, 0);

      assertThrows(() =>
        builder.startRange(0, 0, {
          scopeKey: "my key",
          values: ["a", null, "b"],
        })
      );
    });
  });

  describe("setRangeDefinitionScope", () => {
    it("throws when no range is open", () => {
      const scope = builder.startScope(0, 0).endScope(10, 0).lastScope()!;

      assertThrows(() => builder.setRangeDefinitionScope(scope));
    });

    it("throws while building a scope", () => {
      const scope = builder.startScope(0, 0).currentScope()!;

      assertThrows(() => builder.setRangeDefinitionScope(scope));
    });

    it("throws when the definition scope is not known to the builder", () => {
      assertThrows(() =>
        builder.startRange(0, 0).setRangeDefinitionScope({
          start: { line: 0, column: 0 },
          end: { line: 10, column: 10 },
          isStackFrame: false,
          variables: [],
          children: [],
        })
      );
    });
  });

  describe("setRangeDefinitionScopeKey", () => {
    it("throws when no range is open", () => {
      assertThrows(() => builder.setRangeDefinitionScopeKey("my key"));
    });

    it("throws while building a scope", () => {
      builder.startScope(0, 0, { key: "my key" });

      assertThrows(() => builder.setRangeDefinitionScopeKey("my key"));
    });

    it("throws when the definition scope is not known to the builder", () => {
      assertThrows(() =>
        builder.startRange(0, 0).setRangeDefinitionScope({
          start: { line: 0, column: 0 },
          end: { line: 10, column: 10 },
          isStackFrame: false,
          variables: [],
          children: [],
        })
      );
    });
  });

  describe("setRangeStackFrame", () => {
    it("throws when no range is on open", () => {
      assertThrows(() => builder.setRangeStackFrame(true));
    });

    it("throws while building a scope", () => {
      builder.startScope(0, 0);

      assertThrows(() => builder.setRangeStackFrame(true));
    });
  });

  describe("setRangeHidden", () => {
    it("throws when no range is on open", () => {
      assertThrows(() => builder.setRangeHidden(true));
    });

    it("throws while building a scope", () => {
      builder.startScope(0, 0);

      assertThrows(() => builder.setRangeHidden(true));
    });
  });

  describe("setRangeValues", () => {
    it("throws when no range is on open", () => {
      assertThrows(() => builder.setRangeValues(["a", null]));
    });

    it("throws while building a scope", () => {
      builder.startScope(0, 0);

      assertThrows(() => builder.setRangeValues(["a", null]));
    });

    it("throws when called without setting a scope prior", () => {
      builder.startRange(0, 0);

      assertThrows(() => builder.setRangeValues(["a", null]));
    });

    it("throws when 'values' length does not match OriginalScope.variables length (via scope)", () => {
      const scope = builder.startScope(0, 0, { variables: ["foo", "bar"] })
        .endScope(10, 0).lastScope()!;
      builder.startRange(0, 0, { scope });

      assertThrows(() => builder.setRangeValues(["a", null, "b"]));
    });
  });

  describe("setRangeCallSite", () => {
    it("throws when no range is on open", () => {
      assertThrows(() =>
        builder.setRangeCallSite({
          line: 10,
          column: 20,
          sourceIndex: 0,
        })
      );
    });

    it("throws while building a scope", () => {
      builder.startScope(0, 0);

      assertThrows(() =>
        builder.setRangeCallSite({
          line: 10,
          column: 20,
          sourceIndex: 0,
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

    describe("sub-range bindings", () => {
      beforeEach(() => {
        builder.startScope(0, 0, { key: "test-scope", variables: ["foo"] })
          .endScope(20, 0);
      });

      it("allows empty sub-range bindings", () => {
        builder.startRange(0, 0, { scopeKey: "test-scope", values: [[]] })
          .endRange(10, 0);
      });

      it("allows single item sub-range bindings", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 0, column: 0 },
            to: { line: 10, column: 0 },
          }]],
        })
          .endRange(10, 0);
      });

      it("allows multi-item sub-range bindings", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 0, column: 0 },
            to: { line: 5, column: 0 },
          }, {
            value: "b",
            from: { line: 5, column: 0 },
            to: { line: 10, column: 0 },
          }]],
        })
          .endRange(10, 0);
      });

      it("throws if the first sub-range does not start at the range start", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 1, column: 0 },
            to: { line: 10, column: 0 },
          }]],
        });

        assertThrows(() => builder.endRange(10, 0));
      });

      it("throws if the last sub-range does not end at the range end", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 0, column: 0 },
            to: { line: 8, column: 0 },
          }]],
        });

        assertThrows(() => builder.endRange(10, 0));
      });

      it("throws if sub-ranges are not sorted", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 5, column: 0 },
            to: { line: 10, column: 0 },
          }, {
            value: "b",
            from: { line: 0, column: 0 },
            to: { line: 5, column: 0 },
          }]],
        });

        assertThrows(() => builder.endRange(10, 0));
      });

      it("throws if sub-ranges have a gap", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 0, column: 0 },
            to: { line: 4, column: 0 },
          }, {
            value: "b",
            from: { line: 5, column: 0 },
            to: { line: 10, column: 0 },
          }]],
        });

        assertThrows(() => builder.endRange(10, 0));
      });

      it("throws if a sub-range 'from' does not precede 'to'", () => {
        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 5, column: 0 },
            to: { line: 5, column: 0 },
          }]],
        });
        assertThrows(() => builder.endRange(10, 0));

        builder.startRange(0, 0, {
          scopeKey: "test-scope",
          values: [[{
            value: "a",
            from: { line: 6, column: 0 },
            to: { line: 5, column: 0 },
          }]],
        });
        assertThrows(() => builder.endRange(10, 0));
      });
    });
  });
});
