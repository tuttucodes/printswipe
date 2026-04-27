# Printswipe

Campus print shop scheduling PWA. Students upload PDFs and images, pick a 15-minute slot, pay via Razorpay, then walk in and collect from numbered bins. Merchants press one button: the bundler emits 1 to 6 mega-PDFs per (paper, size, color) stream with right/top black-band L-shape covers and tail pages, so physical sorting is mechanical even when bin-shelf stack order is wrong.

## 1. Project overview

Printswipe is a single-tenant-per-campus PWA built on Next.js 14 (App Router) and Supabase (Postgres, Auth, Storage, Edge Functions). All money is held in **paise as integers** with banker's rounding. All printable jobs are normalized to fixed paper sizes (A4, A3, A2) so the bundler can route each stream to a specific printer with deterministic duplex behavior.

## 2. Quickstart for developers

```bash
pnpm install
cp .env.example .env.local        # fill in values (see section 7.4 / 7.5)
pnpm seed                         # populates campuses, shops, merchants, demo students
pnpm dev
```

Visit `http://localhost:3000`.

Useful one-shots:

```bash
pnpm gen:icons        # regenerate PWA icons under public/icons/
pnpm gen:types        # regenerate Supabase TypeScript types
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # full vitest run
pnpm test:bundler     # bundler edge cases only
```

## 3. Architecture overview

```
+----------------------------------------------------------+
|                          STUDENT                          |
+----------------------------------------------------------+
        |
        | upload PDF / image (HEIC -> JPG client-side)
        v
+----------------------------------------------------------+
|              Supabase Storage (job-files, private)        |
+----------------------------------------------------------+
        |
        | configure (paper x size x color x sides x layout x copies x range)
        v
+----------------------------------------------------------+
|         Razorpay checkout (INR, paise as int)             |
+----------------------------------------------------------+
        |
        | atomic token via next_token RPC
        v
+---------------------+        +---------------------------+
|  jobs.SCHEDULED     | -----> |  Bundler (server-side)    |
+---------------------+        |  src/lib/bundler.ts       |
                               +---------------------------+
                                        |
                                        | 1..6 mega-PDFs
                                        | (paper x size x color)
                                        v
                               +---------------------------+
                               |  per-stream PDFs:         |
                               |   [cover | content | tail]|
                               |   black L-band markers    |
                               |   duplex padding rules    |
                               +---------------------------+
                                        |
                                        | merchant prints each stream
                                        | on its routed printer
                                        v
                               +---------------------------+
                               |  Bin shelf (numbered)     |
                               |  token lookup -> COLLECTED|
                               +---------------------------+
```

After collection, `cleanup_files` Edge Function (every 15 min) deletes the source PDFs from Storage 30 minutes after `collected_at` or 4 hours after `slot_time`, whichever fires first.

## 4. Bundler

The bundler is the heart of the system. See `src/lib/bundler.ts` and the 10 integration tests in `tests/bundler.test.ts`.

### 4.1 What it produces

For each `print_batch`, the bundler emits **1 to 6 mega-PDFs**, one per stream. A stream is identified by:

```
streamKey = (paperType, paperSize, colorBucket)
          = bw_a4 | color_a4 | bw_a3 | color_a3 | poster_a4 | poster_a2
```

Each mega-PDF concatenates jobs in token order. For each job, the layout is:

```
[ cover ] [ content ] [ tail ]
   |          |          |
   +-- right + top black L-band marker (tactile boundary)
              |
              +-- pages from this job's files that hit this stream
```

### 4.2 The duplex-padding trick

This is the load-bearing detail that makes physical handling reliable.

**Always-duplex-with-blank-padding rule.** When a stream's routed printer supports duplex (long-edge), the bundler treats the whole stream as duplex and **inserts blanks** so that:

- Each cover and each tail gets a blank back side.
- Files marked `sides=SINGLE` are interleaved with blank backs (so they print one-sided despite running through a duplex stream).
- Files marked `sides=DOUBLE` with an odd page count get one blank pad to land on an even sheet boundary.
- Each job ends on an even sheet boundary, guaranteeing the next job's cover lands on a fresh sheet front.

Why: this lets a merchant load one duplex job into the printer for an entire stream and walk away. Without the blank padding, single-sided files inside a duplex stream would smear bleed-through onto the next file's first page.

