// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type {
  Binding,
  GeneratedRange,
  OriginalPosition,
  OriginalScope,
  Position,
  ScopeInfo,
  SourceMapJson,
  SubRangeBinding,
} from "./src/scopes.d.ts";

export { encode } from "./src/encode/encode.ts";
export { decode, DecodeMode } from "./src/decode/decode.ts";

export { ScopeInfoBuilder } from "./src/builder/builder.ts";
export { SafeScopeInfoBuilder } from "./src/builder/safe_builder.ts";
