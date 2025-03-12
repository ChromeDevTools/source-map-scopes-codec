// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { OriginalScope, ScopeInfo } from "../scopes.d.ts";
import { comparePositions } from "../util.ts";
import { ScopeInfoBuilder } from "./builder.ts";

/**
 * Similar to `ScopeInfoBuilder`, but with checks that scopes/ranges are well
 * nested and don't partially overlap.
 */
export class SafeScopeInfoBuilder extends ScopeInfoBuilder {
  override startScope(line: number, column: number): this {
    this.#verifyEmptyRangeStack("start scope");

    const parent = this.scopeStack.at(-1);

    if (parent && comparePositions(parent.start, { line, column }) > 0) {
      throw new Error(
        `Scope start (${line}, ${column}) must not precede parent start (${parent.start.line}, ${parent.start.column})`,
      );
    }

    const precedingSibling = parent?.children.at(-1);
    if (
      precedingSibling &&
      comparePositions(precedingSibling.end, { line, column }) > 0
    ) {
      throw new Error(
        `Scope start (${line}, ${column}) must not precede preceding siblings' end (${precedingSibling
          .end.line,
          precedingSibling.end.column})`,
      );
    }

    super.startScope(line, column);
    return this;
  }

  override endScope(line: number, column: number): this {
    this.#verifyEmptyRangeStack("end scope");

    if (this.scopeStack.length === 0) {
      throw new Error("No scope to end");
    }

    const scope = this.scopeStack.at(-1) as OriginalScope;
    if (comparePositions(scope.start, { line, column }) > 0) {
      throw new Error(
        `Scope end (${line}, ${column}) must not precede or be on scope start (${scope.start.line}, ${scope.start.column})`,
      );
    }

    super.endScope(line, column);
    return this;
  }

  override startRange(line: number, column: number): this {
    this.#verifyEmptyScopeStack("start range");

    super.startRange(line, column);
    return this;
  }

  override build(): ScopeInfo {
    if (this.scopeStack.length > 0) {
      throw new Error(
        "Can't build ScopeInfo while an OriginalScope is unclosed.",
      );
    }
    this.#verifyEmptyRangeStack("build ScopeInfo");

    return super.build();
  }

  #verifyEmptyScopeStack(op: string): void {
    if (this.scopeStack.length > 0) {
      throw new Error(`Can't ${op} while a OriginalScope is unclosed.`);
    }
  }

  #verifyEmptyRangeStack(op: string): void {
    if (this.rangeStack.length > 0) {
      throw new Error(`Can't ${op} while a GeneratedRange is unclosed.`);
    }
  }
}