**Cover/tail boundary marker.** Each cover and tail page carries a right-edge + top-edge black band that forms an L-shape. After printing, a merchant fans the stack and the L-shapes are visible from any angle — no need to flip every sheet to find boundaries. Stack-order independence is critical because face-down stacking and reversed-output trays both happen in the wild.

### 4.3 Posters never carry covers

A4/A2 glossy poster paper is expensive and shouldn't be wasted on cover sheets. Rules:

- **Covers go on the closest matching plain stream** (priority: `bw_a4`, `color_a4`, `bw_a3`, `color_a3`).
- If a job is **poster-only** (no plain content at all), the bundler synthesizes a **stub `bw_a4` stream** that carries just the cover and tail for that job. The merchant gets a single A4 sheet that pairs with the poster output to identify the job at the bin.

### 4.4 Stack-order independence

Tokens determine bin assignment up-stream (sorted, then assigned to bins 1..N round-robin). The cover for each job repeats:

- Token (e.g. `A-014`)
- Bin number
- Slot time
- Stream label (e.g. "Plain · A4 · B&W")
- File manifest (filenames + page counts that hit *this* stream)
- Other streams the same job touches (so the merchant knows to look elsewhere too)
- A QR code that decodes to `{ token, jobId, batchId }`

Combined with the L-band markers, this means even if the merchant accidentally interleaves two batches, every page can be traced back to a token + bin without rereading the file.

## 5. Pricing model walkthrough

All amounts are stored as **paise (integers)** in Postgres and the API layer. See `src/lib/pricing.ts`.

### 5.1 Plain paper

```
plain_per_side_cost = pricing.plain[paper_size][color_bucket].per_side_paise
duplex_discount     = pricing.plain.duplex_discount_paise_per_sheet
```

For a `DOUBLE`-sided file printed on a duplex-capable stream:

```
sides_charge = pages_count * plain_per_side_cost
             - sheets_count * duplex_discount
```

For a `SINGLE`-sided file (or any file routed through a non-duplex printer):

```
sides_charge = pages_count * plain_per_side_cost
```

`sheets_count = ceil(pages_count / 2)` for duplex, `pages_count` for simplex.

### 5.2 Posters

Charged **per sheet**, not per side. `POSTER_GLOSSY` is always `sides=SINGLE` and `layout=1`:

```
poster_charge = sheets_count * pricing.poster[paper_size][color_bucket].per_sheet_paise
```

### 5.3 Premium and GST

Each shop has a `premium_percent` (default 25%) baked into the cover line:

```
premium_amount = round_bankers(subtotal * premium_percent / 100)
```

If the shop has `gst_enabled = true`:

```
gst_amount = round_bankers((subtotal + premium_amount) * gst_percent / 100)
```

Both `premium_amount_paise` and `gst_amount_paise` are persisted on the job for audit.

### 5.4 Banker's rounding

All multiplicative pricing operations use **banker's rounding** (round half to even) to keep cumulative drift at zero across thousands of jobs:

```
round_bankers(2.5) -> 2
round_bankers(3.5) -> 4
round_bankers(0.5) -> 0
```

## 6. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | RSC + edge-friendly routes |
| Language | TypeScript strict | non-negotiable for money + bundler |
| UI | Tailwind + custom token system | editorial hairline aesthetic |
| Auth + DB + Storage | Supabase (ap-south-1) | Mumbai region for Indian users |
| Payments | Razorpay (INR) | required for Indian merchants |
| PDF engine | pdf-lib | portable PDF surgery |
| Image engine | @napi-rs/canvas | fast HEIC fallback + cover renderer |
| PWA | next-pwa | offline shell + cached past jobs |
| QR | qrcode | cover QR payloads |
| Forms | react-hook-form + zod | schema-validated client + server |
| Tests | vitest | fast, native ESM |

Optional: `twilio` (5.3.6) lives as an `optionalDependencies` entry behind `FEATURE_SMS_ENABLED`.

## 7. Setup steps

A green-field deploy of `printswipe.in` from a clean GitHub repo to a live PWA at the apex domain.

### 7.1 Namecheap → Cloudflare nameservers

1. Buy `printswipe.in` at namecheap.com (or any registrar).
2. Sign up at cloudflare.com, add `printswipe.in` as a free site.
3. Cloudflare assigns two nameservers (e.g. `kim.ns.cloudflare.com`, `walt.ns.cloudflare.com`).
4. In Namecheap → Domain List → Manage `printswipe.in` → Nameservers → **Custom DNS** → paste both Cloudflare nameservers.
5. Save. Propagation typically takes 15 minutes to 24 hours; Cloudflare sends an email when DNS is active.

