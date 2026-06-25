/* =========================================================
   Aural Core v2 — award-grade scroll experience
   GSAP + ScrollTrigger + Lenis. Plain JS, no build.
   ========================================================= */

const CONFIG = {
  frameCount: 240,                                   // frames in /frames
  framePath: (i) => `frames/frame_${String(i).padStart(4, "0")}.jpg`,
  background: "#eceae5",                              // MATCH your frame bg + --bg in CSS
  fit: "cover",                                      // "contain" or "cover"
};

const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

const canvas = document.getElementById("heroCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderCount = document.getElementById("loaderCount");
const copies = Array.from(document.querySelectorAll(".copy"));

const frames = [];
let loaded = 0;
let currentFrame = 0;

gsap.registerPlugin(ScrollTrigger);

/* ---------- Smooth scroll (Lenis) ---------- */
let lenis = null;
if (!prefersReduced && window.Lenis) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Preload frames (drives loader counter) ---------- */
function preload() {
  return new Promise((resolve) => {
    if (CONFIG.frameCount <= 0) return resolve();
    for (let i = 1; i <= CONFIG.frameCount; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        loaded++;
        const pct = Math.round((loaded / CONFIG.frameCount) * 100);
        loaderFill.style.width = pct + "%";
        loaderCount.textContent = pct;
        if (loaded === CONFIG.frameCount) resolve();
      };
      img.src = CONFIG.framePath(i);
      frames[i - 1] = img;
    }
  });
}

/* ---------- Canvas ---------- */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render(currentFrame);
}
function render(index) {
  currentFrame = Math.max(0, Math.min(CONFIG.frameCount - 1, index | 0));
  const img = frames[currentFrame];
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.fillStyle = CONFIG.background;
  ctx.fillRect(0, 0, w, h);
  if (!img || !img.complete || !img.naturalWidth) return;
  const ir = img.naturalWidth / img.naturalHeight, cr = w / h;
  const cover = CONFIG.fit === "cover";
  let dw, dh;
  if (cover ? ir > cr : ir < cr) { dh = h; dw = h * ir; }
  else { dw = w; dh = w / ir; }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/* ---------- Hero copy bands ---------- */
const BANDS = [[0.0, 0.18], [0.22, 0.42], [0.48, 0.7], [0.78, 1.0]];
function band(p, s, e, fade = 0.05) {
  if (p <= s - fade || p >= e + fade) return 0;
  if (p < s) return (p - (s - fade)) / fade;
  if (p > e) return 1 - (p - e) / fade;
  return 1;
}
function updateCopy(p) {
  copies.forEach((el, i) => {
    const [s, e] = BANDS[i];
    const o = band(p, s, e);
    const shift = (1 - o) * 26;
    el.style.opacity = o;
    if (el.classList.contains("copy--center")) {
      el.style.transform = `translate(-50%, calc(-50% + ${shift}px))`;
    } else {
      el.style.transform = `translateY(${shift}px)`;
    }
  });
}

/* ---------- Custom cursor ---------- */
function initCursor() {
  const cursor = document.querySelector(".cursor");
  if (!cursor || !finePointer) return;
  let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
  addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });
  gsap.ticker.add(() => {
    cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  });
  document.querySelectorAll("[data-cursor]").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
  });
}

/* ---------- Magnetic buttons ---------- */
function initMagnetic() {
  if (!finePointer) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.3, y: (e.clientY - (r.top + r.height / 2)) * 0.4, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" }));
  });
}

/* ---------- Scroll reveals + progress + hero scrub ---------- */
function initScroll() {
  // Progress bar
  gsap.to(".progress__bar", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });

  // Line-mask reveals
  const lines = gsap.utils.toArray(".r-line");
  if (prefersReduced) {
    gsap.set(lines, { yPercent: 0, opacity: 1 });
  } else {
    lines.forEach((line) => {
      gsap.set(line, { yPercent: 115 });
      ScrollTrigger.create({
        trigger: line,
        start: "top 88%",
        once: true,
        onEnter: () => gsap.to(line, { yPercent: 0, duration: 1.1, ease: "expo.out" }),
      });
    });
  }

  // Hero frame scrub
  const playhead = { frame: 0 };
  gsap.to(playhead, {
    frame: CONFIG.frameCount - 1,
    ease: "none",
    snap: "frame",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom bottom",
      scrub: prefersReduced ? true : 0.6,
      onUpdate: (self) => updateCopy(self.progress),
    },
    onUpdate: () => render(Math.round(playhead.frame)),
  });
}

/* ---------- Seal Loading ---------- */
async function loadSeal() {
  const container = document.getElementById("seal");
  if (!container) return;
  try {
    const res = await fetch("images/Asset.svg");
    const svgText = await res.text();
    container.innerHTML = svgText;
    
    const svg = container.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("class", "seal__svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    
    // Wrap direct child path elements in a rotating group class seal__text
    const svgPaths = Array.from(svg.children).filter(el => el.tagName.toLowerCase() === "path");
    if (svgPaths.length > 0) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "seal__text");
      svgPaths[0].parentNode.insertBefore(g, svgPaths[0]);
      svgPaths.forEach(path => g.appendChild(path));
    }
  } catch (err) {
    console.error("Failed to load seal asset:", err);
  }
}

/* ---------- Boot ---------- */
async function init() {
  // Load seal badge first
  await loadSeal();

  resizeCanvas();
  addEventListener("resize", resizeCanvas, { passive: true });
  initCursor();
  initMagnetic();

  await preload();
  render(0);
  updateCopy(0);
  initScroll();

  // Loader exit + first reveal
  const heroLine = document.querySelector(".hero__title .r-line");
  const tl = gsap.timeline();
  tl.to(loader, { opacity: 0, duration: 0.8, ease: "expo.out", onComplete: () => loader.classList.add("is-hidden") });
  if (heroLine && !prefersReduced) {
    gsap.set(heroLine, { yPercent: 115 });
    tl.to(heroLine, { yPercent: 0, duration: 1.2, ease: "expo.out" }, "-=0.3");
  }
  ScrollTrigger.refresh();
}

init();
