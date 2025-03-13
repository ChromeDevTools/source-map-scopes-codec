# source-map-scopes-codec

This library hosts a production ready implementation of the source map ["Scopes" proposal](https://github.com/tc39/ecma426/blob/main/proposals/scopes.md).

The library contains:
  * Type definitions for structured scope information
  * Encode and decode functions that can encode structured scope information into an already existing source map, or decode the structured scope information from a source map.
  * A builder that helps with building the structured scope information.

This library doesn't implement mappings encoding/decoding, but it does support encoding the scopes information into an already existing source map with "mappings" and "names".

## Installation

TODO: Fill in once this package is published on JSR (and maybe NPM).

## Usage

Using the library is straight-forward:

```js
import { encode } from "@chrome-devtools/source-map-scopes-codec";

const scopeInformation = ...;
const map = encode(scopeInformation);

// Or with a pre-existing source map.
const map = encode(scopeInformation, preExistingSourceMap);
```

To decode:

```js
import { decode } from "@chrome-devtools/source-map-scopes-codec";

const scopeInformation = decode(sourceMap);
```

The library also contains a builder that makes creating structured scope information easier:

```js
import { ScopeInfoBuilder } from "@chrome-devtools/source-map-scopes-codec";

const scopeInformation = new ScopeInfoBuilder()
    .addScope(0, 0, { kind: "Global" })
        .addScope(5, 10)
        .setScopeKind("Function")      // Same as passing 'kind' to 'addScope'.
        .setScopeName("foo")           // Same as passing 'name' to 'addScope'.
        .endScope(10, 5)
    .endScope(11, 1)
    .addRange(0, 0, { scope: 0 })
        .addRange(0, 10)
        .setRangeScopeDefinition(1)    // Same as passing 'scope' to 'addRange'.
        .endRange(0, 15)
    .endRange(1, 1)
    .build();
```

There is also a `SafeScopeInfoBuilder` that checks that scopes and ranges are well nested and some other integrity constraints (e.g. definition scopes are known).