### 7.2 Cloudflare DNS records for printswipe.in

In Cloudflare → `printswipe.in` → DNS → Records, add:

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | Proxied (orange cloud ON) | Auto |
| CNAME | `www` | `cname.vercel-dns.com` | Proxied | Auto |
| TXT | `_vercel` | `vc-domain-verify=...` (from Vercel) | DNS-only | Auto |

Then in Cloudflare:

- **SSL/TLS → Overview**: set encryption mode to **Full (strict)**.
- **SSL/TLS → Edge Certificates**: enable **Always Use HTTPS**.
- **Speed → Optimization**: enable **Auto Minify** for HTML, CSS, JS.
- **Speed → Optimization**: enable **Brotli**.

### 7.3 Vercel deployment

1. Push the repo to GitHub.
2. vercel.com → Add New → Project → Import the GitHub repo.
3. Framework preset: **Next.js**. Build command: `pnpm build`. Output: default.
4. Environment variables: copy each entry from `.env.example` into Vercel → Settings → Environment Variables (Production, Preview).
5. Settings → Domains → add `printswipe.in` and `www.printswipe.in`. Vercel will display the verification TXT record (paste this into the Cloudflare TXT record from 7.2).
6. Vercel issues a Let's Encrypt certificate within a few minutes. Promote the latest deployment to Production.

### 7.4 Supabase setup (Mumbai region, ap-south-1)

1. supabase.com → New Project → Region: **South Asia (Mumbai)**.
2. Local: install Supabase CLI (`brew install supabase/tap/supabase`).
3. Link the local project: `supabase link --project-ref <ref>`.
4. Apply migrations:

   ```bash
   supabase db push
   ```

5. Seed campuses, shops, merchants, demo students:

   ```bash
   pnpm seed
   ```

6. Pull keys from Supabase → Settings → API and add them to Vercel:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to client)

7. Deploy Edge Functions:

   ```bash
   supabase functions deploy cleanup_files --no-verify-jwt
   supabase functions deploy slot_expiry   --no-verify-jwt
   ```

8. Schedule via Supabase dashboard → Database → **Cron**:

   - Job `cleanup_files`: every 15 minutes — call the function URL with the service role bearer token.
   - Job `slot_expiry`: every 5 minutes — call the function URL with the service role bearer token.

   Equivalent SQL via `pg_cron` + `pg_net`:

   ```sql
   select cron.schedule(
     'cleanup_files_15m', '*/15 * * * *',
     $$ select net.http_post(
          url := 'https://<ref>.functions.supabase.co/cleanup_files',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          )
        ) $$
   );

   select cron.schedule(
     'slot_expiry_5m', '*/5 * * * *',
     $$ select net.http_post(
          url := 'https://<ref>.functions.supabase.co/slot_expiry',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          )
        ) $$
   );
   ```

### 7.5 Razorpay

1. Sign up at razorpay.com (test mode requires no KYC).
2. Dashboard → Settings → **API Keys** → Generate Test Key. Copy `Key ID` and `Key Secret`.
3. Set in Vercel:

   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same as `RAZORPAY_KEY_ID`)

4. Dashboard → Settings → **Webhooks** → Add Webhook:

   - URL: `https://printswipe.in/api/payment/webhook`
   - Events: `payment.captured`, `payment.failed`, `refund.processed`
   - Set a strong webhook secret. Copy it to Vercel as `RAZORPAY_WEBHOOK_SECRET`.

5. **Going live**: complete KYC (PAN, GST, bank, business proof). Razorpay activates Live Mode → swap `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the webhook secret with Live values. Retest end-to-end with a real INR 1 transaction before announcing.

## 8. Razorpay test cards

Razorpay test mode (no KYC needed):

| Outcome | Card number | Expiry | CVV |
|---|---|---|---|
| Success | `4111 1111 1111 1111` | any future MM/YY | any 3-digit CVV |
| Failure | `4000 0000 0000 0002` | any future MM/YY | any 3-digit CVV |

UPI test handle: `success@razorpay` (success), `failure@razorpay` (failure).

## 9. PWA install instructions

The app declares a manifest at `/manifest.json` and registers a service worker via `next-pwa`. To install:

### 9.1 Android Chrome

1. Open `https://printswipe.in` in Chrome.
2. Tap the three-dot menu in the top-right.
3. Tap **Install app** (or **Add to Home screen**).

