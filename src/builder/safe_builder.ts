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
  override addNullScope(): this {
    this.#verifyEmptyScopeStack("add null scope");
    this.#verifyEmptyRangeStack("add null scope");

    super.addNullScope();
    return this;
  }

  override startScope(
    line: number,
    column: number,
    options?: {
      name?: string;
      kind?: string;
      isStackFrame?: boolean;
      variables?: string[];
    },
  ): this {
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

    super.startScope(line, column, options);
    return this;
  }

  override setScopeName(name: string): this {
    this.#verifyScopePresent("setScopeName");
    this.#verifyEmptyRangeStack("setScopeName");

    super.setScopeName(name);
    return this;
  }

  override setScopeKind(kind: string): this {
    this.#verifyScopePresent("setScopeKind");
    this.#verifyEmptyRangeStack("setScopeKind");

    super.setScopeKind(kind);
    return this;
  }

  override setScopeStackFrame(isStackFrame: boolean): this {
    this.#verifyScopePresent("setScopeStackFrame");
    this.#verifyEmptyRangeStack("setScopeStackFrame");

    super.setScopeStackFrame(isStackFrame);
    return this;
  }

  override setScopeVariables(variables: string[]): this {
    this.#verifyScopePresent("setScopeVariables");
    this.#verifyEmptyRangeStack("setScopeVariables");

    super.setScopeVariables(variables);
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
        `Scope end (${line}, ${column}) must not precede scope start (${scope.start.line}, ${scope.start.column})`,
      );
    }

    super.endScope(line, column);
    return this;
  }

  override startRange(
    line: number,
    column: number,
    options?: {
      scope?: number | OriginalScope;
      isStackFrame?: boolean;
      isHidden?: boolean;
    },
  ): this {
    this.#verifyEmptyScopeStack("starRange");

    const parent = this.rangeStack.at(-1);
    if (parent && comparePositions(parent.start, { line, column }) > 0) {
      throw new Error(
        `Range start (${line}, ${column}) must not precede parent start (${parent.start.line}, ${parent.start.column})`,
      );
    }

    const precedingSibling = parent?.children.at(-1);
    if (
      precedingSibling &&
      comparePositions(precedingSibling.end, { line, column }) > 0
    ) {
      throw new Error(
        `Range start (${line}, ${column}) must not precede preceding siblings' end (${precedingSibling
          .end.line,
          precedingSibling.end.column})`,
      );
    }

    if (
      typeof options?.scope === "number" &&
      !this.isValidScopeNumber(options.scope)
    ) {
      throw new Error(
        `${options.scope} does not reference a valid OriginalScope`,
      );
    }
    if (
      typeof options?.scope === "object" && !this.isKnownScope(options.scope)
    ) {
      throw new Error(
        "The provided definition scope was not produced by this builder!",
      );
    }

    super.startRange(line, column, options);
    return this;
  }

  override setRangeDefinitionScope(scope: number | OriginalScope): this {
    this.#verifyEmptyScopeStack("setRangeDefinitionScope");
    this.#verifyRangePresent("setRangeDefinitionScope");

    if (
      typeof scope === "number" &&
      !this.isValidScopeNumber(scope)
    ) {
      throw new Error(
        `${scope} does not reference a valid OriginalScope`,
      );
    }
    if (
      typeof scope === "object" && !this.isKnownScope(scope)
    ) {
      throw new Error(
        "The provided definition scope was not produced by this builder!",
      );
    }

    super.setRangeDefinitionScope(scope);
    return this;
  }

  override setRangeStackFrame(isStackFrame: boolean): this {
    this.#verifyEmptyScopeStack("setRangeStackFrame");
    this.#verifyRangePresent("setRangeStackFrame");

    super.setRangeStackFrame(isStackFrame);
    return this;
  }

  override setRangeHidden(isHidden: boolean): this {
    this.#verifyEmptyScopeStack("setRangeHidden");
    this.#verifyRangePresent("setRangeHidden");

    super.setRangeHidden(isHidden);
    return this;
  }

  override endRange(line: number, column: number): this {
    this.#verifyEmptyScopeStack("endRange");

    if (this.rangeStack.length === 0) {
      throw new Error("No range to end");
    }

    const range = this.rangeStack.at(-1)!;
    if (comparePositions(range.start, { line, column }) > 0) {
      throw new Error(
        `Range end (${line}, ${column}) must not precede range start (${range.start.line}, ${range.start.column})`,
      );
    }

    super.endRange(line, column);
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

  #verifyScopePresent(op: string): void {
    if (this.scopeStack.length === 0) {
      throw new Error(`Can't ${op} while no OriginalScope is on the stack.`);
    }
  }

  #verifyRangePresent(op: string): void {
    if (this.rangeStack.length === 0) {
      throw new Error(`Can't ${op} while no GeneratedRange is on the stack.`);
    }
  }
}
