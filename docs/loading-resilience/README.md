# Loading resilience

The reported mobile single-player failure around 22–33% occurs during city and rider/boat preparation. Previously city GLBs and external images only reported activity when an entire request completed. A slow but active transfer could therefore exceed the 120-second inactivity guard. The overall 600-second client asset deadline could also reject progressing downloads.

## Changes

- City GLBs, boat/rider GLBs and external textures share streamed progress, at most three concurrent downloads, finite request deadlines and bounded automatic retries.
- A receiving download refreshes its inactivity deadline on every chunk. Active downloads no longer have an arbitrary overall client deadline; truly stalled requests still fail with a retry action.
- Versioned CacheStorage preserves completed raw resources and 1 MiB checkpoints across page reloads. Runtime asset content determines the version. Completed resources replace checkpoints; completed-file housekeeping trims the owned cache toward 192 MiB. Unavailable, full or unresponsive storage falls back to downloading.
- Loading displays real downloaded/reused bytes and retry counts. Background suspension pauses the shader warmup budget and does not count as asset inactivity.
- Existing geometry, textures, materials, water settings, gameplay and server protocol are unchanged. No cache polling or new timers remain in the normal racing frame loop.

## Validation

- 241 Node tests and TypeScript checks passed; 13 Workers integration tests passed.
- Real browser worker/cache tests: interrupted download survives full reload, remaining ranges resume byte-exactly, gzip matches the original, a warm reload makes no model requests, concurrency stays at three, and loading works with both CacheStorage and Worker unavailable.
- Actual mobile-emulated and desktop games recover from an injected city HTTP 503 and start successfully. Warm page reloads make zero model/texture requests. These use local test infrastructure, not physical phone timing claims.
- An actual mobile-emulated game receives the 15.7 MB waterfront at about 100 KiB/s: still progressing at 130 seconds, then starts successfully after 173.8 seconds.
- Two frozen desktop scenes compared against the previous release have identical dimensions and zero changed RGB pixels.
- Two-client race regression passed: all-ready host start, slow-player loading barrier, shared five-second countdown, touch driving, opponent synchronization, disconnect/reconnect, and exit home.

Small machine-readable evidence is stored alongside this document. Reproducible browser runners are `scripts/qa/loading-*-browser.mjs` and `scripts/qa/loading-quality-compare.mjs`.

## Limits

Offline connections and permanently unavailable/corrupt resources can still fail after bounded retries. Browser storage is optional and may be evicted by the browser. First-time resource bytes and GPU decoding work remain unchanged; persistent reuse primarily benefits retries and later visits. This change does not extend the multiplayer server's existing loading deadline or establish mainland network/physical device performance results.
