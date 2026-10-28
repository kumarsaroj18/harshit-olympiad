/* NOF Maths Practice — shared app logic (home page + unit pages) */

const PALETTE = [
  "#6c5ce7", "#e17055", "#00b894", "#0984e3", "#fdcb6e",
  "#e84393", "#00cec9", "#d63031", "#6c9a3f", "#a29bfe",
];
function accentFor(unitNum) {
  return PALETTE[(unitNum - 1) % PALETTE.length];
}

// localStorage is scoped by ORIGIN, not URL path — since every subject is
// deployed under the same origin (.../maths/, .../science/, etc.), keys must
// be namespaced per subject or two subjects' unit "01" collide in storage.
// This is the only line that differs between the 5 copies of this file.
const SUBJECT_ID = "maths";

const PROGRESS_KEY = `nofProgress:${SUBJECT_ID}`;   // { "01": { "1": "B", "2": "A", ... } }
const SUMMARY_KEY = `nofSummary:${SUBJECT_ID}`;     // { "01": { score: 9, total: 30, attempted: 12 } }
const EVALUATED_KEY = `nofEvaluated:${SUBJECT_ID}`; // { "01": { "1": true, "5": true, ... } } — set only by Submit

function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch (e) {
    return {};
  }
}
function saveJSON(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (e) { /* ignore quota / private-mode errors */ }
}

// Blanks ("___") are swapped for a private-use placeholder before markdown
// parsing and turned into spans afterwards. Injecting the span HTML before
// parsing breaks inside code blocks, where marked escapes it into visible text.
const BLANK_TOKEN = "\uE000";
function markBlank(text) {
  return text.replace(/_{2,}/g, BLANK_TOKEN);
}
function renderBlanks(html) {
  return html.split(BLANK_TOKEN).join('<span class="blank"></span>');
}
// Clock emoji (🕐–🕧) render as tiny, device-dependent icons, too small to
// read the hands on. Replace each with a large drawn analogue clock face.
// U+1F550–1F55B are 1–12 o'clock; U+1F55C–1F567 are half past 1–12.
const CLOCK_EMOJI = /[\u{1F550}-\u{1F567}]/gu;
function clockSVG(hour, minute) {
  const hand = (deg, len) => {
    const rad = (deg - 90) * Math.PI / 180;
    return `x2="${(100 + len * Math.cos(rad)).toFixed(1)}" y2="${(100 + len * Math.sin(rad)).toFixed(1)}"`;
  };
  let marks = "";
  for (let i = 0; i < 60; i++) {
    const rad = (i * 6 - 90) * Math.PI / 180;
    const inner = i % 5 === 0 ? 80 : 86;
    marks += `<line x1="${(100 + inner * Math.cos(rad)).toFixed(1)}" y1="${(100 + inner * Math.sin(rad)).toFixed(1)}" ` +
      `x2="${(100 + 92 * Math.cos(rad)).toFixed(1)}" y2="${(100 + 92 * Math.sin(rad)).toFixed(1)}" ` +
      `stroke="#2c2a3d" stroke-width="${i % 5 === 0 ? 3 : 1}"/>`;
  }
  let nums = "";
  for (let n = 1; n <= 12; n++) {
    const rad = (n * 30 - 90) * Math.PI / 180;
    nums += `<text x="${(100 + 66 * Math.cos(rad)).toFixed(1)}" y="${(100 + 66 * Math.sin(rad)).toFixed(1)}">${n}</text>`;
  }
  const hourDeg = (hour % 12) * 30 + minute * 0.5;
  const label = minute ? `Clock showing half past ${hour}` : `Clock showing ${hour} o'clock`;
  return `<svg class="clock-face" viewBox="0 0 200 200" role="img" aria-label="${label}">` +
    `<circle cx="100" cy="100" r="96" fill="#fff" stroke="#2c2a3d" stroke-width="5"/>` +
    marks +
    `<g font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#2c2a3d" text-anchor="middle" dominant-baseline="central">${nums}</g>` +
    `<line x1="100" y1="100" ${hand(hourDeg, 38)} stroke="#e03131" stroke-width="9" stroke-linecap="round"/>` +
    `<line x1="100" y1="100" ${hand(minute * 6, 56)} stroke="#0984e3" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="100" cy="100" r="6" fill="#2c2a3d"/></svg>`;
}
function renderClocks(html) {
  return html.replace(CLOCK_EMOJI, (ch) => {
    const idx = ch.codePointAt(0) - 0x1F550;
    return idx < 12 ? clockSVG(idx + 1, 0) : clockSVG(idx - 11, 30);
  });
}
function mdBlock(text) {
  if (!text) return "";
  return renderClocks(renderBlanks(marked.parse(markBlank(text))));
}
function mdInline(text) {
  if (!text) return "";
  return renderClocks(renderBlanks(marked.parseInline(markBlank(text))));
}

