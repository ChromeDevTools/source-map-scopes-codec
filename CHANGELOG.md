# Changelog

## [0.9.0](https://github.com/ChromeDevTools/source-map-scopes-codec/compare/@chrome-devtools/source-map-scopes-codec-v0.8.1...@chrome-devtools/source-map-scopes-codec-v0.9.0) (2026-08-13)


### Features

* Add indicator in decoding result whether variables and binding expressions are present ([#3](https://github.com/ChromeDevTools/source-map-scopes-codec/issues/3)) ([3d0a2a5](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/3d0a2a555e3ec10699d7adeb1aa2ee44addc38ed))
* Add support for index source maps ([958ddcc](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/958ddcc2412683243842eedcfd32a1623688860f))
* Implement new vendor extension items and invalid items ([731ec13](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/731ec1343e0d5483d7fd7f293bf5c18da3d4d93a))
* Nil top-level original scopes use an empty tag now ([e73b2d1](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/e73b2d15c699cf2f29d7dbb4b19103341c5aeb0d))
* Use 1-based unsigned VLQs for binding expressions ([32bc5b7](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/32bc5b72c8ed78d5e2ac148b1c1bc718bc87320d))


### Bug Fixes

* align sub-range binding with current spec text ([#5](https://github.com/ChromeDevTools/source-map-scopes-codec/issues/5)) ([a0d078c](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/a0d078c6d86d572429ed738a74d61dcfd1517df6))
* Associate sub-range bindings with the correct range ([888bc72](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/888bc72ae22baa3b4a525fb8d51f8ef4ce06978c)), closes [#1](https://github.com/ChromeDevTools/source-map-scopes-codec/issues/1)
* Don't reset decoding state between top-level ranges ([ae534f7](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/ae534f7de09a498e1466c0224ca7816f589ac4de))
* Re-encode benchmark maps after ranges support was implemented ([d19865b](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/d19865b87783d8f6ae48ef50c6879345e57695fd))
* Rename scopes.d.ts to scopes.ts ([b5faea1](https://github.com/ChromeDevTools/source-map-scopes-codec/commit/b5faea15b438cfcc49097317d03fdad0cce87e64))
