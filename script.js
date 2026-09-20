(() => {
  const C = CONTENT;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const el = {
    code: $('#code'), display: $('#display'), stepCount: $('#stepCount'),
    back: $('#back'), next: $('#next'), runAll: $('#runAll'),
    messages: $('#messages'), chips: $('#chips'), context: $('#context'),
    chatForm: $('#chatForm'), chatInput: $('#chatInput'), send: $('#send'),
    indForm: $('#indForm'), indPredict: $('#indPredict'), indReason: $('#indReason'),
    hintBtn: $('#hintBtn'), persona: $('#persona'), fill: $('#fill'), restart: $('#restart'),
    stages: document.querySelectorAll('#stages li'), codeHint: $('#codeHint'),
  };

  let state;
  function freshState() {
    return {
      awaiting: 'predict', variant: 'buggy', step: 0, selectedLine: null,
      fixTries: 0, probeTries: 0, indIdx: 1, hintUsed: false, attempts: [], busy: false,
    };
  }

  // ---------- chat helpers ----------
  function addMsg(kind, text, html) {
    const m = document.createElement('div');
    m.className = 'msg ' + kind;
    if (html) m.innerHTML = html; else m.textContent = text;
    el.messages.appendChild(m);
    el.messages.scrollTop = el.messages.scrollHeight;
    return m;
  }
  async function say(...parts) {
    const mine = state;
    state.busy = true; setInputEnabled(false);
    for (const p of parts) {
      const t = addMsg('cui typing', 'typing…');
      await sleep(380);
      t.remove();
      if (state !== mine) return;
      if (typeof p === 'object') addMsg('cui', '', p.html); else addMsg('cui', p);
    }
    state.busy = false; setInputEnabled(true);
  }
  function setInputEnabled(on) {
    el.send.disabled = !on; el.chatInput.disabled = !on;
    el.indForm.querySelectorAll('button,input,textarea').forEach((n) => { n.disabled = !on || (n === el.hintBtn && state.hintUsed); });
  }
  function setChips(list) {
    el.chips.innerHTML = '';
    list.forEach(({ label, run }) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.onclick = () => { if (state.busy) return; el.chips.innerHTML = ''; run(); };
      el.chips.appendChild(b);
    });
  }
  const notSureChip = { label: "I'm not sure", run: () => onSend("I'm not sure") };

  // ---------- code panel ----------
  function renderCode() {
    const lines = C.code[state.variant];
    const trace = C.traces[state.variant];
    const activeLine = trace ? trace[state.step].line : null;
    const locked = ['independent', 'review', 'done'].includes(state.awaiting);
    el.code.innerHTML = '';
    lines.forEach((text, i) => {
      const n = i + 1;
      const d = document.createElement('div');
      d.className = 'ln' + (n === activeLine ? ' active' : '') + (n === state.selectedLine ? ' selected' : '') + (locked ? ' locked' : '');
      const num = document.createElement('span'); num.className = 'n'; num.textContent = n;
      const code = document.createElement('span'); code.textContent = text || ' ';
      d.append(num, code);
      if (!locked) d.onclick = () => onLineClick(n);
      el.code.appendChild(d);
    });
    el.codeHint.textContent = locked ? 'line help is off for the independent check' : 'click a line to ask about it';
  }

  // ---------- execution display ----------
  function cells(items, cur, flash) {
    const wrap = document.createElement('div');
    wrap.className = 'cells' + (flash ? ' flash' : '');
    items.forEach((it) => {
      const key = Array.isArray(it) ? it[0] : it;
      const c = document.createElement('span');
      c.className = 'cell' + (key === cur ? ' cur' : '');
      c.textContent = Array.isArray(it) ? `"${it[0]}": ${it[1]}` : `"${it}"`;
      wrap.appendChild(c);
    });
    return wrap;
  }
  function renderDisplay(flashKeys) {
    const trace = C.traces[state.variant];
    const early = state.awaiting === 'predict';
    const hidden = !trace || early || ['independent', 'review', 'done'].includes(state.awaiting);
    el.display.innerHTML = '';
    el.back.disabled = el.next.disabled = el.runAll.disabled = hidden;
    if (hidden) {
      el.stepCount.textContent = '';
      const p = document.createElement('div');
      p.className = 'placeholder';
      p.textContent = early ? 'The execution display unlocks after you make a prediction.' : 'Execution display hidden for the independent check.';
      el.display.appendChild(p);
      return;
    }
    const s = trace[state.step], labels = C.boxLabels[state.variant];
    el.stepCount.textContent = `Step ${state.step + 1} / ${trace.length}`;
    el.back.disabled = state.step === 0;
    el.next.disabled = el.runAll.disabled = state.step === trace.length - 1;

    const dBox = document.createElement('div'); dBox.className = 'box';
    dBox.innerHTML = `<div class="label">${labels.d}</div>`;
    dBox.appendChild(cells(s.d, state.variant === 'buggy' ? s.cur : null));
    el.display.appendChild(dBox);
    if (s.keys) {
      const kBox = document.createElement('div'); kBox.className = 'box';
      kBox.innerHTML = `<div class="label">${labels.keys}</div>`;
      kBox.appendChild(cells(s.keys, s.cur, flashKeys));
      el.display.appendChild(kBox);
    }
    const note = document.createElement('div'); note.className = 'note'; note.textContent = s.note;
    el.display.appendChild(note);
    if (s.error) {
      const e = document.createElement('div'); e.className = 'error'; e.textContent = s.error;
      el.display.appendChild(e);
    }
  }

  // ---------- chrome ----------
  function stageNumber() {
    const a = state.awaiting;
    if (a === 'predict' || a === 'watchTrace') return 1;
    if (a === 'fix' || a === 'watchFixed' || a === 'probe') return 2;
    return 3;
  }
  function renderChrome() {
    const cur = stageNumber();
    el.stages.forEach((li) => {
      const n = +li.dataset.stage;
      li.className = state.awaiting === 'done' ? 'done' : n === cur ? 'on' : n < cur ? 'done' : '';
    });
    const ind = state.awaiting === 'independent';
    el.chatForm.hidden = ind; el.indForm.hidden = !ind;
    const trace = C.traces[state.variant];
    const step = trace ? `${state.step + 1}/${trace.length}` : 'hidden';
    const line = state.selectedLine ? `line ${state.selectedLine}` : 'none';
    const assist = ind && state.hintUsed ? ' · ASSISTED (hint used)' : '';
    el.context.textContent = `Context the CUI is using: full program · selected line: ${line} · display step: ${step}${assist}`;
    el.fill.disabled = !el.persona.value;
  }
  function refresh(flashKeys) { renderCode(); renderDisplay(flashKeys); renderChrome(); }

  // ---------- interactions ----------
  async function onLineClick(n) {
    if (state.busy) return;
    state.selectedLine = n; refresh();
    const variant = state.variant === 'fixed' ? 'fixed' : 'buggy';
    const src = C.code[variant][n - 1].trim();
    const trace = C.traces[state.variant];
    const stepInfo = trace ? ` (display step ${state.step + 1} of ${trace.length})` : '';
    addMsg('ctx', `You asked about line ${n}: ${src}${stepInfo}`);
    await say(C.lineHelp[variant][n], C.reask[state.awaiting]);
  }

  function goStep(delta) {
    const trace = C.traces[state.variant];
    if (!trace) return;
    state.step = Math.max(0, Math.min(trace.length - 1, state.step + delta));
    refresh();
    afterStep();
  }
  function afterStep() {
    if (state.busy) return;
    const trigger = C.triggerStep[state.variant];
    if (state.awaiting === 'watchTrace' && state.variant === 'buggy' && state.step >= trigger) askFix();
    else if (state.awaiting === 'watchFixed' && state.variant === 'fixed' && state.step >= trigger) askProbe();
  }

  async function onSend(raw) {
    const text = (raw || '').trim();
    if (!text || state.busy) return;
    addMsg('you', text);
    switch (state.awaiting) {
      case 'predict': return handlePredict(text);
      case 'fix': return handleFix(text);
      case 'probe': return handleProbe(text);
      case 'watchTrace':
      case 'watchFixed':
        return say('Thanks. Use "Next step" on the display so we can look at the evidence together; I will ask a question when we reach the key moment.');
      case 'review':
        return say('Use the button above to continue.');
      default:
        return say('We are finished. Press Restart to try the exercise again.');
    }
  }

  // Stage 1: initial prediction
  async function handlePredict(t) {
    const R = C.rules;
    let reply;
    if (R.unsure.test(t)) reply = 'That is fine. Trace it on paper: after "b" is deleted, what does the loop do next? Now let us run it and see what actually happens.';
    else if (R.predictError.test(t)) reply = 'You expect the loop to fail, which is a strong prediction. Let us run it step by step and check whether the reason matches yours.';
    else reply = 'So you picture "b" being deleted and the loop carrying on. That is how it plays out when tracing on paper. Let us run it and compare with what Python does.';
    state.awaiting = 'watchTrace'; refresh();
    await say(reply, 'Press "Next step" on the display to walk through it (or "Run all").');
    setChips([{ label: 'Run all steps', run: () => goStep(99) }]);
  }

  async function askFix() {
    state.awaiting = 'fix'; refresh();
    await say(
      'The loop crashed with "dictionary changed size during iteration". The loop was walking through d while del was changing d.',
      'In your own words: how could we change the code so removing items is safe?'
    );
    setChips([notSureChip]);
  }

  // Stage 2: propose the correction
  async function handleFix(t) {
    const R = C.rules;
    if (R.fixIdea.test(t)) return revealFixed('Yes, that is the idea: walk through a copy of the keys and delete from d. The code panel now shows that change.');
    state.fixTries++;
    if (state.fixTries >= 2) return revealFixed('Here is one way to do it: loop over list(d.keys()), which is a copy of the keys. The code panel now shows it.');
    const first = R.unsure.test(t)
      ? 'Let us take one small piece. Something was being changed while the loop was still reading it.'
      : 'Not quite yet. Think about what the loop is reading versus what del is changing.';
    await say(first, 'What if the loop read something that is NOT being changed? What could that be?');
    setChips([notSureChip]);
  }
  async function revealFixed(lead) {
    state.variant = 'fixed'; state.step = 0; state.awaiting = 'watchFixed'; state.selectedLine = null; refresh();
    await say(lead, 'Step through the display and watch d next to the key list. I will pause at the deletion.');
    setChips([{ label: 'Jump to the deletion', run: () => goStep(C.triggerStep.fixed - state.step) }]);
  }

  async function askProbe() {
    state.awaiting = 'probe'; refresh();
    await say('Pause here. "b" has just been deleted from d. Is "b" still in the key list that the loop is reading? Explain why, and why that matters.');
    setChips([notSureChip]);
  }

  // Stage 2: probe understanding of the mechanism
  async function handleProbe(t) {
    const R = C.rules;
    let kind;
    if (R.unsure.test(t)) kind = 'unsure';
    else if (R.probeGood.test(t) && !/(also|too|both|as well)\s+(remov|delet|lose|change)/i.test(t)) kind = 'good';
    else if (R.probeMisconception.test(t)) kind = 'misconception';
    else if (R.losingTrack.test(t)) kind = 'losing';
    else kind = 'vague';

    if (kind === 'good') {
      await say('That is the key idea: deleting changes the original d, but the list being looped over stays the same, so the loop never sees a collection changing under it.');
      return startIndependent(1);
    }
    state.probeTries++;
    if (state.probeTries >= 3) {
      await say('Let me sum it up. list(d.keys()) makes a separate copy of the keys before the loop starts. del only changes d, so the copy still holds "a", "b", "c" and the loop finishes normally.');
      return startIndependent(1);
    }
    if (kind === 'misconception') {
      refresh(true);
      await say(
        'Look at the key list box (flashing). After del d["b"], d has 2 entries but the key list still shows 3. list(d.keys()) copies the keys once, before the loop, so later deletions in d do not touch it.',
        'Can you explain again, in your own words, why that lets the loop finish?'
      );
    } else if (kind === 'losing') {
      await say('"Losing track" describes the original version. What is different about what the loop reads now? Which box is changing and which box is the loop reading?');
    } else if (kind === 'unsure') {
      await say('Let us take just one thing: compare the two boxes at this step. Which one still has "b"?');
    } else {
      await say('I am not sure I follow yet. Which collection is the loop reading, which one does del change, and are they the same collection?');
    }
    setChips([notSureChip]);
  }

  // Stage 3: independent application
  async function startIndependent(idx) {
    state.indIdx = idx; state.variant = 'ind' + idx; state.awaiting = 'independent';
    state.hintUsed = false; state.selectedLine = null;
    el.indPredict.value = ''; el.indReason.value = '';
    setChips([]); refresh();
    await say(C.independent[idx].intro);
    setInputEnabled(true);
  }

  function scoreAttempt(idx, predictText, reasonText) {
    const S = C.scoring;
    let predict = 0;
    if (idx === 1) {
      const a = C.independent[1].answer, t = predictText.replace(/['"\s]/g, '');
      const good = (a.predict.test(t) ? 1 : 0) + (a.predict2.test(t) ? 1 : 0);
      predict = good === 2 && !a.bad.test(t) ? 2 : good > 0 ? 1 : 0;
    } else {
      const digits = predictText.replace(/\D/g, '');
      predict = digits === '13' ? 2 : /1/.test(digits) && /3/.test(digits) ? 1 : 0;
    }
    const trav = S.travers.test(reasonText), mod = S.modified.test(reasonText), unch = S.unchanged.test(reasonText);
    const identify = trav && mod ? 2 : trav || mod ? 1 : 0;
    const explain = unch && mod ? 2 : unch || mod ? 1 : 0;
    return { predict, identify, explain, total: predict + identify + explain };
  }

  const FEEDBACK = {
    predict: ['The final contents are not right yet.', 'Partly right: check which entries remain.', 'Correct contents.'],
    identify: ['Not shown: which collection is looped over and which is modified.', 'Only one of the two collections is identified.', 'You separated the collection being looped over from the one being changed.'],
    explain: ['No explanation of why the correction works.', 'Partial: say that removal changes the original while the looped-over copy stays unchanged.', 'Accurate: removal changes the original, the copy used for looping stays unchanged.'],
  };

  async function submitIndependent() {
    const p = el.indPredict.value.trim(), r = el.indReason.value.trim();
    if (!p || !r || state.busy) return;
    const idx = state.indIdx, assisted = state.hintUsed;
    addMsg('you', `Result: ${p}\nReasoning: ${r}`);
    const s = scoreAttempt(idx, p, r);
    state.awaiting = 'review'; refresh();
    state.attempts.push({ idx, label: C.independent[idx].label, assisted, ...s });

    const rows = ['predict', 'identify', 'explain'].map((k) => {
      const name = { predict: 'Predict the result', identify: 'Identify what changes', explain: 'Explain why it works' }[k];
      return `<tr><td>${name}</td><td><b>${s[k]}/2</b></td><td>${FEEDBACK[k][s[k]]}</td></tr>`;
    }).join('');
    const tag = assisted ? '<span class="tag warn">assisted</span>' : '<span class="tag good">independent</span>';
    await say({ html: `<table><tr><th>Criterion</th><th>Score</th><th>Feedback</th></tr>${rows}</table><b>${s.total}/6</b> ${tag}` });

    if (s.total === 6 && !assisted) {
      await say('Goal achieved: you explained why looping over a separate copy lets removal happen safely, without hints.');
      return finish();
    }
    if (idx === 1) {
      await say(assisted
        ? 'This attempt is recorded as assisted, so it does not yet show independent understanding. Here is another prepared variation.'
        : 'Not full marks yet. Here is another prepared variation so you can show independent understanding.');
      setChips([{ label: 'Start the list variation', run: () => startIndependent(2) }]);
    } else {
      finish();
    }
  }

  async function finish() {
    state.awaiting = 'done'; refresh();
    const lines = state.attempts.map((a) => `Attempt ${a.idx} (${a.label}): ${a.total}/6, ${a.assisted ? 'assisted' : 'independent'}`).join('\n');
    const goal = state.attempts.some((a) => a.total === 6 && !a.assisted);
    await say(`Summary\n${lines}\n\n${goal ? 'Learning goal met independently.' : 'Learning goal not yet met independently. Another prepared variation would be the next step.'}`);
    setChips([{ label: 'Restart', run: start }]);
  }

  // ---------- demo persona ----------
  function fillDemo() {
    const P = C.personas[el.persona.value];
    if (!P) return;
    const a = state.awaiting;
    if (a === 'independent') {
      el.indPredict.value = P['indPredict' + state.indIdx];
      el.indReason.value = P['indReason' + state.indIdx];
    } else if (P[a === 'watchTrace' || a === 'watchFixed' ? '' : a]) {
      el.chatInput.value = P[a];
    }
  }

  // ---------- setup ----------
  async function start() {
    state = freshState();
    el.messages.innerHTML = ''; el.chips.innerHTML = ''; el.chatInput.value = '';
    refresh();
    await say(
      'Hi! We will work through a short Python exercise together. Read the code on the left. You can click any line if something is unclear.',
      'Before running anything: what do you think happens when this code runs, and why?'
    );
    setChips([notSureChip]);
  }

  el.chatForm.addEventListener('submit', (e) => { e.preventDefault(); const v = el.chatInput.value; el.chatInput.value = ''; onSend(v); });
  el.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.chatForm.requestSubmit(); } });
  el.indForm.addEventListener('submit', (e) => { e.preventDefault(); submitIndependent(); });
  el.hintBtn.addEventListener('click', async () => {
    if (state.hintUsed || state.busy) return;
    state.hintUsed = true; el.hintBtn.disabled = true; renderChrome();
    await say(C.independent[state.indIdx].hint + ' (This attempt is now recorded as assisted.)');
  });
  el.back.onclick = () => goStep(-1);
  el.next.onclick = () => goStep(1);
  el.runAll.onclick = () => goStep(99);
  el.persona.onchange = renderChrome;
  el.fill.onclick = fillDemo;
  el.restart.onclick = start;

  start();
})();
