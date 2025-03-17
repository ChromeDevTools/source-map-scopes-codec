// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * The decoded scopes information found in a source map.
 */
export interface ScopeInfo {
  scopes: (OriginalScope | null)[];
  ranges: GeneratedRange[];
}

/**
 * A scope in the authored source.
 */
export interface OriginalScope {
  start: Position;
  end: Position;

  /**
   * The name of this scope. For function scopes this is the function name.
   *
   * Constructors may put the class name here.
   */
  name?: string;

  /**
   * JavaScript-like languages are encouraged to use 'Global', 'Class', 'Function' and 'Block'.
   *
   * The "kind" is only used in debuggers as a label for scope UI views, but does not have any
   * semantic significance.
   */
  kind?: string;

  /**
   * Whether this scope is something that can be called and results in stack frame (e.g. functions, methods, etc.).
   */
  isStackFrame: boolean;

  /**
   * All variable names that this scope declares.
   */
  variables: string[];

  children: OriginalScope[];
  parent?: OriginalScope;
}

/**
 * A range (can be a scope) in the generated JavaScript.
 */
export interface GeneratedRange {
  start: Position;
  end: Position;

  /**
   * The corresponding scope in the authored source.
   */
  originalScope?: OriginalScope;

  /**
   * Whether this generated range is an actual JavaScript/WASM function in the generated code.
   */
  isStackFrame: boolean;

  /**
   * Whether calls to this generated range should be hidden from stack traces even if
   * this range has an `originalScope`.
   */
  isHidden: boolean;

  /**
   * If this `GeneratedRange` is the result of inlining `originalScope`, then `callsite`
   * refers to where `originalScope` was called in the original ("authored") code.
   *
   * If this field is present than `originalScope` is present as well and `isStackFrame` is `false`.
   */
  callsite?: OriginalPosition;

  /**
   * Expressions that compute the values of the variables of this OriginalScope. The length
   * of `values` matches the length of `originalScope.variables`.
   *
   * For each variable this can either be a single expression (valid for the full `GeneratedRange`),
   * or an array of `BindingRange`s, e.g. if computing the value requires different expressions
   * throughout the range or if the variable is only available in parts of the `GeneratedRange`.
   *
   * When a value uses `BindingRange[]`, then the "from" of the first `BindingRange` and the
   * "to" of the last `BindingRange` are equal to the GeneratedRange's "start" and "end" position
   * respectively.
   *
   * `undefined` denotes that the value of a variable is unavailable in the whole range.
   * This can happen e.g. if the variable was optimized out and can't be recomputed.
   */
  values: (string | undefined | BindingRange[])[];

  children: GeneratedRange[];
  parent?: GeneratedRange;
}

export interface BindingRange {
  value?: string;
  from: Position;
  to: Position;
}

export interface Position {
  line: number;
  column: number;
}

export interface OriginalPosition extends Position {
  sourceIndex: number;
}

export interface SourceMapJson {
  version: 3;
  sources: (string | null)[];
  mappings: string;
  names?: string[];
  scopes?: string;
}
