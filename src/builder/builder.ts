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

  addNullScope(): this {
    this.#scopes.push(null);
    return this;
  }

  startScope(line: number, column: number, options?: { name?: string }): this {
    const scope: OriginalScope = {
      start: { line, column },
      end: { line, column },
      variables: [],
      children: [],
      isStackFrame: false,
    };

    if (options?.name !== undefined) scope.name = options.name;

    if (this.#scopeStack.length > 0) {
      scope.parent = this.#scopeStack.at(-1);
    }
    this.#scopeStack.push(scope);

    return this;
  }

  setScopeName(name: string): this {
    const scope = this.#scopeStack.at(-1);
    if (scope) scope.name = name;
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

    return this;
  }

  startRange(line: number, column: number): this {
    this.#rangeStack.push({
      start: { line, column },
      end: { line, column },
      isStackFrame: false,
      isHidden: false,
      values: [],
      children: [],
      parent: this.#rangeStack.at(-1),
    });

    return this;
  }

  build(): ScopeInfo {
    const info: ScopeInfo = { scopes: this.#scopes, ranges: this.#ranges };

    this.#scopes = [];
    this.#ranges = [];

    return info;
  }

  protected get scopeStack(): ReadonlyArray<OriginalScope> {
    return this.#scopeStack;
  }

  protected get rangeStack(): ReadonlyArray<GeneratedRange> {
    return this.#rangeStack;
  }

  protected get scopes(): ReadonlyArray<OriginalScope | null> {
    return this.#scopes;
  }

  protected get ranges(): ReadonlyArray<GeneratedRange> {
    return this.#ranges;
  }
}