/* ================= HOME PAGE ================= */

function initHome() {
  const summary = loadJSON(SUMMARY_KEY);
  document.querySelectorAll(".unit-card").forEach((card) => {
    const id = card.dataset.unitId;
    const badge = card.querySelector(".badge");
    const s = summary[id];
    if (s && s.attempted > 0) {
      badge.classList.remove("none");
      const isDone = s.attempted >= s.total;
      badge.textContent = isDone
        ? `✅ Best ${s.score}/${s.total}`
        : `▶ ${s.attempted}/${s.total} done`;
    }
  });
}

/* ================= UNIT PAGE ================= */

let currentUnit = null;

async function initUnit(unitId) {
  const res = await fetch(`data/unit-${unitId}.json`);
  const unit = await res.json();
  currentUnit = unit;
  const accent = accentFor(unit.num);
  document.documentElement.style.setProperty("--accent", accent);

  document.getElementById("topbar-title").textContent = `${unit.emoji} ${unit.title}`;
  document.title = `Unit ${unit.num} — ${unit.title} | NOF Maths Practice`;

  if (unit.parentNote) {
    document.getElementById("parent-note").innerHTML =
      `<strong>Parent's Note:</strong> ${mdInline(unit.parentNote)}`;
  }

  const learnList = document.getElementById("learn-list");
  learnList.innerHTML =
    "<h2>🎯 What You Will Learn</h2><ul>" +
    unit.learnBullets.map((b) => `<li>${mdInline(b)}</li>`).join("") +
    "</ul>";

  document.getElementById("learn-it-first").innerHTML =
    `<h2>💡 Learn It First</h2>${mdBlock(unit.learnItFirst)}`;

  const progress = loadJSON(PROGRESS_KEY);
  const unitAnswers = progress[unitId] || {};
  const evaluated = loadJSON(EVALUATED_KEY);
  const unitEvaluated = evaluated[unitId] || {};

  const sectionsRoot = document.getElementById("sections");
  sectionsRoot.innerHTML = "";
  unit.sections.forEach((section, sIdx) => {
    sectionsRoot.appendChild(
      renderSection(unit, section, sIdx, unitId, unitAnswers, unitEvaluated, accent)
    );
  });
  // Score banners must be updated only after every section is attached to
  // the live document — updateSectionScore looks elements up by id via
  // document.getElementById, which can't find nodes still sitting inside a
  // detached wrapper.
  unit.sections.forEach((section, sIdx) => updateSectionScore(unit, section, sIdx));

  renderOverallBanner(unit, unitAnswers);

  document.getElementById("submit-btn").addEventListener("click", () => submitUnit(unitId));

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (!confirm("Clear your answers for this unit and start over?")) return;
    const p = loadJSON(PROGRESS_KEY);
    delete p[unitId];
    saveJSON(PROGRESS_KEY, p);
    const s = loadJSON(SUMMARY_KEY);
    delete s[unitId];
    saveJSON(SUMMARY_KEY, s);
    const e = loadJSON(EVALUATED_KEY);
    delete e[unitId];
    saveJSON(EVALUATED_KEY, e);
    location.reload();
  });
}

