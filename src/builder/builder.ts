// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { GeneratedRange, OriginalScope, ScopeInfo } from "../scopes.d.ts";

/**
 * Small utility class to build scope and range trees.
 *
 * This class allows construction of scope/range trees that will be rejected by the encoder.
 * Use this class if you guarantee proper nesting yourself and don't want to pay for the
 * checks, otherwise use the `SafeScopeInfoBuilder`.
 *
 * This class will also silently ignore calls that would fail otherwise. E.g. calling
 * `end*` without a matching `start*`.
 */
export class ScopeInfoBuilder {
  #scopes: (OriginalScope | null)[] = [];
  #ranges: GeneratedRange[] = [];

  #scopeStack: OriginalScope[] = [];
  #rangeStack: GeneratedRange[] = [];

  #scopeCounter = 0;
  #scopeToCount = new Map<OriginalScope, number>();
  #countToScope = new Map<number, OriginalScope>();
  #lastScope: OriginalScope | null = null;

  addNullScope(): this {
    this.#scopes.push(null);
    return this;
  }

  startScope(
    line: number,
    column: number,
    options?: {
      name?: string;
      kind?: string;
      isStackFrame?: boolean;
      variables?: string[];
    },
  ): this {
    const scope: OriginalScope = {
      start: { line, column },
      end: { line, column },
      variables: options?.variables?.slice(0) ?? [],
      children: [],
      isStackFrame: Boolean(options?.isStackFrame),
    };

    if (options?.name !== undefined) scope.name = options.name;
    if (options?.kind !== undefined) scope.kind = options.kind;

    if (this.#scopeStack.length > 0) {
      scope.parent = this.#scopeStack.at(-1);
    }
    this.#scopeStack.push(scope);
    this.#scopeToCount.set(scope, this.#scopeCounter);
    this.#countToScope.set(this.#scopeCounter++, scope);

    return this;
  }

  setScopeName(name: string): this {
    const scope = this.#scopeStack.at(-1);
    if (scope) scope.name = name;
    return this;
  }

  setScopeKind(kind: string): this {
    const scope = this.#scopeStack.at(-1);
    if (scope) scope.kind = kind;
    return this;
  }

  setScopeStackFrame(isStackFrame: boolean): this {
    const scope = this.#scopeStack.at(-1);
    if (scope) scope.isStackFrame = isStackFrame;
    return this;
  }

  setScopeVariables(variables: string[]): this {
    const scope = this.#scopeStack.at(-1);
    if (scope) scope.variables = variables.slice(0);

    return this;
  }

  endScope(line: number, column: number): this {
    const scope = this.#scopeStack.pop();
    if (!scope) return this;

    scope.end = { line, column };

    if (this.#scopeStack.length === 0) {
      this.#scopes.push(scope);
    } else {
      this.#scopeStack.at(-1)!.children.push(scope);
    }
    this.#lastScope = scope;

    return this;
  }

  /**
   * @returns The OriginalScope opened with the most recent `startScope` call, but not yet closed.
   */
  currentScope(): OriginalScope | null {
    return this.#scopeStack.at(-1) ?? null;
  }

  /**
   * @returns The most recent OriginalScope closed with `endScope`.
   */
  lastScope(): OriginalScope | null {
    return this.#lastScope;
  }

  /**
   * @param option The definition 'scope' of this range can either be the "OriginalScope" directly
   * (produced by this builder) or the scope's number.
   * If a scope was started with the n-th call to `startScope` then n is the scope's number.
   */
  startRange(
    line: number,
    column: number,
    options?: {
      scope?: number | OriginalScope;
      isStackFrame?: boolean;
      isHidden?: boolean;
    },
  ): this {
    const range: GeneratedRange = {
      start: { line, column },
      end: { line, column },
      isStackFrame: Boolean(options?.isStackFrame),
      isHidden: Boolean(options?.isHidden),
      values: [],
      children: [],
    };

    if (this.#rangeStack.length > 0) {
      range.parent = this.#rangeStack.at(-1);
    }

    if (typeof options?.scope === "number") {
      range.originalScope = this.#countToScope.get(options.scope);
    } else if (options?.scope !== undefined) {
      range.originalScope = options.scope;
    }

    this.#rangeStack.push(range);

    return this;
  }

  setRangeDefinitionScope(scope: number | OriginalScope): this {
    const range = this.#rangeStack.at(-1);
    if (!range) return this;

    if (typeof scope === "number") {
      range.originalScope = this.#countToScope.get(scope);
    } else {
      range.originalScope = scope;
    }

    return this;
  }

  setRangeStackFrame(isStackFrame: boolean): this {
    const range = this.#rangeStack.at(-1);
    if (range) range.isStackFrame = isStackFrame;

    return this;
  }

  setRangeHidden(isHidden: boolean): this {
    const range = this.#rangeStack.at(-1);
    if (range) range.isHidden = isHidden;

    return this;
  }

  endRange(line: number, column: number): this {
    const range = this.#rangeStack.pop();
    if (!range) return this;

    range.end = { line, column };

    if (this.#rangeStack.length === 0) {
      this.#ranges.push(range);
    } else {
      this.#rangeStack.at(-1)!.children.push(range);
    }

    return this;
  }

  build(): ScopeInfo {
    const info: ScopeInfo = { scopes: this.#scopes, ranges: this.#ranges };

    this.#scopes = [];
    this.#ranges = [];
    this.#scopeCounter = 0;
    this.#scopeToCount.clear();
    this.#countToScope.clear();

    return info;
  }

  protected get scopeStack(): ReadonlyArray<OriginalScope> {
    return this.#scopeStack;
  }

  protected get rangeStack(): ReadonlyArray<GeneratedRange> {
    return this.#rangeStack;
  }

  protected isValidScopeNumber(n: number): boolean {
    return this.#countToScope.has(n);
  }

  protected isKnownScope(scope: OriginalScope): boolean {
    return this.#scopeToCount.has(scope);
  }
}
