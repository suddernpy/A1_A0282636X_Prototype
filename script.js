(() => {
  const C = CONTENT;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = {
    thread: $('#thread'), chips: $('#chips'), selection: $('#selection'),
    chatExecution: $('#chatExecution'), displayCard: $('#displayCard'), workspace: $('.workspace'), codeCard: $('#codeCard'),
    historyPanel: $('#historyPanel'), historyToggle: $('#historyToggle'), historyList: $('#historyList'), historyEmpty: $('#historyEmpty'),
    composer: $('#composer'), input: $('#input'), send: $('#send'),
    code: $('#code'), display: $('#display'), stepCount: $('#stepCount'), back: $('#back'), next: $('#next'),
    progressSummary: $('#progressSummary'),
    customCode: $('#customCode'), customQuestion: $('#customQuestion'), askCustom: $('#askCustom'),
    stages: document.querySelectorAll('#stages li'), assisted: $('#assisted'), restart: $('#restart'),
    persona: $('#persona'), fill: $('#fill'), codeHint: $('#codeHint'),
  };

  let state;
  const MASTERY_KEY = 'pythonTutor.dictionaryCopyMastery';
  const fresh = () => ({
    awaiting: 'predict', stage: 1, variant: 'buggy', display: 'locked', step: 0,
    selected: new Set(), fixTries: 0, probeTries: 0, attempt: 1, q: 0, answers: [], hints: [false, false, false],
    attempts: [], pending: null, saved: null, chipFn: null, busy: false,
  });
  function addHistory(text) {
    const item = document.createElement('li');
    item.textContent = text;
    item.title = text;
    el.historyList.appendChild(item);
    el.historyEmpty.hidden = true;
  }
  const GUIDED = ['predict', 'confirm', 'watchTrace', 'fix', 'watchFixed', 'probe', 'watchSmall', 'bridge'];
  const LOCKED = ['ind', 'review', 'done'];
  const BUTTON_ONLY = ['confirm', 'bridge', 'review', 'done'];

  // ---------- conversation rendering ----------
  const fmt = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  function addRow(kind, content) {
    const r = document.createElement('div');
    r.className = 'row ' + kind;
    const b = document.createElement('div'); b.className = 'bubble';
    if (kind === 'you') b.textContent = content; else b.innerHTML = content;
    if (kind === 'cui') r.innerHTML = '<div class="avatar" aria-hidden="true">Py</div>';
    r.appendChild(b);
    el.thread.appendChild(r);
    el.thread.scrollTop = el.thread.scrollHeight;
    return r;
  }
  function lock(on) {
    const disabled = on || BUTTON_ONLY.includes(state.awaiting);
    el.send.disabled = disabled; el.input.disabled = disabled;
    if (!disabled && !el.persona.matches(':focus')) el.input.focus({ preventScroll: true });
  }
  async function say(...parts) {
    const mine = state;
    state.busy = true; lock(true);
    for (const p of parts) {
      if (!p) continue;
      const t = addRow('cui', '<span class="dots" aria-label="Tutor is typing"><i></i><i></i><i></i></span>');
      await sleep(450);
      t.remove();
      if (state !== mine) return;
      addRow('cui', typeof p === 'object' ? p.html : fmt(p));
    }
    state.busy = false; lock(false);
  }

  // ---------- suggested replies (chips) ----------
  function setChips(list) {
    el.chips.innerHTML = '';
    list.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = c.label; if (c.quiet) b.className = 'quiet';
      b.onclick = () => { if (state.busy) return; setChips([]); c.run(); };
      el.chips.appendChild(b);
    });
  }
  function showChips(fn) { state.chipFn = fn; setChips(fn()); }
  const restoreChips = () => setChips(state.chipFn ? state.chipFn() : []);

  // Support "modes" the learner can choose at any point; the tutor answers, then returns to the open question.
  const chipNotSure = () => ({ label: "🤔 I'm not sure", run: () => userSays("I'm not sure") });
  const chipHint = () => ({ label: '💡 Give me a hint', run: guidedHint });
  const chipExplain = () => ({ label: '📖 Explain this', run: guidedExplain });
  const chipSmall = () => ({ label: '🔍 Show a smaller example', quiet: true, run: smallExample });
  const chipTry = () => ({ label: '✍️ Try one independently', quiet: true, run: skipAhead });
  const helpChips = () => [chipHint(), chipExplain(), chipSmall(), chipTry(), chipNotSure()];
  const defaultChips = (aw) => (aw === 'predict' ? [chipHint(), chipExplain(), chipNotSure()] : helpChips());

  async function guidedHint() {
    if (state.busy) return;
    addRow('you', 'Give me a hint');
    await say(C.guidedHint[state.awaiting], C.reask[state.awaiting]);
    restoreChips();
  }
  async function guidedExplain() {
    if (state.busy) return;
    const a = state.awaiting, v = state.variant === 'buggy' ? 'buggy' : 'fixed';
    addRow('you', 'Explain this');
    let text = C.explain[a];
    if (a === 'predict') text = C.blockHelp.buggy;
    if (/^watch/.test(a)) { const line = C.traces[state.variant][state.step].line; text = `Line ${line}: ${C.lineHelp[v][line]}`; }
    await say(text, C.reask[a]);
    restoreChips();
  }

  // ---------- workspace: code ----------
  function toggleLine(n) {
    if (LOCKED.includes(state.awaiting)) return;
    state.selected.has(n) ? state.selected.delete(n) : state.selected.add(n);
    refresh();
  }
  function renderCode() {
    const locked = LOCKED.includes(state.awaiting);
    const trace = C.traces[state.variant];
    const active = trace && state.display === 'shown' ? trace[state.step].line : null;
    el.code.innerHTML = '';
    C.code[state.variant].forEach((text, i) => {
      const n = i + 1;
      const d = document.createElement('div');
      d.className = 'ln' + (n === active ? ' active' : '') + (state.selected.has(n) ? ' selected' : '') + (locked ? ' locked' : '');
      d.innerHTML = `<span class="n">${n}</span><span></span>`;
      d.lastChild.textContent = text;
      if (!locked) {
        d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-pressed', state.selected.has(n));
        d.onclick = () => toggleLine(n);
        d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLine(n); } };
      }
      el.code.appendChild(d);
    });
    el.codeHint.textContent = locked ? 'line help is off for this check' : 'click lines to ask about them';
  }
  function renderSelection() {
    const lines = [...state.selected].sort((a, b) => a - b);
    el.selection.hidden = !lines.length || LOCKED.includes(state.awaiting);
    if (el.selection.hidden) return;
    el.selection.innerHTML = '';
    const s = document.createElement('span');
    s.textContent = lines.length === 1 ? `Selected: line ${lines[0]}` : `Selected: lines ${lines.join(', ')}`;
    const ex = document.createElement('button'); ex.type = 'button'; ex.className = 'small'; ex.textContent = 'Explain';
    ex.onclick = explainSelection;
    const cl = document.createElement('button'); cl.type = 'button'; cl.className = 'ghost small'; cl.textContent = 'Clear';
    cl.onclick = () => { state.selected.clear(); refresh(); };
    el.selection.append(s, ex, cl);
  }

  // ---------- workspace: execution display ----------
  function cells(items, cur, flash) {
    const wrap = document.createElement('div');
    wrap.className = 'cells' + (flash ? ' flash' : '');
    items.forEach((it) => {
      const isPair = Array.isArray(it), key = isPair ? it[0] : it;
      const c = document.createElement('span');
      c.className = 'cell' + (key === cur ? ' cur' : '');
      c.textContent = isPair ? `"${it[0]}": ${it[1]}` : `"${it}"`;
      wrap.appendChild(c);
    });
    return wrap;
  }
  function renderDisplay(flash) {
    const trace = C.traces[state.variant];
    el.display.innerHTML = '';
    const shown = state.display === 'shown' && trace;
    el.back.disabled = !shown || state.step === 0;
    el.next.disabled = !shown || state.step === trace.length - 1;
    if (!shown) {
      el.stepCount.textContent = '';
      const p = document.createElement('div'); p.className = 'placeholder';
      p.textContent = state.display === 'locked'
        ? 'The execution display unlocks after your prediction, so you can compare it with what really happens.'
        : 'Execution display hidden for this check.';
      el.display.appendChild(p);
      return;
    }
    const s = trace[state.step];
    const key = state.variant === 'buggy' ? 'buggy' : 'fixed', labels = C.boxLabels[key];
    el.stepCount.textContent = `Step ${state.step + 1} of ${trace.length}`;
    const dBox = document.createElement('div'); dBox.className = 'box';
    dBox.innerHTML = `<div class="label">${fmt(labels.d)}</div>`;
    dBox.appendChild(cells(s.d, state.variant === 'buggy' ? s.cur : null));
    el.display.appendChild(dBox);
    if (s.keys) {
      const kBox = document.createElement('div'); kBox.className = 'box';
      kBox.innerHTML = `<div class="label">${fmt(labels.keys)}</div>`;
      kBox.appendChild(cells(s.keys, s.cur, flash));
      el.display.appendChild(kBox);
    }
    const note = document.createElement('div'); note.className = 'note'; note.innerHTML = fmt(s.note);
    el.display.appendChild(note);
    if (s.error) { const e = document.createElement('div'); e.className = 'error'; e.textContent = s.error; el.display.appendChild(e); }
  }

  // ---------- chrome: progress, status, composer ----------
  const PLACEHOLDER = {
    predict: 'Predict what happens, and why…', confirm: 'Or rephrase it in your own words…',
    fix: 'How would you change the code?', probe: 'Explain in your own words…', bridge: 'Say when you are ready…',
    watchTrace: 'Ask a question, or press Next step…', watchFixed: 'Ask a question, or press Next step…', watchSmall: 'Ask a question, or press Next step…',
  };
  function renderChrome() {
    el.stages.forEach((li) => {
      const n = +li.dataset.stage;
      li.className = state.awaiting === 'done' ? 'done' : n === state.stage ? 'on' : n < state.stage ? 'done' : '';
    });
    const assisted = state.hints.some(Boolean);
    el.assisted.hidden = !assisted;
    const buttonOnly = BUTTON_ONLY.includes(state.awaiting);
    el.input.placeholder = buttonOnly ? 'Use the buttons above to continue…'
      : state.awaiting === 'ind' ? `Your answer to question ${state.q + 1} of 3…`
        : (PLACEHOLDER[state.awaiting] || 'Type a message…');
    el.fill.disabled = !el.persona.value || buttonOnly || /^watch/.test(state.awaiting);
    el.input.disabled = state.busy || buttonOnly;
    el.send.disabled = state.busy || buttonOnly;
    renderProgress();
  }
  function moveExecutionDisplay() {
    const executing = /^watch/.test(state.awaiting);
    if (executing) {
      if (el.codeCard.parentElement !== el.chatExecution) el.chatExecution.appendChild(el.codeCard);
      if (el.displayCard.parentElement !== el.chatExecution) el.chatExecution.appendChild(el.displayCard);
    } else {
      if (el.displayCard.parentElement !== el.workspace) el.workspace.appendChild(el.displayCard);
      if (el.codeCard.parentElement !== el.workspace) el.workspace.insertBefore(el.codeCard, el.displayCard);
    }
  }
  function refresh(flash) { moveExecutionDisplay(); renderCode(); renderSelection(); renderDisplay(flash); renderChrome(); }

  function hasMastery() {
    try { return localStorage.getItem(MASTERY_KEY) === 'true'; } catch (_) { return false; }
  }
  function renderProgress() {
    const mastered = hasMastery();
    const attempts = state.attempts.length
      ? `<br>Attempts this session: ${state.attempts.map((a) => `${a.total}/6${a.assisted ? ' assisted' : ''}`).join(', ')}`
      : '';
    el.progressSummary.innerHTML = mastered
      ? `<span class="progress-dot good"></span><span><strong>Mastered</strong><br>Separate key-copy concept understood independently.${attempts}</span>`
      : `<span class="progress-dot"></span><span><strong>Not mastered yet</strong><br>Complete an unaided 6/6 check to master this concept.${attempts}</span>`;
  }

  // ---------- input ----------
  async function userSays(text) {
    addRow('you', text); setChips([]);
    addHistory(text);
    await dispatch(text);
  }
  async function dispatch(text) {
    if (await maybeClarify(text)) return;
    switch (state.awaiting) {
      case 'predict': return handlePredict(text);
      case 'confirm': state.awaiting = state.pending.retry; return dispatch(text);
      case 'fix': return handleFix(text);
      case 'probe': return handleProbe(text);
      case 'bridge': return handleBridge(text);
      case 'ind': return handleInd(text);
      case 'watchTrace': case 'watchFixed': case 'watchSmall':
        await say('Thanks. Use **Next step** so we can look at the evidence together; I will ask a question at the key moment.');
        return restoreChips();
      default:
        await say('Use the suggested reply below to continue, or press Restart.');
        return restoreChips();
    }
  }

  // Clarification: identify an unfamiliar expression, answer it, then return to the original question.
  async function maybeClarify(t) {
    const a = state.awaiting;
    if (!C.questionStart.test(t)) return false;
    if (a === 'ind') {
      await say('For this check I cannot explain the code. If you are stuck you can ask for a hint, which marks this attempt as assisted.');
      restoreChips(); return true;
    }
    if (!GUIDED.includes(a)) return false;
    const hit = C.exprHelp.find((e) => e.re.test(t));
    await say(hit ? hit.text : 'I can explain any part of the code. Click a line (or several) on the right and press **Explain**, or ask about a specific piece such as `del` or `list(d.keys())`.', C.reask[a]);
    restoreChips(); return true;
  }
  async function explainSelection() {
    if (state.busy) return;
    const lines = [...state.selected].sort((a, b) => a - b);
    if (!lines.length) return;
    const v = state.variant === 'buggy' ? 'buggy' : 'fixed';
    addRow('you', (lines.length === 1 ? `What does line ${lines[0]} do?\n` : `What do lines ${lines.join(', ')} do together?\n`) +
      lines.map((n) => C.code[state.variant][n - 1].trim()).join('\n'));
    state.selected.clear(); refresh(); setChips([]);
    await say(lines.length === 1 ? C.lineHelp[v][lines[0]] : C.blockHelp[v], C.reask[state.awaiting]);
    restoreChips();
  }

  // ---------- stage 1: initial prediction ----------
  async function handlePredict(t) {
    if (C.rules.unsure.test(t)) {
      await say('That is fine. A good first step is to trace it: after `"b"` is deleted, what should the loop do next? Let us run it and see what Python actually does.');
      return startWatch();
    }
    const err = C.rules.predictError.test(t);
    return confirm(
      err ? 'I read that as: you expect Python to **stop with an error** because of the deletion.'
        : 'I read that as: you expect `"b"` to be deleted and the loop to **carry on** with the remaining keys.',
      'predict',
      async () => {
        await say(err ? 'That is a strong prediction. Let us check whether the reason matches what really happens.'
          : 'That is how it plays out when tracing on paper. Let us compare it with what Python actually does.');
        startWatch();
      });
  }
  // Grounding: restate the learner's answer and let them confirm or correct it before responding to it.
  async function confirm(paraphrase, retry, next) {
    state.awaiting = 'confirm'; state.pending = { retry, next }; renderChrome();
    await say(paraphrase + ' Did I understand you correctly?');
    showChips(() => [
      { label: 'Yes, that is right', run: () => { addRow('you', 'Yes, that is right'); next(); } },
      { label: 'Not quite', run: repair },
    ]);
  }
  async function repair() {
    addRow('you', 'Not quite');
    state.awaiting = state.pending.retry; renderChrome();
    await say('Thanks for telling me. Could you say it another way, in your own words?');
    showChips(() => defaultChips(state.awaiting));
  }
  async function startWatch() {
    state.awaiting = 'watchTrace'; state.variant = 'buggy'; state.display = 'shown'; state.step = 0; refresh();
    await say('Now the run. Use **Next step** (below, or in the panel on the right) to walk through it. I will stop you at the important moment.');
    showChips(watchChips);
  }
  function watchChips() {
    const t = C.traces[state.variant], l = [];
    if (state.step < t.length - 1) {
      l.push({ label: 'Next step ▶', run: () => stepBy(1) });
    }
    return l;
  }
  function stepBy(d) {
    const t = C.traces[state.variant];
    if (state.busy || !t || state.display !== 'shown') return;
    state.step = Math.max(0, Math.min(t.length - 1, state.step + d));
    refresh();
    const p = afterStep();
    if (!p && /^watch/.test(state.awaiting)) showChips(watchChips);
  }
  async function askCustomCode() {
    const code = el.customCode.value.trim(), question = el.customQuestion.value.trim();
    if (!code || state.busy) return;
    addRow('you', `${question || 'Can you help me understand this Python code?'}\n\n${code}`);
    addHistory(question || 'Can you help me understand this Python code?');
    el.customQuestion.value = '';
    await say('I can use that code as context for your question. This prototype gives detailed guided feedback for the dictionary-copy exercise shown below; custom code is not executed or automatically analyzed here.');
  }
  function afterStep() {
    const t = C.traces[state.variant];
    if (state.awaiting === 'watchTrace' && state.step >= C.triggerStep.buggy) return askFix();
    if (state.awaiting === 'watchFixed' && state.variant === 'fixed' && state.step >= C.triggerStep.fixed) return askProbe();
    if (state.awaiting === 'watchSmall' && state.step === t.length - 1) return smallDone();
  }

  // ---------- stage 2: examine execution ----------
  async function askFix() {
    state.awaiting = 'fix'; state.stage = 2; refresh();
    await say('The loop stopped with `RuntimeError: dictionary changed size during iteration`. The loop was reading `d` while `del` was changing `d`.',
      'In your own words: **how could we change the code so removing items is safe?**');
    showChips(helpChips);
  }
  async function handleFix(t) {
    if (C.rules.fixIdea.test(t)) return revealFixed('Yes, that is the idea: loop over a **copy** of the keys and delete from `d`. The code on the right now shows that change.');
    state.fixTries++;
    if (state.fixTries >= 2) return revealFixed('Here is one way to do it: loop over `list(d.keys())`, which is a copy of the keys. The code on the right now shows it.');
    await say(C.rules.unsure.test(t) ? 'Let us take one small piece. Something was being changed while the loop was still reading it.'
      : 'Not quite yet. Think about what the loop is reading versus what `del` is changing.',
      'What if the loop read something that is **not** being changed? What could that be?');
    showChips(helpChips);
  }
  async function revealFixed(lead) {
    state.variant = 'fixed'; state.step = 0; state.awaiting = 'watchFixed'; state.selected.clear(); refresh();
    await say(lead, 'Step through it and watch `d` next to the key list. I will stop you at the deletion.');
    showChips(watchChips);
  }
  async function askProbe() {
    state.awaiting = 'probe'; refresh();
    await say('Pause here. `"b"` has just been deleted from `d`. **Is `"b"` still in the key list the loop is reading? Explain why, and why that matters.**');
    showChips(helpChips);
  }
  async function handleProbe(t) {
    const R = C.rules;
    const kind = R.unsure.test(t) ? 'unsure' : R.probeBad.test(t) ? 'misconception' : R.probeGood.test(t) ? 'good'
      : R.probeMisconception.test(t) ? 'misconception' : R.losingTrack.test(t) ? 'losing' : 'vague';
    const para = {
      good: 'I read that as: `"b"` is **still in the key list**, because the list is a separate copy that `del` does not touch.',
      misconception: 'I read that as: deleting `"b"` **removes it from the key list too**.',
      losing: 'I read that as: the loop **loses track** when something changes, though I am not sure which collection you mean.',
    }[kind];
    if (para) return confirm(para, 'probe', () => reactProbe(kind));
    return reactProbe(kind);
  }
  async function reactProbe(kind) {
    if (kind === 'good') {
      await say('That is the key idea: `del` changes the original `d`, but the list the loop reads stays the same, so the loop never sees a collection changing under it.');
      return bridge();
    }
    state.probeTries++;
    if (state.probeTries >= 3) {
      await say('Let me sum it up. `list(d.keys())` makes a separate copy of the keys before the loop starts. `del` only changes `d`, so the copy still holds `"a"`, `"b"` and `"c"`, and the loop finishes normally.');
      return bridge();
    }
    state.awaiting = 'probe';
    if (kind === 'misconception') {
      refresh(true);
      await say('Look at the key list box on the right (flashing). After `del d["b"]`, `d` has 2 entries but the key list still shows 3. `list(d.keys())` copies the keys once, before the loop, so later deletions in `d` do not touch it.',
        'Can you **explain again, in your own words**, why that lets the loop finish?');
    } else if (kind === 'losing') {
      await say('"Losing track" describes the original version. What is different about what the loop reads now? Which box is being changed, and which box is the loop reading?');
    } else if (kind === 'unsure') {
      await say(state.probeTries === 1 ? 'Let us take just one thing: compare the two boxes on the right. Which one still has `"b"`?'
        : 'Try counting: `d` has 2 entries now, and the key list has 3. Is the key list the same collection as `d`?');
    } else {
      await say('I am not sure I follow yet. Which collection is the loop reading, which one does `del` change, and are they the same collection?');
    }
    showChips(helpChips);
  }
  async function bridge() {
    state.awaiting = 'bridge'; state.stage = 2; refresh();
    await say('Next you will try a **new example on your own**. The execution display and hints are hidden, and I will score three things: your prediction, what changes, and why it works.',
      'Ready when you are, or would you like a smaller example first?');
    showChips(() => [{ label: "✅ I'm ready", run: () => { addRow('you', "I'm ready"); startIndependent(1); } }, chipExplain(), chipSmall()]);
  }
  async function handleBridge(t) {
    if (C.rules.smaller.test(t)) return smallExample(true);
    if (C.rules.ready.test(t)) return startIndependent(1);
    await say(C.reask.bridge); restoreChips();
  }

  // Learner-initiated support: a smaller example (P2's checking strategy), then return to the open question.
  async function smallExample(typed) {
    if (state.busy) return;
    if (!typed) addRow('you', 'Show a smaller example');
    state.saved = { awaiting: state.awaiting, variant: state.variant, step: state.step };
    state.awaiting = 'watchSmall'; state.variant = 'small'; state.display = 'shown'; state.step = 0; state.selected.clear(); refresh();
    await say('Here is the same idea with just two entries. Step through it and compare the two boxes.');
    showChips(watchChips);
  }
  async function smallDone() {
    const s = state.saved || { awaiting: 'bridge', variant: 'fixed', step: 0 };
    state.awaiting = s.awaiting; state.variant = s.variant; state.step = s.step;
    if (s.awaiting === 'bridge') state.display = 'shown';
    refresh();
    await say('Same pattern, smaller: `d` lost `"b"`, but the key list still held `"a"` and `"b"`, so the loop visited both without trouble.', C.reask[s.awaiting]);
    showChips(s.awaiting === 'bridge' ? () => [{ label: "✅ I'm ready", run: () => { addRow('you', "I'm ready"); startIndependent(1); } }]
      : s.awaiting.startsWith('watch') ? watchChips : helpChips);
  }
  async function skipAhead() {
    if (state.busy) return;
    addRow('you', 'I want to try one independently');
    await say('Sure, it is your call. You have not yet explained why the copy matters, so this check will show whether that is clear.');
    startIndependent(1);
  }

  // ---------- stage 3: independent application ----------
  async function startIndependent(attempt) {
    state.attempt = attempt; state.stage = 3; state.variant = 'ind' + attempt; state.display = 'hidden';
    state.awaiting = 'ind'; state.q = 0; state.answers = []; state.hints = [false, false, false]; state.selected.clear();
    refresh();
    const ex = C.examples[attempt];
    await say(ex.intro, ex.questions[0]);
    showChips(indChips);
  }
  const indChips = () => [
    ...(state.hints[state.q] ? [] : [{ label: '💡 Hint (marks this attempt as assisted)', run: giveHint }]),
    { label: '↺ Repeat the question', quiet: true, run: repeatQuestion },
  ];
  async function repeatQuestion() {
    addRow('you', 'Repeat the question');
    await say(C.examples[state.attempt].questions[state.q]);
    showChips(indChips);
  }
  async function giveHint() {
    addRow('you', 'I would like a hint');
    if (state.hints[state.q]) { await say('That is the only hint for this question. Give it your best attempt in your own words.'); return showChips(indChips); }
    state.hints[state.q] = true; renderChrome();
    await say(C.examples[state.attempt].hints[state.q]);
    showChips(indChips);
  }
  async function handleInd(t) {
    if (/^\s*(a )?hint\s*\??\s*$|need a hint|give me a hint/i.test(t)) return giveHint();
    state.answers[state.q] = t; state.q++;
    renderChrome();
    if (state.q < 3) {
      await say('Thanks, noted.', C.examples[state.attempt].questions[state.q]);
      return showChips(indChips);
    }
    return finishAttempt();
  }
  function score(ex, a) {
    const S = C.scoring, re = (k) => new RegExp(S[k].replace(/\{V\}/g, ex.v), 'i');
    const t = a[0].toLowerCase().replace(/['"\s]/g, '');
    const keep = ex.keep.filter((k) => t.includes(k)).length;
    const dropBad = ex.drop.some(([k, v]) => new RegExp(k + '\\W{0,2}' + v).test(t)) ||
      (ex.drop.some(([k]) => t.includes(k)) && !/remov|delet|gone|drop|without|except|not/i.test(a[0]));
    const predict = keep === ex.keep.length && !dropBad ? 2 : keep > 0 ? 1 : 0;
    const trav = re('travers').test(a[1]), mod1 = re('modified').test(a[1]);
    const unch = re('unchanged').test(a[2]), mod2 = re('modified').test(a[2]);
    const identify = trav && mod1 ? 2 : trav || mod1 ? 1 : 0;
    const explain = unch && mod2 ? 2 : unch || mod2 ? 1 : 0;
    return { scores: [predict, identify, explain], total: predict + identify + explain };
  }
  async function finishAttempt() {
    const ex = C.examples[state.attempt], s = score(ex, state.answers);
    const hintedQs = state.hints.map((h, i) => (h ? i + 1 : 0)).filter(Boolean), assisted = hintedQs.length > 0;
    state.attempts.push({ attempt: state.attempt, label: ex.label, assisted, total: s.total });
    state.awaiting = 'review'; refresh();
    const rows = C.criteria.map(([name, fb], i) => `<tr><td>${name}</td><td><strong>${s.scores[i]}/2</strong></td><td>${fb[s.scores[i]]}</td></tr>`).join('');
    const tag = assisted ? `<span class="tag warn">assisted (hint on question ${hintedQs.join(', ')})</span>` : '<span class="tag good">independent</span>';
    if (s.total === 6 && !assisted) {
      try { localStorage.setItem(MASTERY_KEY, 'true'); } catch (_) { /* progress is still available for this session */ }
    }
    await say({ html: `<div class="scorecard"><table><tr><th>Criterion</th><th>Score</th><th>Feedback</th></tr>${rows}</table></div><strong>${s.total} / 6</strong> &nbsp; ${tag}` });
    const corrections = [];
    if (s.scores[0] < 2) {
      corrections.push(`For question 1, the correct result is ${formatExampleResult(ex)} because the entries matching the condition are deleted.`);
    }
    if (s.scores[1] < 2) {
      corrections.push('For question 2, the loop reads the separate list made by `list(...)`, while `del` changes the original dictionary.');
    }
    if (s.scores[2] < 2) {
      corrections.push('For question 3, it is safe because deleting changes only the original dictionary; the copied key list stays unchanged, so the loop can continue reading it without being disturbed.');
    }
    if (corrections.length) await say('Here is the key idea to take away:\n\n' + corrections.join('\n\n'));
    if (s.total === 6 && !assisted) {
      await say('**Goal achieved.** Without hints, you explained why looping over a separate copy lets items be removed safely.');
      return finish();
    }
    if (state.attempt === 1) {
      await say(assisted ? 'This attempt is recorded as **assisted**, so it does not yet show independent understanding. Here is another prepared example so you can show it unaided.'
        : 'Not full marks yet. Here is another prepared example so you can show independent understanding.');
      return showChips(() => [
        { label: 'Try another example', run: () => { addRow('you', 'Try another example'); startIndependent(2); } },
        { label: 'Finish here', quiet: true, run: () => { addRow('you', 'Finish here'); finish(); } },
      ]);
    }
    return finish();
  }

  function formatExampleResult(ex) {
    const known = ex.label === 'scores' ? '{"ben": 82, "dee": 91}' : '{"ink": 12, "clip": 7}';
    return `\`${known}\``;
  }
  async function finish() {
    state.awaiting = 'done'; refresh();
    const lines = state.attempts.map((a) => `Attempt ${a.attempt} (\`${a.label}\`): ${a.total} / 6, ${a.assisted ? 'assisted' : 'independent'}`).join('\n');
    const met = state.attempts.some((a) => a.total === 6 && !a.assisted);
    await say(`**Summary**\n${lines}\n\n${met ? 'Learning goal met independently.' : 'Learning goal not yet met independently. The next step would be another prepared example.'}`);
    showChips(() => [{ label: 'Start again', run: start }]);
  }

  // ---------- demo tools ----------
  function fillDemo() {
    const P = C.personas[el.persona.value];
    if (!P) return;
    const a = state.awaiting;
    let v = null;
    if (a === 'ind') v = P['ind' + state.attempt][state.q];
    else if (a === 'confirm') v = P[state.pending.retry];
    else if (a === 'probe') v = state.probeTries > 0 && P.probe2 ? P.probe2 : P.probe;
    else if (a === 'predict' || a === 'fix') v = P[a];
    if (v) { el.input.value = v; autosize(); el.input.focus(); }
  }
  function autosize() { el.input.style.height = 'auto'; el.input.style.height = Math.min(el.input.scrollHeight, 140) + 'px'; }

  // ---------- setup ----------
  async function start() {
    state = fresh();
    el.thread.innerHTML = ''; el.historyList.innerHTML = ''; el.historyEmpty.hidden = false;
    setChips([]); el.input.value = ''; autosize();
    refresh();
    await say(
      'Hi! I am your Python tutor. Today we look at one thing: **what happens when you delete items from a dictionary while looping over it**.',
      'You can **type** your answers, tap the **suggested replies** below, or **click lines of code** on the right to ask about them. You set the pace.',
      'The code is on the right. Before running anything: **what do you think happens when it runs, and why?**');
    showChips(() => defaultChips('predict'));
  }

  el.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = el.input.value.trim();
    if (!v || state.busy) return;
    el.input.value = ''; autosize();
    userSays(v);
  });
  el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.composer.requestSubmit(); } });
  el.input.addEventListener('input', autosize);
  el.next.onclick = () => stepBy(1);
  el.back.onclick = () => stepBy(-1);
  el.askCustom.onclick = askCustomCode;
  el.historyToggle.onclick = () => {
    const collapsed = el.historyPanel.classList.toggle('collapsed');
    el.historyToggle.setAttribute('aria-expanded', String(!collapsed));
    el.historyToggle.textContent = collapsed ? '›' : '‹';
  };
  el.persona.onchange = renderChrome;
  el.fill.onclick = fillDemo;
  el.restart.onclick = start;

  start();
})();
