// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { expandGlob } from "jsr:@std/fs";
import { format } from "jsr:@std/fmt/bytes";

import { decode, encode } from "../src/mod.ts";

const BENCHMARKS = await (async () => {
  const result = [];
  for await (
    const file of expandGlob("*.js.map", { root: import.meta.dirname })
  ) {
    const mapContent = Deno.readTextFileSync(file.path);
    const mapJson = JSON.parse(mapContent);
    const info = decode(mapJson);
    result.push({
      name: file.name,
      info,
      size: mapContent.length,
    });
  }
  return result;
})();

for (const { name, info, size } of BENCHMARKS) {
  Deno.bench(`${name}, ${format(size)}`, () => {
    encode(info);
  });
}
