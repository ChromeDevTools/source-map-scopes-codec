// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  EmptyItem,
  type Item,
  OriginalScopeFlags,
  type OriginalScopeStartItem,
  Tag,
} from "../codec.ts";
import type {
  GeneratedRange,
  OriginalScope,
  ScopeInfo,
  SourceMapJson,
} from "../scopes.d.ts";
import { TokenIterator } from "../vlq.ts";

export function decode(sourceMap: SourceMapJson): ScopeInfo {
  if (!sourceMap.scopes || !sourceMap.names) return { scopes: [], ranges: [] };

  return new Decoder(sourceMap.scopes, sourceMap.names).decode();
}

const DEFAULT_SCOPE_STATE = {
  line: 0,
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

class Decoder {
  readonly #encodedScopes: string;
  readonly #names: string[];

  #scopes: (OriginalScope | null)[] = [];
  #ranges: GeneratedRange[] = [];

  readonly #scopeState = { ...DEFAULT_SCOPE_STATE };
  readonly #rangeState = { ...DEFAULT_RANGE_STATE };

  readonly #scopeStack: OriginalScope[] = [];
  readonly #rangeStack: GeneratedRange[] = [];

  constructor(scopes: string, names: string[]) {
    this.#encodedScopes = scopes;
    this.#names = names;
  }

  decode(): ScopeInfo {
    for (const item of this.#decodeItems()) {
      if (item === EmptyItem) {
        this.#scopes.push(null);
        continue;
      }

      switch (item.tag) {
        case Tag.ORIGINAL_SCOPE_START: {
          this.#scopeState.line += item.line;
          const scope: OriginalScope = {
            start: { line: this.#scopeState.line, column: item.column },
            end: { line: this.#scopeState.line, column: item.column },
            isStackFrame: false,
            variables: [],
            children: [],
          };

          if (item.nameIdx !== undefined) {
            this.#scopeState.name += item.nameIdx;
            scope.name = this.#names[this.#scopeState.name];
          }
          if (item.kindIdx !== undefined) {
            this.#scopeState.kind += item.kindIdx;
            scope.kind = this.#names[this.#scopeState.kind];
          }

          scope.isStackFrame = Boolean(
            item.flags & OriginalScopeFlags.IS_STACK_FRAME,
          );

          this.#scopeStack.push(scope);
          break;
        }
        case Tag.ORIGINAL_SCOPE_END: {
          this.#scopeState.line += item.line;

          const scope = this.#scopeStack.pop();
          if (!scope) {
            throw new Error(
              "Encountered ORIGINAL_SCOPE_END without matching ORIGINAL_SCOPE_START!",
            );
          }

          scope.end = { line: this.#scopeState.line, column: item.column };

          if (this.#scopeStack.length > 0) {
            const parent = this.#scopeStack.at(-1)!;
            scope.parent = parent;
            parent.children.push(scope);
          } else {
            this.#scopes.push(scope);
            Object.assign(this.#scopeState, DEFAULT_SCOPE_STATE);
          }
          break;
        }
      }
    }

    const info = { scopes: this.#scopes, ranges: this.#ranges };

    this.#scopes = [];
    this.#ranges = [];

    return info;
  }

  *#decodeItems(): Generator<Item> {
    const iter = new TokenIterator(this.#encodedScopes);

    while (iter.hasNext()) {
      if (iter.peek() === ",") {
        iter.nextChar(); // Consume ",".
        yield EmptyItem;
        continue;
      }

      const tag = iter.nextUnsignedVLQ();
      switch (tag) {
        case Tag.ORIGINAL_SCOPE_START: {
          const item: OriginalScopeStartItem = {
            tag,
            flags: iter.nextUnsignedVLQ(),
            line: iter.nextUnsignedVLQ(),
            column: iter.nextUnsignedVLQ(),
          };

          if (item.flags & OriginalScopeFlags.HAS_NAME) {
            item.nameIdx = iter.nextSignedVLQ();
          }
          if (item.flags & OriginalScopeFlags.HAS_KIND) {
            item.kindIdx = iter.nextSignedVLQ();
          }

          yield item;
          break;
        }
        case Tag.ORIGINAL_SCOPE_END: {
          yield {
            tag,
            line: iter.nextUnsignedVLQ(),
            column: iter.nextUnsignedVLQ(),
          };
          break;
        }
      }

      // Consume any trailing VLQ and the the ","
      while (iter.hasNext() && iter.peek() !== ",") iter.nextUnsignedVLQ();
      if (iter.hasNext()) iter.nextChar();
    }

    if (iter.currentChar() === ",") {
      yield EmptyItem;
    }
  }
}
