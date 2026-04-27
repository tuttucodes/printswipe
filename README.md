# printswipe

Campus print shop scheduling PWA. Students upload PDFs, pick a 15-minute slot, pay via Razorpay, walk in and collect from numbered bins. Merchants get one-click bundled mega-PDFs per (paper, size, color) stream — black-banded cover/tail pages make physical sorting mechanical.

## Stack

Next.js 14 App Router · TypeScript strict · Tailwind + shadcn (heavily customised) · Supabase (Postgres, Auth, Storage) · Razorpay · pdf-lib + @napi-rs/canvas · next-pwa

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm seed                    # populates campuses, shops, merchants, demo students
pnpm dev
```

Visit `http://localhost:3000`.

## Deployment

See section "Deployment" below — exact Cloudflare DNS, Vercel domain, Namecheap nameserver, Supabase, and Razorpay setup steps.

## Architecture

```
Student → upload PDF/image (HEIC→JPG client-side) → Supabase Storage (private)
       → configure (paper × size × color × sides × layout × copies × range)
       → Razorpay checkout (paise, INR)
       → atomic token (next_token RPC)
       → SCHEDULED

Merchant → Bundle action (server-side bundler)
        → 1..6 mega-PDFs, one per stream (paper × size × color)
        → each PDF = [cover|content|tail] per job, in token order
        → covers/tails have right + top black-edge bands for tactile sorting
        → duplex streams: blanks padded so simplex-content jobs print clean backs
        → merchant Ctrl+P each stream on its routed printer
        → mark batch printed → token lookup → mark COLLECTED
```

## Bundler

The heart. See `src/lib/bundler.ts` and 10 integration tests in `tests/bundler.test.ts`.

Key behaviours:

- **Stream identity** = (paper_type, paper_size, color_bucket). Mixed-color files split into both BW and Color streams of the same paper/size.
- **Always-duplex with padding** for streams whose printer supports duplex: every cover/tail gets a blank back; single-sided content interleaved with blanks; odd-page jobs padded to even sheet count.
- **Stack-order independent**: black bands on right + top edges of every cover/tail make boundaries unmistakable from any angle.
- **Posters never carry covers** (don't waste glossy paper) — covers go on the closest matching plain stream; if a job has zero plain content, a stub plain BW A4 stream carries the cover.

## Pricing

Data, not code. Every shop has its own `pricing_json`. See `src/lib/pricing.ts`.

## Run tests

```bash
pnpm test            # all
pnpm test:bundler    # bundler edge cases only
```

## License

MIT
