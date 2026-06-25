# Aural Core — Scroll-Driven Product Landing Page

Plain HTML / CSS / GSAP. No build step, no npm, no dependencies.

## Run locally

Frames and images load via fetch — **do not open `index.html` directly** via `file://`.
Use any local static server:

```bash
# Python 3 (built-in)
cd aural-core
python -m http.server 8000
# → open http://localhost:8000

# Node (if you have it)
npx -y serve .
```

---

## Upgrading to a full frame sequence (optional but recommended)

The site ships in **static-crossfade mode** — it uses the three product images
and crossfades between them as you scroll. This looks great for a prototype.

To upgrade to **frame-sequence mode** (Apple/Linear style scrubbing):

### Step 1 — Export frames from your clip

```bash
# From your Flow / Sora video:
ffmpeg -i your-clip.mp4 \
  -vf "fps=24,scale=1600:-1:flags=lanczos" \
  frames/frame_%04d.webp
```

Count the output files:
```bash
ls frames/ | wc -l
```

### Step 2 — Configure `js/script.js`

Open `js/script.js` and set the two values at the top:

```js
const CONFIG = {
  frameCount: 120,          // ← set to your actual frame count
  background: "#e8e4df",    // ← sample the bg hex from one of your frames
  ...
};
```

That's it. Refresh the page and you have full frame-scrubbing.

---

## Background colour matching

The `CONFIG.background` value (and the `--bg` CSS variable in `css/style.css`)
must **exactly match** the background colour of your frames/images so the
canvas edges are invisible.

- Light variant: `#e8e4df` (warm off-white — default)
- Dark variant: change `--bg` in CSS to `#1c1c1e` and `CONFIG.background` to the same

---

## Swapping in your own images

Drop replacements into `images/`:

| Filename | Used for |
|---|---|
| `product-white.webp` | Hero (panel 1) + Variants section |
| `product-exploded.webp` | Hero (panel 2) + Engineering section |
| `product-black.webp` | Hero (panel 3) + Variants section |

Any format works (PNG, WEBP, JPG) — just update the `src` paths in `index.html`
and the `STATIC_SCENES` array in `js/script.js`.

---

## Performance tips

- Keep frames at ≤ 1600px wide. WebP keeps payload light.
- 60–120 frames is the sweet spot for scroll feel vs. file size.
- If scroll feels heavy, lower fps: `fps=18` in the ffmpeg command.
- For mobile you can serve a separate, smaller frame set or keep static mode.

---

## Customising copy text

Edit the `.copy` blocks in `index.html`. Timing (when each panel fades in/out)
is controlled by the `BANDS` array in `js/script.js`:

```js
const BANDS = [
  [0.00, 0.18], // Panel 0 — brand title (appears 0%→18% scroll)
  [0.22, 0.42], // Panel 1 — left tagline
  [0.46, 0.68], // Panel 2 — right tagline
  [0.75, 1.00], // Panel 3 — CTA
];
```

Values are scroll progress from 0 (top of hero) to 1 (bottom of hero).

---

© 2025 Aural Core. A concept landing page.
