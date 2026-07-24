# SceneSponsor MVP implementation

## What runs today

- The Next.js control room accepts MP4/MOV clips, validates MIME, size, 5–12 second duration, portrait orientation, and the 720×1280 ceiling.
- Browser uploads go directly into the private `scenesponsor-media` Supabase bucket using a one-time signed upload token, avoiding Vercel request-size limits. Original, Vision, and Sponsored playback URLs are short-lived signed URLs.
- Jobs advance through the public stage contract and publish an inspectable event stream.
- The local render path runs real FFmpeg work, emits separate Agent Vision and sponsored H.264/AAC MP4s, and preserves the source duration and audio.
- Six deterministic evaluation records gate creator approval. Export returns `403` before approval.
- The three players share transport state, with the original as master and 80ms drift correction.
- A strict Fireworks video adapter and Daytona worker contract are included. The UI says **LOCAL VERIFIED MODE** when provider credentials are absent.
- On Vercel without provider/storage keys, the seeded recovery run completes in one Fluid Compute request against checked-in owned artifacts. It is deliberately not represented as a live provider render.
- The Supabase migration defines private, RLS-enabled job metadata tables. Storage buckets and provider credentials still need provisioning in the target team account.

## Honest provider status

| Component | Repository implementation | Live credential status |
| --- | --- | --- |
| Fireworks | Strict JSON-schema video adapter with 1/3/7 second 503 retry | Not configured locally |
| Daytona | Portable worker CLI and snapshot contract | Supplied key currently fails SDK authentication; bundled FFmpeg is the verified render fallback |
| Braintrust | Six-result approval gate and trace-shaped UI | API tracing needs a key |
| CopilotKit | Creator interrupt semantics implemented in the control room | SDK transport not yet connected |
| Supabase | Full migration and RLS boundary | Project keys not configured |
| Vercel | Next.js production build and static recovery artifacts | CLI authenticated |

The seeded clip and pre-rendered recovery artifacts are owned demo fixtures. They are intentionally labeled local/verified mode and must not be presented as a live provider run.

## Local run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`, select **Analyze seeded clip**, wait for the quality gate, then approve and export.
