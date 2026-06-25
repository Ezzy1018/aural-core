/* ============================================================
   Aural Core — script.js
   Scroll-driven image-sequence hero + GSAP ScrollTrigger
   Plain JS · No build step · Works with python -m http.server
   ============================================================ */

/* ─── CONFIG ─────────────────────────────────────────────── */
const CONFIG = {
  /*
    frameCount: 240 frames extracted from video.mp4 at 24fps (10s clip).
    Frames live in /frames/ as frame_0001.jpg → frame_0240.jpg
    ----------------------------------------------------------------
    Extracted with:
      ffmpeg -i video/video.mp4 -vf "fps=24,scale=1280:-1:flags=lanczos" \
             -q:v 3 frames/frame_%04d.jpg
  */
  frameCount: 240,

  /* Path builder — matches the extracted .jpg naming */
  framePath: (i) => `frames/frame_${String(i).padStart(4, "0")}.jpg`,

  /*
    background: sampled from top corners of frame_0001.jpg → #737373
    This is the neutral grey of the video backdrop.
    Painted behind each frame so canvas edges are invisible.
  */
  background: "#737373",

  /*
    fit: how the frame image is sized onto the canvas.
    "contain" — whole product always visible (recommended)
    "cover"   — fills the full viewport (some cropping)
  */
  fit: "cover",

  /*
    scrub: GSAP scrub value (seconds of lag behind scroll).
    0.6 gives a silky, slightly weighted feel on 240 frames.
  */
  scrub: 0.6,
};

/* ─── STATIC FALLBACK IMAGES ────────────────────────────── */
/*
  When frameCount === 0 (no video frames extracted yet), the page
  uses these three product shots to drive the scroll sequence,
  crossfading between them at scroll progress thresholds.
  (Currently unused since frameCount = 240, but kept for reference.)
*/
const STATIC_SCENES = [
  { src: "images/product-white.webp",    threshold: 0   },
  { src: "images/product-exploded.webp", threshold: 0.4 },
  { src: "images/product-black.webp",    threshold: 0.8 },
];

/* ─── DOM references ────────────────────────────────────── */
const canvas      = document.getElementById("heroCanvas");
const ctx         = canvas.getContext("2d", { alpha: false });
const loader      = document.getElementById("loader");
const loaderFill  = document.getElementById("loaderFill");
const loaderPct   = document.getElementById("loaderPct");
const loaderTrack = document.getElementById("loaderTrack");
const fallbackEl  = document.getElementById("heroFallback");
const scrollHint  = document.getElementById("scrollIndicator");
const progressFill = document.getElementById("heroProgress");
const mainNav     = document.getElementById("mainNav");
const hamburger   = document.getElementById("navHamburger");
const mobileMenu  = document.getElementById("mobileMenu");

const copies = Array.from(document.querySelectorAll(".copy"));
const reveals = Array.from(document.querySelectorAll("[data-reveal]"));

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── STATE ─────────────────────────────────────────────── */
let frames       = [];      // preloaded frame Image objects
let staticImages = [];      // preloaded static scene Image objects
let loaded       = 0;
let currentFrame = 0;
let usingStatic  = false;
let currentStaticIndex = -1;

/* ═══════════════════════════════════════════════════════════
   PRELOADING
   ═══════════════════════════════════════════════════════════ */

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null); // don't block on missing assets
    img.src = src;
  });
}

