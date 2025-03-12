// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { ScopeInfo, SourceMapJson } from "../scopes.d.ts";
import { Encoder } from "./encoder.ts";

/**
 * Encodes the `ScopeInfo` into a source map JSON object.
 *
 * If `inputSourceMap` is provided, `encode` will augment the "names" array and
 * overwrite the "scopes" field, before returning the provided `inputSourceMap` again.
 */
export function encode(
  scopesInfo: ScopeInfo,
  inputSourceMap?: SourceMapJson,
): SourceMapJson {
  inputSourceMap ||= {
    version: 3,
    mappings: "",
    sources: new Array(scopesInfo.scopes.length).fill(null),
  };
  inputSourceMap.names ||= [];

  if (inputSourceMap.sources.length !== scopesInfo.scopes.length) {
    throw new Error(
      `SourceMapJson.sources.length must match ScopesInfo.scopes! ${inputSourceMap.sources.length} vs ${scopesInfo.scopes.length}`,
    );
  }

  inputSourceMap.scopes = new Encoder(scopesInfo, inputSourceMap.names)
    .encode();

  return inputSourceMap;
}
