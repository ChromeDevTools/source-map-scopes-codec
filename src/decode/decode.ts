// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  EmptyItem,
  GeneratedRangeFlags,
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

/**
 * The mode decides how well-formed the encoded scopes have to be, to be accepted by the decoder.
 *
 * LOOSE is the default and is much more lenient. It's still best effort though and the decoder doesn't
 * implement any error recovery: e.g. superfluous "start" items can lead to whole trees being omitted.
 *
 * STRICT mode will throw in the following situations:
 *
 *   - Encountering ORIGINAL_SCOPE_END, or GENERATED_RANGE_END items that don't have matching *_START items.
 *   - Encountering ORIGINAL_SCOPE_VARIABLES items outside a surrounding scope START/END.
 *   - Encountering GENERATED_RANGE_BINDINGS items outside a surrounding range START/END.
 *   - Miss-matches between the number of variables in a scope vs the number of value expressions in the ranges.
 *   - Out-of-bound indices into the "names" array.
 */
export const enum DecodeMode {
  STRICT = 1,
  LOOSE = 2,
}

export function decode(
  sourceMap: SourceMapJson,
  options?: { mode: DecodeMode },
): ScopeInfo {
  if (!sourceMap.scopes || !sourceMap.names) return { scopes: [], ranges: [] };

  return new Decoder(sourceMap.scopes, sourceMap.names, options).decode();
}