async function preload() {
  if (CONFIG.frameCount > 0) {
    /* ─ Frame sequence mode ─ */
    usingStatic = false;
    const total = CONFIG.frameCount;
    const batchSize = 10;

    for (let i = 1; i <= total; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        loaded++;
        const pct = Math.round((loaded / total) * 100);
        loaderFill.style.width = pct + "%";
        loaderPct.textContent  = pct + "%";
        loaderTrack.setAttribute("aria-valuenow", pct);
      };
      img.src = CONFIG.framePath(i);
      frames[i - 1] = img;

      // Brief yield every batch so the browser can paint progress
      if (i % batchSize === 0) await new Promise(r => setTimeout(r, 0));
    }

    // Wait until all loaded/errored
    await new Promise((resolve) => {
      const check = () => (loaded >= total ? resolve() : setTimeout(check, 50));
      check();
    });

  } else {
    /* ─ Static image fallback mode ─ */
    usingStatic = true;
    const total = STATIC_SCENES.length;

    for (let i = 0; i < total; i++) {
      const img = await loadImage(STATIC_SCENES[i].src);
      staticImages[i] = img;
      const pct = Math.round(((i + 1) / total) * 100);
      loaderFill.style.width = pct + "%";
      loaderPct.textContent  = pct + "%";
      loaderTrack.setAttribute("aria-valuenow", pct);
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   CANVAS RENDERING
   ═══════════════════════════════════════════════════════════ */

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w   = canvas.clientWidth;
  const h   = canvas.clientHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (usingStatic) {
    renderStaticAt(currentStaticIndex < 0 ? 0 : currentStaticIndex);
  } else {
    renderFrame(currentFrame);
  }
}

function drawImageFit(img, w, h) {
  if (!img || !img.complete || !img.naturalWidth) return;

  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw, dh;
  const cover = CONFIG.fit === "cover";
  if (cover ? ir > cr : ir < cr) {
    dh = h; dw = h * ir;
  } else {
    dw = w; dh = w / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/* ─ Frame-sequence render ─ */
function renderFrame(index) {
  currentFrame = Math.max(0, Math.min(CONFIG.frameCount - 1, index | 0));
  const img = frames[currentFrame];
  const w   = canvas.clientWidth;
  const h   = canvas.clientHeight;

  ctx.fillStyle = CONFIG.background;
  ctx.fillRect(0, 0, w, h);
  drawImageFit(img, w, h);
}

/* ─ Static crossfade render ─ */
function renderStaticAt(index, alpha = 1) {
  const w   = canvas.clientWidth;
  const h   = canvas.clientHeight;

  ctx.fillStyle = CONFIG.background;
  ctx.fillRect(0, 0, w, h);

  const img = staticImages[index];
  if (!img) return;

  ctx.globalAlpha = alpha;
  drawImageFit(img, w, h);
  ctx.globalAlpha = 1;
}

/*
  For static mode: smoothly crossfade between scenes based on scroll progress.
  Each scene has a threshold (0–1) marking when it becomes dominant.
*/
function renderStaticByProgress(progress) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = CONFIG.background;
  ctx.fillRect(0, 0, w, h);

  // Find which scene we're between
  let fromIdx = 0;
  let toIdx   = 0;
  let t       = 0; // 0 = fully from, 1 = fully to

  for (let i = 0; i < STATIC_SCENES.length - 1; i++) {
    const start = STATIC_SCENES[i].threshold;
    const end   = STATIC_SCENES[i + 1].threshold;
    if (progress >= start && progress <= end) {
      fromIdx = i;
      toIdx   = i + 1;
      // Ease the transition over 15% of the total scroll range
      const transitionWidth = 0.12;
      const transStart = end - transitionWidth;
      t = progress < transStart ? 0 : (progress - transStart) / transitionWidth;
      t = Math.min(1, Math.max(0, t));
      t = easeInOut(t);
      break;
    }
    if (progress > end) {
      fromIdx = toIdx = i + 1;
      t = 1;
    }
  }
  if (progress >= STATIC_SCENES[STATIC_SCENES.length - 1].threshold) {
    fromIdx = toIdx = STATIC_SCENES.length - 1;
    t = 1;
  }

  const from = staticImages[fromIdx];
  const to   = staticImages[toIdx];

  if (from) {
    ctx.globalAlpha = 1 - t;
    drawImageFit(from, w, h);
  }
  if (to && toIdx !== fromIdx) {
    ctx.globalAlpha = t;
    drawImageFit(to, w, h);
  }
  ctx.globalAlpha = 1;

  currentStaticIndex = t > 0.5 ? toIdx : fromIdx;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ═══════════════════════════════════════════════════════════
   COPY OVERLAYS
   Bands define [scrollStart, scrollEnd] per copy panel (0–1).
   ═══════════════════════════════════════════════════════════ */

const BANDS = [
  [0.00, 0.18], // Panel 0 — brand title
  [0.22, 0.42], // Panel 1 — left tagline
  [0.46, 0.68], // Panel 2 — right tagline
  [0.75, 1.00], // Panel 3 — CTA
];
const FADE = 0.06; // fraction of scroll range for fade in/out

function bandOpacity(p, start, end) {
  if (p <= start - FADE || p >= end + FADE) return 0;
  if (p < start) return (p - (start - FADE)) / FADE;
  if (p > end)   return 1 - (p - end) / FADE;
  return 1;
}

function updateCopy(progress) {
  copies.forEach((el, i) => {
    if (!BANDS[i]) return;
    const [s, e] = BANDS[i];
    const o = bandOpacity(progress, s, e);
    const drift = (1 - o) * 22; // px upward when invisible

    el.style.opacity = o;

    const isCenter = el.classList.contains("copy--center");
    const isLeft   = el.classList.contains("copy--left");
    const isRight  = el.classList.contains("copy--right");

    if (isCenter) {
      el.style.transform = `translate(-50%, calc(-50% + ${drift}px))`;
    } else if (isLeft || isRight) {
      el.style.transform = `translateY(calc(-50% + ${drift}px))`;
    }

    // Hide scroll hint once user has scrolled
    if (progress > 0.04 && scrollHint) {
      scrollHint.style.opacity = "0";
      scrollHint.style.pointerEvents = "none";
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   NAV SCROLL BEHAVIOUR
   ═══════════════════════════════════════════════════════════ */

function initNav() {
  const onScroll = () => {
    mainNav.classList.toggle("is-scrolled", window.scrollY > 60);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Hamburger toggle
  hamburger.addEventListener("click", () => {
    const open = hamburger.getAttribute("aria-expanded") === "true";
    hamburger.setAttribute("aria-expanded", String(!open));
    mobileMenu.classList.toggle("is-open", !open);
    mobileMenu.setAttribute("aria-hidden", String(open));
    document.body.style.overflow = open ? "" : "hidden";
  });

  // Close mobile menu on link click
  mobileMenu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      hamburger.setAttribute("aria-expanded", "false");
      mobileMenu.classList.remove("is-open");
      mobileMenu.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   SECTION REVEAL OBSERVER
   ═══════════════════════════════════════════════════════════ */

function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  reveals.forEach(el => io.observe(el));
}

/* ═══════════════════════════════════════════════════════════
   MAIN INIT
   ═══════════════════════════════════════════════════════════ */

async function init() {
  // Size canvas immediately so there's no flicker
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { passive: true });

  // Load all assets
  await preload();

  // Draw first frame/scene
  if (usingStatic) {
    renderStaticByProgress(0);
  } else {
    renderFrame(0);
  }

  updateCopy(0);

  // Hide loader
  loader.classList.add("is-hidden");

  // Init supporting UI
  initNav();
  initReveal();

  // Register GSAP plugin
  gsap.registerPlugin(ScrollTrigger);

  /* ─ Hero scroll animation ─ */
  const playhead = { frame: 0, progress: 0 };

  if (!usingStatic && CONFIG.frameCount > 0) {
    /* ── Frame-sequence mode ── */
    gsap.to(playhead, {
      frame: CONFIG.frameCount - 1,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom bottom",
        scrub: prefersReduced ? true : CONFIG.scrub,
        onUpdate(self) {
          updateCopy(self.progress);
          if (progressFill) progressFill.style.height = (self.progress * 100) + "%";
        },
      },
      onUpdate() {
        renderFrame(Math.round(playhead.frame));
      },
    });

  } else {
    /* ── Static crossfade mode ── */
    gsap.to(playhead, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom bottom",
        scrub: prefersReduced ? true : CONFIG.scrub,
        onUpdate(self) {
          updateCopy(self.progress);
          renderStaticByProgress(self.progress);
          if (progressFill) progressFill.style.height = (self.progress * 100) + "%";
        },
      },
    });
  }

  /* ─ Sub-section animations ─ */
  // Features section slide-in
  gsap.from(".features__text", {
    opacity: 0,
    x: -30,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".section--features",
      start: "top 80%",
      once: true,
    },
  });

  gsap.from(".features__media", {
    opacity: 0,
    x: 30,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".section--features",
      start: "top 80%",
      once: true,
    },
  });

  // Layer list items
  gsap.utils.toArray(".layer").forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      x: -20,
      duration: 0.55,
      delay: i * 0.1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        once: true,
      },
    });
  });

  // Variants slide in
  gsap.utils.toArray(".variant").forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      y: 40,
      scale: 0.96,
      duration: 0.8,
      delay: i * 0.15,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
  });

  // Spec rows stagger
  gsap.utils.toArray(".specs-table__row").forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      x: -16,
      duration: 0.45,
      delay: i * 0.05,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".specs-table",
        start: "top 85%",
        once: true,
      },
    });
  });

  // Engineering labels fade on image enter
  ScrollTrigger.create({
    trigger: ".engineering__img-wrap",
    start: "top 70%",
    onEnter: () => {
      document.querySelectorAll(".engineering__label").forEach((lbl, i) => {
        gsap.to(lbl, { opacity: 1, delay: 0.3 + i * 0.2, duration: 0.5 });
      });
    },
    once: true,
  });

  // CTA section entrance
  gsap.from(".cta__title", {
    opacity: 0,
    y: 40,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".section--cta",
      start: "top 80%",
      once: true,
    },
  });

  ScrollTrigger.refresh();
}

// Kick off
init();