function sectionRange(section, sIdx) {
  const nums = section.questions.map((q) => q.num);
  return `Q${Math.min(...nums)}–Q${Math.max(...nums)}`;
}

function renderSection(unit, section, sIdx, unitId, unitAnswers, unitEvaluated, accent) {
  const wrap = document.createElement("div");
  wrap.className = "section-block";
  wrap.style.setProperty("--card-accent", accent);

  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>${section.name}</h2><span class="range">${sectionRange(section)}</span>`;
  wrap.appendChild(header);

  const scoreBanner = document.createElement("div");
  scoreBanner.className = "score-banner";
  scoreBanner.id = `score-${sIdx}`;
  wrap.appendChild(scoreBanner);

  if (section.leadingContext) {
    const ctx = document.createElement("div");
    ctx.className = "context-block";
    ctx.innerHTML = mdBlock(section.leadingContext);
    wrap.appendChild(ctx);
  }

  section.questions.forEach((q) => {
    const savedLetter = unitAnswers[q.num];
    const isEvaluated = !!unitEvaluated[q.num];
    wrap.appendChild(renderQuestion(unitId, sIdx, q, savedLetter, isEvaluated));
    if (q.trailingContext) {
      const ctx = document.createElement("div");
      ctx.className = "context-block";
      ctx.innerHTML = mdBlock(q.trailingContext);
      wrap.appendChild(ctx);
    }
  });

  return wrap;
}

function renderQuestion(unitId, sIdx, q, savedLetter, isEvaluated) {
  const card = document.createElement("div");
  card.className = "question-card";
  card.id = `q-${q.num}`;

  const numBadge = `<span class="qnum">Q${q.num}</span>`;
  const stem = `<div class="stem">${mdBlock(q.content)}</div>`;

  const optsDiv = document.createElement("div");
  optsDiv.className = "options";
  ["A", "B", "C", "D"].forEach((letter) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.dataset.letter = letter;
    btn.innerHTML = `<span class="letter">${letter}.</span> <span>${mdInline(q.options[letter])}</span>`;
    btn.addEventListener("click", () => selectAnswer(unitId, q, letter, card));
    optsDiv.appendChild(btn);
  });

  const whyBlock = document.createElement("details");
  whyBlock.className = "why-block";
  whyBlock.hidden = true;
  whyBlock.innerHTML = `<summary>💡 Why?</summary><div class="why-body"></div>`;

  card.innerHTML = numBadge + stem;
  card.appendChild(optsDiv);
  card.appendChild(whyBlock);

  applyVisualState(card, q, savedLetter, isEvaluated);

  return card;
}

function selectAnswer(unitId, q, letter, card) {
  const progress = loadJSON(PROGRESS_KEY);
  if (!progress[unitId]) progress[unitId] = {};
  const previousLetter = progress[unitId][q.num];
  progress[unitId][q.num] = letter;
  saveJSON(PROGRESS_KEY, progress);

  // Picking a (new) option always un-evaluates this question — it stays
  // just "chosen" until Submit is pressed again.
  if (previousLetter !== letter) {
    const evaluated = loadJSON(EVALUATED_KEY);
    if (evaluated[unitId]) {
      delete evaluated[unitId][q.num];
      saveJSON(EVALUATED_KEY, evaluated);
    }
  }

  applyVisualState(card, q, letter, false);
  refreshAfterAnswer(unitId);
}

function applyVisualState(card, q, letter, isEvaluated) {
  const buttons = card.querySelectorAll(".opt-btn");
  buttons.forEach((b) => {
    b.classList.remove("selected", "correct", "incorrect");
    if (isEvaluated) {
      if (b.dataset.letter === q.correct) b.classList.add("correct");
      else if (b.dataset.letter === letter) b.classList.add("incorrect");
    } else if (b.dataset.letter === letter) {
      b.classList.add("selected");
    }
  });

  const whyBlock = card.querySelector(".why-block");
  if (isEvaluated && letter) {
    const isRight = letter === q.correct;
    whyBlock.querySelector(".why-body").innerHTML = isRight
      ? `✅ Correct! <span class="why-label">Why:</span> ${mdInline(q.why)}`
      : `❌ Not quite — the answer is <strong>${q.correct}</strong>. <span class="why-label">Why:</span> ${mdInline(q.why)}`;
    whyBlock.classList.toggle("right", isRight);
    whyBlock.classList.toggle("wrong", !isRight);
    whyBlock.hidden = false;
    whyBlock.open = false;
  } else {
    whyBlock.hidden = true;
    whyBlock.open = false;
  }
}

function submitUnit(unitId) {
  if (!currentUnit) return;
  const progress = loadJSON(PROGRESS_KEY);
  const unitAnswers = progress[unitId] || {};
  const evaluated = loadJSON(EVALUATED_KEY);
  if (!evaluated[unitId]) evaluated[unitId] = {};

  let anySelected = false;
  currentUnit.sections.forEach((section) => {
    section.questions.forEach((q) => {
      const letter = unitAnswers[q.num];
      if (!letter) return;
      anySelected = true;
      evaluated[unitId][q.num] = true;
      const card = document.getElementById(`q-${q.num}`);
      if (card) applyVisualState(card, q, letter, true);
    });
  });
  saveJSON(EVALUATED_KEY, evaluated);

  if (!anySelected) {
    alert("Pick at least one answer before submitting!");
    return;
  }
  refreshAfterAnswer(unitId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshAfterAnswer(unitId) {
  if (!currentUnit) return;
  currentUnit.sections.forEach((section, sIdx) => updateSectionScore(currentUnit, section, sIdx));
  renderOverallBanner(currentUnit, loadJSON(PROGRESS_KEY)[unitId] || {});
}

function updateSectionScore(unit, section, sIdx) {
  const progress = loadJSON(PROGRESS_KEY);
  const answers = progress[unit.id] || {};
  let correct = 0, attempted = 0;
  section.questions.forEach((q) => {
    const a = answers[q.num];
    if (a) {
      attempted++;
      if (a === q.correct) correct++;
    }
  });
  const el = document.getElementById(`score-${sIdx}`);
  if (!el) return;
  const total = section.questions.length;
  const stars = attempted === total ? (correct === total ? "🌟" : correct >= total * 0.7 ? "⭐" : "💪") : "";
  el.innerHTML = attempted
    ? `<span>Score: ${correct}/${attempted} answered</span><span class="stars">${stars}</span>`
    : `<span>Tap an answer to begin!</span><span class="stars"></span>`;
  saveSummary(unit);
}

function saveSummary(unit) {
  const progress = loadJSON(PROGRESS_KEY);
  const answers = progress[unit.id] || {};
  let correct = 0, attempted = 0, total = 0;
  unit.sections.forEach((section) => {
    section.questions.forEach((q) => {
      total++;
      const a = answers[q.num];
      if (a) {
        attempted++;
        if (a === q.correct) correct++;
      }
    });
  });
  const summary = loadJSON(SUMMARY_KEY);
  summary[unit.id] = { score: correct, total, attempted };
  saveJSON(SUMMARY_KEY, summary);
}

function renderOverallBanner(unit, unitAnswers) {
  const banner = document.getElementById("overall-banner");
  let correct = 0, attempted = 0, total = 0;
  unit.sections.forEach((section) => {
    section.questions.forEach((q) => {
      total++;
      const a = unitAnswers[q.num];
      if (a) {
        attempted++;
        if (a === q.correct) correct++;
      }
    });
  });
  if (attempted === 0) {
    banner.innerHTML = `<div class="big">${unit.emoji} Ready when you are!</div><div>30 questions across 3 sections</div>`;
    return;
  }
  const done = attempted >= total;
  banner.innerHTML = done
    ? `<div class="big">🏁 Unit complete! ${correct}/${total}</div><div>Tap "Reset" below to try again</div>`
    : `<div class="big">${correct}/${attempted} correct so far</div><div>${attempted}/${total} questions answered</div>`;
}