const DEFAULT_SCOPE_STATE = {
  line: 0,
  name: 0,
  kind: 0,
  variable: 0,
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
  readonly #mode: DecodeMode;

  #scopes: (OriginalScope | null)[] = [];
  #ranges: GeneratedRange[] = [];

  readonly #scopeState = { ...DEFAULT_SCOPE_STATE };
  readonly #rangeState = { ...DEFAULT_RANGE_STATE };

  readonly #scopeStack: OriginalScope[] = [];
  readonly #rangeStack: GeneratedRange[] = [];

  readonly #countToScope = new Map<number, OriginalScope>();
  #scopeCounter = 0;

  constructor(scopes: string, names: string[], options?: { mode: DecodeMode }) {
    this.#encodedScopes = scopes;
    this.#names = names;
    this.#mode = options?.mode ?? DecodeMode.LOOSE;
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
          this.#countToScope.set(this.#scopeCounter++, scope);
          break;
        }
        case Tag.ORIGINAL_SCOPE_VARIABLES: {
          const scope = this.#scopeStack.at(-1);
          if (!scope) {
            this.#throwInStrictMode(
              "Encountered ORIGINAL_SCOPE_VARIABLES without surrounding ORIGINAL_SCOPE_START",
            );
            continue;
          }

          for (const variableIdx of item.variableIdxs) {
            this.#scopeState.variable += variableIdx;
            scope.variables.push(this.#names[this.#scopeState.variable]);

            // TODO: Potentially throw if we decode an illegal index.
          }
          break;
        }
        case Tag.ORIGINAL_SCOPE_END: {
          this.#scopeState.line += item.line;

          const scope = this.#scopeStack.pop();
          if (!scope) {
            this.#throwInStrictMode(
              "Encountered ORIGINAL_SCOPE_END without matching ORIGINAL_SCOPE_START!",
            );
            continue;
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
        case Tag.GENERATED_RANGE_START: {
          if (item.line !== undefined) {
            this.#rangeState.line += item.line;
            this.#rangeState.column = item.column;
          } else {
            this.#rangeState.column += item.column;
          }

          const range: GeneratedRange = {
            start: {
              line: this.#rangeState.line,
              column: this.#rangeState.column,
            },
            end: {
              line: this.#rangeState.line,
              column: this.#rangeState.column,
            },
            isStackFrame: Boolean(
              item.flags & GeneratedRangeFlags.IS_STACK_FRAME,
            ),
            isHidden: Boolean(item.flags & GeneratedRangeFlags.IS_HIDDEN),
            values: [],
            children: [],
          };

          if (item.definitionIdx !== undefined) {
            this.#rangeState.defScopeIdx += item.definitionIdx;
            range.originalScope = this.#countToScope.get(
              this.#rangeState.defScopeIdx,
            );
            // TODO: Maybe throw if the idx is invalid?
          }

          this.#rangeStack.push(range);
          break;
        }
        case Tag.GENERATED_RANGE_END: {
          if (item.line !== undefined) {
            this.#rangeState.line += item.line;
            this.#rangeState.column = item.column;
          } else {
            this.#rangeState.column += item.column;
          }

          const range = this.#rangeStack.pop();
          if (!range) {
            this.#throwInStrictMode(
              "Encountered GENERATED_RANGE_END without matching GENERATED_RANGE_START!",
            );
            continue;
          }

          range.end = {
            line: this.#rangeState.line,
            column: this.#rangeState.column,
          };

          if (this.#rangeStack.length > 0) {
            const parent = this.#rangeStack.at(-1)!;
            range.parent = parent;
            parent.children.push(range);
          } else {
            this.#ranges.push(range);
            Object.assign(this.#rangeState, DEFAULT_RANGE_STATE);
          }
          break;
        }
        case Tag.GENERATED_RANGE_BINDINGS: {
          const range = this.#rangeStack.at(-1);
          if (!range) {
            this.#throwInStrictMode(
              "Encountered GENERATED_RANGE_BINDINGS without surrounding GENERATED_RANGE_START",
            );
            continue;
          }

          for (const valueIdx of item.valueIdxs) {
            if (valueIdx === -1) {
              range.values.push(null);
            } else {
              range.values.push(this.#names[valueIdx]);
            }

            // TODO: Potentially throw if we decode an illegal index.
          }
          break;
        }
      }
    }

    if (this.#scopeStack.length > 0) {
      this.#throwInStrictMode(
        "Encountered ORIGINAL_SCOPE_START without matching END!",
      );
    }
    if (this.#rangeStack.length > 0) {
      this.#throwInStrictMode(
        "Encountered GENERATED_RANGE_START without matching END!",
      );
    }

    const info = { scopes: this.#scopes, ranges: this.#ranges };

    this.#scopes = [];
    this.#ranges = [];
    this.#scopeCounter = 0;
    this.#countToScope.clear();

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
        case Tag.ORIGINAL_SCOPE_VARIABLES: {
          const variableIdxs: number[] = [];

          while (iter.hasNext() && iter.peek() !== ",") {
            variableIdxs.push(iter.nextSignedVLQ());
          }

          yield { tag, variableIdxs };
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
        case Tag.GENERATED_RANGE_START: {
          const flags = iter.nextUnsignedVLQ();
          const line = flags & GeneratedRangeFlags.HAS_LINE
            ? iter.nextUnsignedVLQ()
            : undefined;
          const column = iter.nextUnsignedVLQ();

          const definitionIdx = flags & GeneratedRangeFlags.HAS_DEFINITION
            ? iter.nextSignedVLQ()
            : undefined;

          yield {
            tag,
            flags,
            line,
            column,
            definitionIdx,
          };
          break;
        }
        case Tag.GENERATED_RANGE_END: {
          const lineOrColumn = iter.nextUnsignedVLQ();
          const maybeColumn = iter.hasNext() && iter.peek() !== ","
            ? iter.nextUnsignedVLQ()
            : undefined;

          if (maybeColumn !== undefined) {
            yield { tag, line: lineOrColumn, column: maybeColumn };
          } else {
            yield { tag, column: lineOrColumn };
          }
          break;
        }
        case Tag.GENERATED_RANGE_BINDINGS: {
          const valueIdxs: number[] = [];

          while (iter.hasNext() && iter.peek() !== ",") {
            valueIdxs.push(iter.nextSignedVLQ());
          }

          yield { tag, valueIdxs };
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

  #throwInStrictMode(message: string) {
    if (this.#mode === DecodeMode.STRICT) throw new Error(message);
  }
}
