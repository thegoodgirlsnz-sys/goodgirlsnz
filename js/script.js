/* ============================================================
   GOOD GIRLS — js/script.js
   Data-driven service/therapist model (§62) + all interactions
   Updated to map 8 local portrait images
   ============================================================ */

/* ---------- Reusable data model (extend here to add ladies/services) ---------- */
const SERVICES = [
  {
    slug: "relaxation-massage",
    name: "Relaxation Massage",
    flag: "Signature",
    short: "A slow, unhurried full-body massage designed to quiet the mind and melt everyday tension.",
    duration: "60 min",
    price: 95,
    image: "images/2.jpg", /* Card Image */
    includes: ["Full-body Swedish massage", "Warm oil of your choice", "Hot-towel finish", "Private, climate-controlled suite"],
    therapist: {
      name: "Amara Vale",
      tag: "Certified relaxation specialist",
      experience: "8 years",
      height: "5'6\" · 168 cm",
      eyes: "Hazel",
      skin: "Fair",
      figure: "Athletic",
      about: "Amara specialises in slow, rhythmic Swedish techniques that ease the nervous system as much as the muscles. Her sessions are calm and unhurried, shaped around your pressure preferences, with warm oils and a hot-towel finish to close. Guests consistently describe leaving her room feeling lighter, quieter and completely reset.",
      images: [
        "images/5.jpg", /* Gallery Image 1 */
        "images/6.jpg", /* Gallery Image 2 */
        "images/7.jpg"  /* Gallery Image 3 */
      ]
    }
  },
  {
    slug: "deep-tissue-massage",
    name: "Deep Tissue Massage",
    flag: "",
    short: "Focused, firm pressure that works into deeper muscle layers to release knots and chronic tension.",
    duration: "60 min",
    price: 110,
    image: "images/3.jpg", /* Card Image */
    includes: ["Targeted deep-muscle work", "Pressure matched to you", "Focus areas of your choice", "Aftercare stretching advice"],
    therapist: {
      name: "Sofia Renn",
      tag: "Deep tissue & sports specialist",
      experience: "10 years",
      height: "5'8\" · 172 cm",
      eyes: "Brown",
      skin: "Olive",
      figure: "Toned",
      about: "With a decade of clinical and sports-massage experience, Sofia reads tension precisely and works with firm, deliberate pressure. She focuses on the areas that hold the most stress — shoulders, back, hips — and always adjusts depth to your comfort. Expect thorough, results-driven bodywork delivered with a warm, professional manner.",
      images: [
        "images/6.jpg", /* Gallery Image 1 */
        "images/7.jpg", /* Gallery Image 2 */
        "images/8.jpg"  /* Gallery Image 3 */
      ]
    }
  },
  {
    slug: "aromatherapy-ritual",
    name: "Aromatherapy Ritual",
    flag: "",
    short: "An essential-oil journey pairing a bespoke blend with flowing massage and a soothing scalp ritual.",
    duration: "75 min",
    price: 125,
    image: "images/4.jpg", /* Card Image */
    includes: ["Personalised essential-oil blend", "Full-body aromatherapy massage", "Scalp & neck ritual", "Blend sample to take home"],
    therapist: {
      name: "Elena Marsh",
      tag: "Certified aromatherapist",
      experience: "6 years",
      height: "5'5\" · 165 cm",
      eyes: "Green",
      skin: "Fair",
      figure: "Soft",
      about: "Elena blends her own oils and tailors every ritual to your mood and needs — grounding, uplifting or deeply calming. Her massage style is fluid and enveloping, finishing with a slow scalp ritual that many guests call the highlight. A small sample of your blend goes home with you, extending the calm beyond the studio.",
      images: [
        "images/7.jpg", /* Gallery Image 1 */
        "images/8.jpg", /* Gallery Image 2 */
        "images/5.jpg"  /* Gallery Image 3 */
      ]
    }
  },
  {
    slug: "hot-stone-therapy",
    name: "Hot Stone Therapy",
    flag: "",
    short: "Heated basalt stones glide warmth deep into the muscles — our most indulgent, deeply warming session.",
    duration: "90 min",
    price: 140,
    image: "images/8.jpg", /* Card Image */
    includes: ["Heated basalt stone massage", "Warm oil application", "Extended 90-minute session", "Herbal tea & quiet rest after"],
    therapist: {
      name: "Mia Laurent",
      tag: "Hot stone & wellness specialist",
      experience: "9 years",
      height: "5'7\" · 170 cm",
      eyes: "Blue",
      skin: "Medium",
      figure: "Elegant",
      about: "Mia trained extensively in stone therapy and paces her sessions like a slow ritual — stones placed, glided and rested exactly where warmth is needed most. The result is a deeply soothing, almost meditative experience. She closes each session with herbal tea and unhurried rest time, so you never have to rush back into the day.",
      images: [
        "images/5.jpg", /* Gallery Image 1 */
        "images/6.jpg", /* Gallery Image 2 */
        "images/8.jpg"  /* Gallery Image 3 */
      ]
    }
  }
];

