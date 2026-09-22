// All hard-coded material for the prototype: the exercise, execution traces, scripted replies and keyword rules.
// One guided example (dictionary) + prepared new examples of the same collection type for the independent check.
// In the full system the exercises/traces stay here; the replies and scoring would come from an LLM.

const CONTENT = {
  code: {
    buggy: [
      'd = {"a": 1, "b": 2, "c": 3}',
      'for key in d:',
      '    if d[key] == 2:',
      '        del d[key]',
    ],
    fixed: [
      'd = {"a": 1, "b": 2, "c": 3}',
      'for key in list(d.keys()):',
      '    if d[key] == 2:',
      '        del d[key]',
    ],
    small: [
      'd = {"a": 1, "b": 2}',
      'for key in list(d.keys()):',
      '    if d[key] == 2:',
      '        del d[key]',
    ],
    ind1: [
      'scores = {"amy": 45, "ben": 82, "cai": 38, "dee": 91}',
      'for name in list(scores.keys()):',
      '    if scores[name] < 50:',
      '        del scores[name]',
    ],
    ind2: [
      'stock = {"pen": 0, "ink": 12, "pad": 0, "clip": 7}',
      'for item in list(stock.keys()):',
      '    if stock[item] == 0:',
      '        del stock[item]',
    ],
  },

  // d = [key, value] pairs; keys = the separate key list (null if none); cur = key being visited.
  traces: {
    buggy: [
      { line: 1, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: null,
        note: '`d` is created. The loop will read `d` directly.' },
      { line: 2, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: 'a',
        note: 'First pass: `key = "a"`. `d["a"]` is 1, so nothing is deleted.' },
      { line: 3, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: 'b',
        note: 'Second pass: `key = "b"`. `d["b"] == 2` is True.' },
      { line: 4, d: [['a', 1], ['c', 3]], keys: null, cur: 'b',
        note: '`del d["b"]` runs. `d` now has 2 entries, but the loop is still reading `d`.' },
      { line: 2, d: [['a', 1], ['c', 3]], keys: null, cur: null,
        error: 'RuntimeError: dictionary changed size during iteration',
        note: 'The loop asks `d` for its next key and notices `d` changed size while it was being read.' },
    ],
    fixed: [
      { line: 1, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: null,
        note: '`d` is created.' },
      { line: 2, d: [['a', 1], ['b', 2], ['c', 3]], keys: ['a', 'b', 'c'], cur: null,
        note: '`list(d.keys())` builds a separate list of the keys. The loop will read this list, not `d`.' },
      { line: 3, d: [['a', 1], ['b', 2], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'a',
        note: '`key = "a"`. `d["a"]` is 1, so nothing is deleted.' },
      { line: 4, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'b',
        note: '`key = "b"`. `d["b"] == 2`, so `del d["b"]` runs. Compare the two boxes.' },
      { line: 3, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'c',
        note: 'The loop moves on to `"c"` from the key list. `d["c"]` is 3, so nothing is deleted.' },
      { line: 2, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: null,
        note: 'The key list is used up, so the loop ends. `d` is `{"a": 1, "c": 3}` with no error.' },
    ],
    small: [
      { line: 1, d: [['a', 1], ['b', 2]], keys: null, cur: null,
        note: 'A smaller dictionary with just two entries.' },
      { line: 2, d: [['a', 1], ['b', 2]], keys: ['a', 'b'], cur: null,
        note: '`list(d.keys())` copies the keys: `["a", "b"]`.' },
      { line: 3, d: [['a', 1], ['b', 2]], keys: ['a', 'b'], cur: 'a',
        note: '`key = "a"`. `d["a"]` is 1, so nothing is deleted.' },
      { line: 4, d: [['a', 1]], keys: ['a', 'b'], cur: 'b',
        note: '`key = "b"`. `del d["b"]` runs. `d` has one entry; the key list still has two.' },
      { line: 2, d: [['a', 1]], keys: ['a', 'b'], cur: null,
        note: 'The loop finishes. `d` is `{"a": 1}`, and the key list it read was never changed.' },
    ],
  },
  triggerStep: { buggy: 4, fixed: 3 },

  boxLabels: {
    buggy: { d: '`d`: the loop reads this AND `del` changes it', keys: '' },
    fixed: { d: '`d`: the collection being changed', keys: '`list(d.keys())`: the collection the loop reads' },
  },

  lineHelp: {
    buggy: {
      1: 'This creates the dictionary `d` with three entries. It is the collection the rest of the program works on.',
      2: '`for key in d:` visits the keys of `d` one at a time. Here the loop reads `d` itself, not a copy, so `d` needs to keep the same size while the loop runs.',
      3: '`if d[key] == 2:` looks up the value stored under the current key and checks whether it is 2. Only `"b"` passes. This only reads `d`; the change happens on the next line.',
      4: '`del d[key]` deletes the current entry from `d`. Together with line 2, the loop is reading `d` while `d` is being changed.',
    },
    fixed: {
      1: 'This creates the dictionary `d` with three entries.',
      2: '`list(d.keys())` builds a separate list of the keys right now: `["a", "b", "c"]`. The loop reads that list, not `d`.',
      3: 'Same check as before: it looks up the value in `d` for the current key.',
      4: '`del d[key]` still changes `d`, but `d` is no longer what the loop reads, so the loop is not disturbed.',
    },
  },
  blockHelp: {
    buggy: 'Taken together: the loop visits each key of `d`, checks its value, and deletes the entry when it matches. The thing to notice is that the collection being visited and the collection being changed are the same one.',
    fixed: 'Taken together: the loop visits each key from a copied list, checks the value in `d`, and deletes matching entries from `d`. The collection being visited (the copy) and the collection being changed (`d`) are now different.',
  },
  // Typed questions about an expression ("what does del do?") are matched to these.
  exprHelp: [
    { re: /runtimeerror|changed size|error message/i, text: '`RuntimeError: dictionary changed size during iteration` is Python saying that the dictionary the loop was reading got a different number of entries in the middle of the loop.' },
    { re: /\bdel\b/i, text: '`del d[key]` removes the entry stored under `key` from the dictionary `d`. It changes `d` itself.' },
    { re: /list\s*\(|\.keys|keys\(\)/i, text: '`d.keys()` gives the keys of `d`, and `list(...)` turns them into a separate list. That list is a copy made once, before the loop starts.' },
    { re: /d\[key\]|== ?2|\bif\b/i, text: '`d[key]` looks up the value stored under `key`. `if d[key] == 2:` is true only for `"b"`.' },
    { re: /\bfor\b|loop|iterat/i, text: '`for key in ...:` visits one key at a time. The important question is which collection the loop is visiting.' },
  ],
  questionStart: /^\s*(what('?s| is| does| do)|whats|how (does|do)|can you (explain|tell)|could you (explain|tell)|explain|i (don'?t|do not) (get|understand))/i,

  reask: {
    predict: 'Back to your question: what do you think happens when this code runs, and why?',
    confirm: 'Back to where we were: did I understand your answer correctly?',
    watchTrace: 'Back to the run: press **Next step** when you are ready.',
    fix: 'Back to your question: how could we change the code so removing is safe?',
    watchFixed: 'Back to the run: press **Next step**; I will pause at the deletion.',
    probe: 'Back to your question: is `"b"` still in the key list, and why does that matter?',
    watchSmall: 'Back to the smaller example: press **Next step**.',
    bridge: 'Back to where we were: ready to try a new example on your own?',
  },

  // Guided-stage hints and explanations offered as buttons. These do not count as assisted; only hints in the final check do.
  guidedHint: {
    predict: 'Hint: trace it on paper. After `"b"` is deleted, what does `d` look like, and which key should the loop visit next?',
    fix: 'Hint: the loop reads `d` while `del` changes `d`. What if the loop read a different collection that is not being changed?',
    probe: 'Hint: compare the two boxes on the right. One is changed by `del`; the other is only read by the loop. Which is which?',
    watchTrace: 'Hint: watch the size of `d` when `"b"` is deleted, and what the loop does on its next pass.',
    watchFixed: 'Hint: watch both boxes. Which one changes when `del` runs, and which one does not?',
    watchSmall: 'Hint: watch both boxes. Which one changes when `del` runs, and which one does not?',
  },
  explain: {
    predict: null, // filled from blockHelp.buggy
    fix: 'The error means Python noticed that `d` changed size while the loop was still reading it. Two things matter here: which collection the loop reads, and which collection `del` changes.',
    probe: 'There are two boxes. `d` is the dictionary that `del` changes. The key list is a copy made before the loop starts, and it is the one the loop reads. They are separate collections.',
    bridge: 'In short: `list(d.keys())` makes a separate copy of the keys. The loop reads the copy, `del` changes the original `d`, so the loop is never disturbed.',
  },

  // Keyword rules that sort free-text answers into a few prepared cases.
  rules: {
    unsure: /not sure|don'?t know|do not know|dunno|idk|no idea|confused|^\s*\?+\s*$/i,
    predictError: /error|crash|exception|fail|stop|not allowed|can'?t|cannot|changed size|breaks?/i,
    fixIdea: /copy|list\s*\(|\.keys|separate|another list|different list|new list|snapshot|\[:\]/i,
    probeGood: /still (has|have|contains?|includes?|there|in)|unchanged|not (be )?(change|affect|remov|delet|touch)|doesn'?t (change|affect|remove|delete)|isn'?t (changed|affected)|separate|independent|stays?|remains?|the same/i,
    probeBad: /(also|too|both|as well)\s+(remov|delet|lose|change)|\balso loses?\b/i,
    probeMisconception: /\balso\b|\btoo\b|\bboth\b|as well|(is|gets?|was) (removed|deleted)|no longer|loses? (b|it)/i,
    losingTrack: /los(e|es|ing) track/i,
    ready: /\b(ready|yes|yep|sure|go|start|ok|okay|let'?s)\b/i,
    smaller: /small|simpler|another example|example/i,
  },

  // Scoring rules for the independent check: stand-in for the LLM assessment against the rubric.
  // {V} is replaced by the example's variable name.
  scoring: {
    travers: '(loop|iterat|go(es)? (through|over)|walk|traverse|read|visit)[^.]*?(copy|list\\s*\\(|keys|separate)|(copy|keys|separate)[^.]*?(loop|iterat|visit)',
    modified: '(delet|remov|modif|chang|edit)[^.]*?(original|dictionary|\\bdict\\b|\\b{V}\\b)|(original|dictionary|\\bdict\\b|\\b{V}\\b)[^.]*?(delet|remov|modif|chang|edit)',
    unchanged: 'unchanged|not (be )?(change|affect|modif|touch)|doesn\'?t (change|get changed|affect)|stays? (the )?same|still (has|contains|includes)|remains?|independent|separate',
  },

  examples: {
    1: {
      label: 'scores', v: 'scores',
      keep: ['ben', 'dee'], drop: [['amy', 45], ['cai', 38]],
      intro: 'Here is a **new example**. The execution display is hidden for this check. I will ask three short questions, one at a time, and score them at the end. Hints are available if you need one, but they will mark this attempt as assisted.',
      questions: [
        'Question 1 of 3. What does `scores` contain after the loop finishes?',
        'Question 2 of 3. In this loop, which collection is being looped over, and which collection is being changed?',
        'Question 3 of 3. Why does that make it safe to remove items here?',
      ],
      hints: [
        'Hint: go through the keys one by one. Which entries have a value below 50, and which are left after they are deleted?',
        'Hint: look at line 2 and line 4. Which collection is `list(...)` made from, and which collection does `del` act on?',
        'Hint: after a `del`, which collection has changed, and which one has not? What does the loop see?',
      ],
    },
    2: {
      label: 'stock', v: 'stock',
      keep: ['ink', 'clip'], drop: [['pen', 0], ['pad', 0]],
      intro: 'Let us try **another prepared example**, again with the display hidden. Same three questions, one at a time.',
      questions: [
        'Question 1 of 3. What does `stock` contain after the loop finishes?',
        'Question 2 of 3. In this loop, which collection is being looped over, and which collection is being changed?',
        'Question 3 of 3. Why does that make it safe to remove items here?',
      ],
      hints: [
        'Hint: go through the keys one by one. Which entries have a value of 0, and which are left after they are deleted?',
        'Hint: look at line 2 and line 4. Which collection is `list(...)` made from, and which collection does `del` act on?',
        'Hint: after a `del`, which collection has changed, and which one has not? What does the loop see?',
      ],
    },
  },
  criteria: [
    ['Predict the result', ['Not correct yet: check which entries are left after the loop.', 'Partly right: some entries are missing or extra.', 'Correct contents.']],
    ['Identify what changes', ['Not shown: which collection is looped over and which is modified.', 'Only one of the two collections is identified.', 'You separated the collection being looped over from the one being modified.']],
    ['Explain why it works', ['No explanation of why the correction works.', 'Partial: say that removal changes the original while the copy used for looping stays unchanged.', 'Accurate: removal changes the original; the copy used for looping stays unchanged.']],
  ],

  // Sample answers for the demo tools, modelled on the three interview participants.
  personas: {
    p2: {
      predict: 'I think it raises a RuntimeError because the dictionary changes size while I am looping over it.',
      fix: 'Loop over a copy of the keys, list(d.keys()), and delete from d.',
      probe: 'Yes, "b" is still in the key list because it is a separate copy. Deleting from d does not change that list, so the loop is not disturbed.',
      ind1: ['{"ben": 82, "dee": 91}', 'The loop goes over list(scores.keys()), a separate copy of the keys. The scores dictionary is the one being changed.', 'Deleting only changes the original dictionary. The copy the loop reads stays unchanged, so the loop is never disturbed.'],
      ind2: ['{"ink": 12, "clip": 7}', 'The loop goes over list(stock.keys()), a separate copy of the keys. The stock dictionary is the one being changed.', 'Deleting only changes the original dictionary. The copy the loop reads stays unchanged, so the loop is never disturbed.'],
    },
    p3: {
      predict: 'It deletes b and then keeps checking the remaining keys.',
      fix: 'Maybe loop through list(d.keys())?',
      probe: 'I think the key list also loses b when I delete it.',
      probe2: 'Oh I see, the key list is a separate copy so it still has b. Deleting from d does not change it.',
      ind1: ['{"ben": 82, "dee": 91}', 'It loops through the keys list.', 'Because it uses a copy so it works.'],
      ind2: ['{"ink": 12, "clip": 7}', 'The loop goes over list(stock.keys()), a separate copy of the keys. The stock dictionary is the one being changed.', 'Deleting only changes the original dictionary. The copy the loop reads stays unchanged, so the loop is never disturbed.'],
    },
    p1: {
      predict: 'I am not sure what happens.',
      fix: 'I do not know.',
      probe: 'I am not sure.',
      ind1: ['{"amy": 45, "ben": 82}', 'Not sure.', 'Not sure.'],
      ind2: ['{"pen": 0, "ink": 12}', 'Not sure.', 'Not sure.'],
    },
  },
};
