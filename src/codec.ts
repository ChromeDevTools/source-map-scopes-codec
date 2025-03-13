// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export const enum Tag {
  ORIGINAL_SCOPE_START = 0x1,
  ORIGINAL_SCOPE_END = 0x2,
  ORIGINAL_SCOPE_VARIABLES = 0x3,
  GENERATED_RANGE_START = 0x4,
  GENERATED_RANGE_END = 0x5,
}

export const enum EncodedTag {
  ORIGINAL_SCOPE_START = "B", // 0x1
  ORIGINAL_SCOPE_END = "C", // 0x2
  ORIGINAL_SCOPE_VARIABLES = "D", // 0x3
  GENERATED_RANGE_START = "E", // 0x4
  GENERATED_RANGE_END = "F", // 0x5
}

export const enum OriginalScopeFlags {
  HAS_NAME = 0x1,
  HAS_KIND = 0x2,
  IS_STACK_FRAME = 0x4,
}

export const enum GeneratedRangeFlags {
  HAS_LINE = 0x1,
  HAS_DEFINITION = 0x2,
}

export const EmptyItem = Symbol("empty item");

export type Item =
  | typeof EmptyItem
  | OriginalScopeStartItem
  | OriginalScopeEndItem
  | GeneratedRangeStartItem
  | GeneratedRangeEndItem;

export interface OriginalScopeStartItem {
  tag: Tag.ORIGINAL_SCOPE_START;
  flags: number;
  line: number;
  column: number;
  nameIdx?: number;
  kindIdx?: number;
}

interface OriginalScopeEndItem {
  tag: Tag.ORIGINAL_SCOPE_END;
  line: number;
  column: number;
}

interface GeneratedRangeStartItem {
  tag: Tag.GENERATED_RANGE_START;
  flags: number;
  line?: number;
  column: number;
}

interface GeneratedRangeEndItem {
  tag: Tag.GENERATED_RANGE_END;
  line?: number;
  column: number;
}