/* ---------- Helpers ---------- */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const param = new URLSearchParams(location.search).get("service");
const findService = slug => SERVICES.find(s => s.slug === slug) || SERVICES[0];

/* ---------- Service card renderer ---------- */
function cardHTML(s, extraClass = "") {
  return `
  <a class="svc-card ${extraClass}" href="service-details.html?service=${s.slug}" data-reveal>
    <div class="svc-media">
      <img src="${s.image}" alt="${s.name} at Good Girls" loading="lazy">
      <span class="svc-badge">From $${s.price}</span>
      ${s.flag ? `<span class="svc-flag">${s.flag}</span>` : ""}
    </div>
    <div class="svc-body">
      <h3>${s.name}</h3>
      <p>${s.short}</p>
      <div class="svc-foot">
        <span class="dur">${s.duration} · ${s.therapist.name}</span>
        <span class="view">View Details →</span>
      </div>
    </div>
  </a>`;
}

/* ---------- Scroll reveal ---------- */
let revealObserver;
function initReveal(scope = document) {
  const items = $$("[data-reveal]:not(.is-visible)", scope);
  if (prefersReduced || !("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("is-visible"));
    return;
  }
  revealObserver = revealObserver || new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const d = e.target.getAttribute("data-reveal-delay");
        if (d) e.target.style.transitionDelay = d + "ms";
        e.target.classList.add("is-visible");
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  items.forEach(el => revealObserver.observe(el));
}

/* ---------- Header / progress / to-top ---------- */
function initChrome() {
  const header = $(".site-header");
  const bar = $(".progress-bar");
  const top = $(".to-top");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-solid", y > 30);
    if (bar) {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
    if (top) top.classList.toggle("show", y > 600);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (top) top.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" }));
}

/* ---------- Mobile nav ---------- */
function initMenu() {
  const burger = $(".burger");
  const panel = $("#mobileNav");
  if (!burger || !panel) return;
  const set = open => {
    document.body.classList.toggle("nav-open", open);
    burger.setAttribute("aria-expanded", open);
    panel.setAttribute("aria-hidden", !open);
  };
  burger.addEventListener("click", () => set(!document.body.classList.contains("nav-open")));
  $$("a", panel).forEach(a => a.addEventListener("click", () => set(false)));
  addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
}

/* ---------- Home / services grids ---------- */
function renderGrids() {
  const home = $("#homeServices");
  if (home) {
    home.innerHTML = SERVICES.map((s, i) =>
      cardHTML(s, i === SERVICES.length - 1 ? "svc-card--feature" : "")).join("");
  }
  const all = $("#allServices");
  if (all) all.innerHTML = SERVICES.map(s => cardHTML(s)).join("");
}

/* ---------- Service details + gallery ---------- */
function renderDetails() {
  const nameEl = $("#ladyName");
  if (!nameEl) return;
  const s = param ? findService(param) : SERVICES[0];
  const t = s.therapist;

  document.title = `${s.name} — ${t.name} | Good Girls`;
  $("#crumbService").textContent = s.name;
  nameEl.textContent = t.name;
  $("#ladyTag").textContent = t.tag;
  $("#ladyAbout").textContent = t.about;
  $("#svcName").textContent = s.name;
  $("#svcDuration").textContent = s.duration;
  $("#svcPrice").textContent = "$" + s.price;
  $("#svcIncludes").innerHTML = s.includes.map(i => `<li>${i}</li>`).join("");
  $("#svcBookBtn").href = `booking.html?service=${s.slug}`;

  $("#ladyInfo").innerHTML = [
    ["Name", t.name], ["Experience", t.experience], ["Height", t.height],
    ["Eye Colour", t.eyes], ["Skin Colour", t.skin], ["Body Figure", t.figure]
  ].map(([l, v]) => `<div><span class="ii-label">${l}</span><span class="ii-value">${v}</span></div>`).join("");

  /* Prev / next service */
  const idx = SERVICES.indexOf(s);
  const prev = SERVICES[(idx - 1 + SERVICES.length) % SERVICES.length];
  const next = SERVICES[(idx + 1) % SERVICES.length];
  const p = $("#prevService"), n = $("#nextService");
  p.href = `service-details.html?service=${prev.slug}`;
  n.href = `service-details.html?service=${next.slug}`;
  $("#prevServiceName").textContent = prev.name;
  $("#nextServiceName").textContent = next.name;

  initGallery(t.images.map((src, i) => ({ src, alt: `${t.name} — photo ${i + 1} of 3` })));
}

function initGallery(slides) {
  const track = $("#galleryTrack"), viewport = $("#galleryViewport");
  const dotsWrap = $("#galleryDots"), cur = $("#galCur");
  if (!track) return;
  const n = slides.length;
  $("#galTotal").textContent = String(n).padStart(2, "0");

  track.innerHTML = slides.map(s =>
    `<div class="gallery-slide"><img src="${s.src}" alt="${s.alt}" loading="lazy"></div>`).join("");
  dotsWrap.innerHTML = slides.map((_, i) =>
    `<button role="tab" aria-label="Show image ${i + 1}"></button>`).join("");
  const dots = $$("button", dotsWrap);

  let i = 0, timer = null;
  function go(k) {
    i = (k + n) % n;
    track.style.transform = `translateX(-${i * 100}%)`;
    cur.textContent = String(i + 1).padStart(2, "0");
    dots.forEach((d, di) => d.classList.toggle("active", di === i));
  }
  function play() {
    if (prefersReduced) return;
    stop();
    timer = setInterval(() => go(i + 1), 4500);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  $("#galPrev").addEventListener("click", () => { go(i - 1); play(); });
  $("#galNext").addEventListener("click", () => { go(i + 1); play(); });
  dots.forEach((d, di) => d.addEventListener("click", () => { go(di); play(); }));

  /* Pause on hover / focus (§26) */
  viewport.addEventListener("mouseenter", stop);
  viewport.addEventListener("mouseleave", play);
  viewport.addEventListener("focusin", stop);
  viewport.addEventListener("focusout", play);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : play());

  /* Touch swipe (§25) */
  let x0 = null;
  viewport.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
  viewport.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 42) go(dx < 0 ? i + 1 : i - 1);
    x0 = null; play();
  }, { passive: true });

  go(0); play();
}

