# Cloudflare Worker media headers (recommended)

For `/media/*` responses serving videos, set:

- `Accept-Ranges: bytes`
- `Content-Range` on 206 partial responses
- `ETag` (strong or weak)
- `Cache-Control: public, max-age=86400, immutable` (or suitable TTL)
- `Content-Disposition: inline`
- Correct `Content-Type` (video/mp4, video/webm, image/*)

The web client uses **direct URL** on `<video src>` so the browser issues Range requests itself. Do **not** fetch the whole file into a Blob in JS.
