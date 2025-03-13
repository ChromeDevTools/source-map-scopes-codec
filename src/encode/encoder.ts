// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { EncodedTag, OriginalScopeFlags } from "../codec.ts";
import type { GeneratedRange, OriginalScope, ScopeInfo } from "../scopes.d.ts";
import { encodeSigned, encodeUnsigned } from "../vlq.ts";

const DEFAULT_SCOPE_STATE = {
  line: 0,
  column: 0,
  name: 0,
  kind: 0,
};

const DEFAULT_RANGE_STATE = {
  line: 0,
  column: 0,
  defScopeIdx: 0,
  callsiteSourceIdx: 0,
  callsiteLine: 0,
  callsiteColumn: 0,
};

export class Encoder {
  readonly #info: ScopeInfo;
  readonly #names: string[];

  readonly #scopeState = { ...DEFAULT_SCOPE_STATE };
  readonly #rangeState = { ...DEFAULT_RANGE_STATE };
  #encodedItems: string[] = [];

  #currentItem: string = "";

  constructor(info: ScopeInfo, names: string[]) {
    this.#info = info;
    this.#names = names;
  }

  encode(): string {
    this.#encodedItems = [];
    this.#info.scopes.forEach((scope) => {
      Object.assign(this.#scopeState, DEFAULT_SCOPE_STATE);
      this.#encodeOriginalScope(scope);
    });
    this.#info.ranges.forEach((range) => {
      Object.assign(this.#rangeState, DEFAULT_RANGE_STATE);
      this.#encodeGeneratedRange(range);
    });

    return this.#encodedItems.join(",");
  }

  #encodeOriginalScope(scope: OriginalScope | null): void {
    if (scope === null) {
      this.#encodedItems.push("");
      return;
    }

    this.#encodeOriginalScopeStart(scope);
    scope.children.forEach((child) => this.#encodeOriginalScope(child));
    this.#encodeOriginalScopeEnd(scope);
  }

  #encodeOriginalScopeStart(scope: OriginalScope) {
    const { line, column } = scope.start;
    this.#verifyPositionWithScopeState(line, column);

    let flags = 0;
    const encodedLine = line - this.#scopeState.line;
    this.#scopeState.line = line;
    this.#scopeState.column = column;

    let encodedName: number | undefined;
    if (scope.name !== undefined) {
      flags |= OriginalScopeFlags.HAS_NAME;
      const nameIdx = this.#resolveNamesIdx(scope.name);
      encodedName = nameIdx - this.#scopeState.name;
      this.#scopeState.name = nameIdx;
    }

    let encodedKind: number | undefined;
    if (scope.kind !== undefined) {
      flags |= OriginalScopeFlags.HAS_KIND;
      const kindIdx = this.#resolveNamesIdx(scope.kind);
      encodedKind = kindIdx - this.#scopeState.kind;
      this.#scopeState.kind = kindIdx;
    }

    if (scope.isStackFrame) flags |= OriginalScopeFlags.IS_STACK_FRAME;

    this.#encodeTag(EncodedTag.ORIGINAL_SCOPE_START).#encodeUnsigned(flags)
      .#encodeUnsigned(encodedLine).#encodeUnsigned(column);
    if (encodedName !== undefined) this.#encodeSigned(encodedName);
    if (encodedKind !== undefined) this.#encodeSigned(encodedKind);
    this.#finishItem();
  }

  #encodeOriginalScopeEnd(scope: OriginalScope) {
    const { line, column } = scope.end;
    this.#verifyPositionWithScopeState(line, column);

    const encodedLine = line - this.#scopeState.line;

    this.#scopeState.line = line;
    this.#scopeState.column = column;

    this.#encodeTag(EncodedTag.ORIGINAL_SCOPE_END).#encodeUnsigned(encodedLine)
      .#encodeUnsigned(column).#finishItem();
  }

  #encodeGeneratedRange(_range: GeneratedRange): void {
  }

  #resolveNamesIdx(name: string): number {
    const index = this.#names.indexOf(name);
    if (index >= 0) return index;

    this.#names.push(name);
    return this.#names.length - 1;
  }

  #verifyPositionWithScopeState(line: number, column: number) {
    if (
      this.#scopeState.line > line ||
      (this.#scopeState.line === line && this.#scopeState.column > column)
    ) {
      throw new Error(
        `Attempting to encode scope item that precedes the last encoded scope item (${line}, ${column})`,
      );
    }
  }

  #encodeTag(tag: EncodedTag): this {
    this.#currentItem += tag;
    return this;
  }

  #encodeSigned(n: number): this {
    this.#currentItem += encodeSigned(n);
    return this;
  }

  #encodeUnsigned(n: number): this {
    this.#currentItem += encodeUnsigned(n);
    return this;
  }

  #finishItem(): void {
    this.#encodedItems.push(this.#currentItem);
    this.#currentItem = "";
  }
}
