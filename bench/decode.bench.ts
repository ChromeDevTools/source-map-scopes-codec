// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { expandGlob } from "jsr:@std/fs";
import { format } from "jsr:@std/fmt/bytes";

import { decode, DecodeMode } from "../src/mod.ts";

const BENCHMARKS = await (async () => {
  const result = [];
  for await (
    const file of expandGlob("maps/*.js.map", { root: import.meta.dirname })
  ) {
    const mapContent = Deno.readTextFileSync(file.path);
    const mapJson = JSON.parse(mapContent);
    result.push({
      name: file.name,
      mapJson,
      size: mapContent.length,
    });
  }
  return result;
})();

for (const { name, mapJson, size } of BENCHMARKS) {
  Deno.bench(`${name}, lax, ${format(size)}`, () => {
    decode(mapJson, { mode: DecodeMode.LAX });
  });

  Deno.bench(`${name}, strict, ${format(size)}`, () => {
    decode(mapJson, { mode: DecodeMode.STRICT });
  });
}