### 9.2 iOS Safari

1. Open `https://printswipe.in` in Safari (not Chrome — iOS only allows PWA installs from Safari).
2. Tap the **Share** button.
3. Scroll down and tap **Add to Home Screen**.

### 9.3 Desktop Chrome / Edge

1. Open `https://printswipe.in`.
2. Look for the install icon in the address bar (a small monitor with a downward arrow).
3. Click it and choose **Install**.

Once installed, the PWA opens standalone, caches static assets, and falls back to `/offline` for navigation requests when the network is down.

## 10. Merchant onboarding checklist

Before a shop goes live:

- [ ] Verify all plain-paper printers are configured for **duplex (double-sided), long-edge** as the default.
- [ ] Verify the printer driver setting **"Skip blank pages"** is **OFF** — Printswipe inserts blanks intentionally for duplex padding. If the driver skips them, single-sided files will smear bleed-through onto the next job's first page.
- [ ] Confirm the printer's output direction. Face-down stacking is the standard assumption; if the printer face-up stacks, that is fine — the L-band cover/tail markers are stack-order independent, but the merchant should know the convention so bins fill in the expected direction.
- [ ] Test print one batch end-to-end (book a demo student job, mark paid via Razorpay test card, bundle, print all streams, and verify bin assignment matches the cover token).
- [ ] Set up the bin shelf with **numbered cubbies** matching the shop's `bin_count` (set during seed/admin config). Use bold black-on-white labels — the same typeface as the cover tokens.
- [ ] In the merchant app → Settings → Printer Routing, confirm each stream (`bw_a4`, `color_a4`, `bw_a3`, `color_a3`, `poster_a4`, `poster_a2`) maps to the correct physical printer.
- [ ] If the shop offers posters: load glossy stock in the poster printer's tray and confirm `poster_a4` and `poster_a2` route there (not to the plain printer).
- [ ] Walk the merchant through the **Bundle → Print → Mark Printed → Token Lookup → Mark Collected** flow at least twice with pretend students.

## 11. Known limits and v2 roadmap

- **No partial bundling resumption.** Once a batch is bundled, all jobs in it are committed; you cannot remove a single job mid-batch. Workaround: refund and rebook.
- **SMS is feature-flagged.** The Twilio integration sits behind `FEATURE_SMS_ENABLED=false`. When enabled, the app sends "Your prints are ready" notifications. Default off because Twilio India needs DLT registration.
- **Reports page is scaffold-only.** `/merchant/reports` shows a placeholder. Aggregation queries (daily revenue, page counts by stream, top files) are written but unwired.
- **No multi-merchant per shop.** The `merchants` join table supports it at the schema level, but the UI assumes a single signed-in merchant per shop session. v2 will add merchant handoff during the bundle flow.
- **Refund is admin-only.** The 10% admin fee is enforced server-side; there's no student-initiated refund button. Students email support and an admin processes the refund through the Razorpay dashboard, then the audit trail is reconciled by the `refund.processed` webhook.

## 12. Test suite

```bash
pnpm test            # full vitest run
pnpm test:bundler    # 10 bundler edge cases (target file: tests/bundler.test.ts)
```

The bundler tests cover:

1. Single B&W A4 duplex job (cover + content + tail, all blanks padded)
2. Color simplex file routed through a duplex stream (blank backs interleaved)
3. Mixed BW + color file split into two streams of the same paper/size
4. Mixed-color file with `colorPagesSpec` honored on a per-page basis
5. Multi-job batch in token order with even-sheet padding between jobs
6. A2 poster + plain stub stream (poster-only job synthesizes a `bw_a4` cover host)
7. Non-A4 normalization via N-up layout (e.g. 2-up A3 → A4)
8. Encrypted PDF rejection (validation throws before bundling)
9. Copies multiplier (file with `copies=3` produces 3x content but only one cover/tail)
10. Non-duplex printer simplex stream (no blank padding, all sides simplex)

CI runs `pnpm lint && pnpm typecheck && pnpm test:bundler && pnpm test` on every push and pull request via `.github/workflows/ci.yml`.

## 13. License

MIT. See `LICENSE` (or apply MIT terms in the project root). Built for campus print shops in India that want their queue to stop being a queue.