/* ---------- Validation helpers ---------- */
function setErr(input, msg) {
  const field = input.closest(".field");
  field.classList.toggle("has-error", !!msg);
  $(".field-error", field).textContent = msg || "";
}
function validate(input, rules) {
  const v = input.value.trim();
  for (const [test, msg] of rules) { if (!test(v)) { setErr(input, msg); return false; } }
  setErr(input, "");
  return true;
}
const req = label => [v => v.length > 0, `Please enter your ${label}.`];
const emailRule = [v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Please enter a valid email address."];
const phoneRule = [v => /^[\d\s()+.-]{7,}$/.test(v), "Please enter a valid contact number."];

/* ---------- Booking page ---------- */
function initBooking() {
  const form = $("#bookingForm");
  if (!form) return;

  /* Service select + live aside summary */
  const sel = $("#bk-service");
  sel.innerHTML = `<option value="" disabled>Choose a service</option>` +
    SERVICES.map(s => `<option value="${s.slug}">${s.name} — ${s.duration} — $${s.price}</option>`).join("");
  const preselect = param ? findService(param) : null;
  if (preselect) sel.value = preselect.slug;

  function syncSummary() {
    const s = SERVICES.find(x => x.slug === sel.value);
    if (!s) return;
    $("#bsImage").src = s.image;
    $("#bsImage").alt = s.name;
    $("#bsName").textContent = s.name;
    $("#bsDuration").textContent = s.duration;
    $("#bsPrice").textContent = "$" + s.price;
    $("#bsIncludes").innerHTML = s.includes.map(i => `<li>${i}</li>`).join("");
  }
  sel.addEventListener("change", syncSummary);
  syncSummary();

  /* Time slots */
  const time = $("#bk-time");
  for (let h = 10; h <= 20; h++) {
    [0, 30].forEach(m => {
      if (h === 20 && m > 0) return;
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      time.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`);
    });
  }

  /* Date limits */
  const date = $("#bk-date");
  const today = new Date();
  date.min = today.toISOString().split("T")[0];
  const max = new Date(today); max.setDate(max.getDate() + 60);
  date.max = max.toISOString().split("T")[0];

  /* Field rules */
  const rules = {
    "bk-name": [req("full name")],
    "bk-email": [req("email address"), emailRule],
    "bk-phone": [req("WhatsApp / contact number"), phoneRule],
    "bk-date": [[v => v.length > 0, "Please choose a preferred date."]],
    "bk-time": [[v => v.length > 0, "Please choose a preferred time."]],
    "bk-service": [[v => v.length > 0, "Please select a service."]]
  };
  Object.keys(rules).forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("blur", () => validate(el, rules[id]));
    el.addEventListener("input", () => setErr(el, ""));
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    Object.keys(rules).forEach(id => {
      const el = document.getElementById(id);
      if (!validate(el, rules[id])) ok = false;
    });
    if (!ok) { $(".field.has-error input, .field.has-error select", form)?.focus(); return; }

    const s = findService(sel.value);
    $("#doneSummary").innerHTML = `
      <dt>Name</dt><dd>${$("#bk-name").value.trim()}</dd>
      <dt>Email</dt><dd>${$("#bk-email").value.trim()}</dd>
      <dt>Contact</dt><dd>${$("#bk-phone").value.trim()}</dd>
      <dt>Date</dt><dd>${date.value}</dd>
      <dt>Time</dt><dd>${time.value}</dd>
      <dt>Service</dt><dd>${s.name} · ${s.duration} · $${s.price}</dd>
      ${$("#bk-msg").value.trim() ? `<dt>Message</dt><dd>${$("#bk-msg").value.trim()}</dd>` : ""}`;
    form.hidden = true;
    const done = $("#bookingDone");
    done.hidden = false;
    done.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
  });

  $("#bookingAgain").addEventListener("click", () => {
    form.reset(); syncSummary();
    $("#bookingDone").hidden = true; form.hidden = false;
  });
}

/* ---------- Contact page ---------- */
function initContact() {
  const form = $("#contactForm");
  if (!form) return;
  const rules = {
    "ct-name": [req("name")],
    "ct-email": [req("email address"), emailRule],
    "ct-phone": [req("contact number"), phoneRule],
    "ct-msg": [[v => v.length >= 5, "Please write a short message (at least 5 characters)."]]
  };
  Object.keys(rules).forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("blur", () => validate(el, rules[id]));
    el.addEventListener("input", () => setErr(el, ""));
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    Object.keys(rules).forEach(id => {
      const el = document.getElementById(id);
      if (!validate(el, rules[id])) ok = false;
    });
    if (!ok) return;
    form.hidden = true;
    const done = $("#contactDone");
    done.hidden = false;
    done.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
  });
  $("#contactAgain").addEventListener("click", () => {
    form.reset();
    $("#contactDone").hidden = true; form.hidden = false;
  });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#year") && ($("#year").textContent = new Date().getFullYear());
  initChrome();
  initMenu();
  renderGrids();
  renderDetails();
  initBooking();
  initContact();
  initReveal();
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("is-loaded")));
});