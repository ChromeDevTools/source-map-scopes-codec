// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Small utility that converts the scopes encoding of the
 * source maps in the "maps/" directory from a given version to the currently
 * checked out version.
 *
 * The given version must be a released version on JSR.
 */

import { expandGlob } from "jsr:@std/fs";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { encode } from "../src/mod.ts";

if (import.meta.main) {
  const flags = parseArgs(Deno.args, {
    string: ["from"],
  });

  if (!flags.from) {
    throw new Error("--from is mandatory");
  }

  const oldCodec = await import(
    `jsr:@chrome-devtools/source-map-scopes-codec@${flags.from}`
  );

  for await (
    const file of expandGlob("maps/*.js.map", { root: import.meta.dirname })
  ) {
    const mapContent = Deno.readTextFileSync(file.path);
    const mapJson = JSON.parse(mapContent);
    const info = oldCodec.decode(mapJson);

    encode(info, mapJson);

    Deno.writeTextFileSync(file.path, JSON.stringify(mapJson));
  }
}
