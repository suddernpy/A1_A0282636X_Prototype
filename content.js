// All hard-coded material for the prototype: exercises, traces, scripted replies and keyword rules.
// In the full system the exercises/traces would stay here, while the replies would come from an LLM.

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
    ind1: [
      'd = {"x": 5, "y": 0, "z": 7, "w": 0}',
      'for key in list(d.keys()):',
      '    if d[key] == 0:',
      '        del d[key]',
      'print(d)',
    ],
    ind2: [
      'nums = [1, 2, 2, 3]',
      'for n in nums[:]:',
      '    if n == 2:',
      '        nums.remove(n)',
      'print(nums)',
    ],
  },

  // Execution traces. d = [key, value] pairs; keys = the separate key list (null if none); cur = key being visited.
  traces: {
    buggy: [
      { line: 1, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: null,
        note: 'd is created. The loop will read d directly.' },
      { line: 2, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: 'a',
        note: 'First pass: key = "a". d["a"] is 1, so nothing is deleted.' },
      { line: 3, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: 'b',
        note: 'Second pass: key = "b". d["b"] == 2 is True.' },
      { line: 4, d: [['a', 1], ['c', 3]], keys: null, cur: 'b',
        note: 'del d["b"] runs. d now has 2 entries, but the loop is still reading d.' },
      { line: 2, d: [['a', 1], ['c', 3]], keys: null, cur: null,
        error: 'RuntimeError: dictionary changed size during iteration',
        note: 'The loop asks d for its next key and notices d changed size while it was being read.' },
    ],
    fixed: [
      { line: 1, d: [['a', 1], ['b', 2], ['c', 3]], keys: null, cur: null,
        note: 'd is created.' },
      { line: 2, d: [['a', 1], ['b', 2], ['c', 3]], keys: ['a', 'b', 'c'], cur: null,
        note: 'list(d.keys()) builds a separate list of the keys. The loop will read this list, not d.' },
      { line: 3, d: [['a', 1], ['b', 2], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'a',
        note: 'key = "a". d["a"] is 1, so nothing is deleted.' },
      { line: 4, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'b',
        note: 'key = "b". d["b"] == 2, so del d["b"] runs. Compare the two boxes.' },
      { line: 3, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: 'c',
        note: 'The loop moves on to "c" from the key list. d["c"] is 3, so nothing is deleted.' },
      { line: 2, d: [['a', 1], ['c', 3]], keys: ['a', 'b', 'c'], cur: null,
        note: 'The key list is used up, so the loop ends. d is {"a": 1, "c": 3} with no error.' },
    ],
  },
  triggerStep: { buggy: 4, fixed: 3 },

  boxLabels: {
    buggy: { d: 'd — the loop reads this AND del changes it', keys: '' },
    fixed: { d: 'd — the collection being modified', keys: 'list(d.keys()) — the collection being looped over' },
  },

  lineHelp: {
    buggy: {
      1: 'This creates the dictionary d with three entries. It is the collection the rest of the program works on.',
      2: '"for key in d:" walks through d one key at a time. The loop is reading d itself, not a copy, so d needs to keep the same size while the loop runs.',
      3: '"if d[key] == 2:" looks up the value for the current key and checks whether it is 2. Only "b" passes. This only reads d; the change happens on the next line.',
      4: '"del d[key]" deletes the current entry from d. Together with line 2, the loop is walking through d while d is being changed.',
    },
    fixed: {
      1: 'This creates the dictionary d with three entries.',
      2: 'list(d.keys()) builds a separate list of the keys right now: ["a", "b", "c"]. The loop walks through that list, not through d.',
      3: 'Same check as before: it reads d for the value of the current key.',
      4: '"del d[key]" still changes d, but d is no longer what the loop is walking through, so the loop is not disturbed.',
    },
  },

  reask: {
    predict: 'Back to the question: what do you think happens when this code runs, and why?',
    watchTrace: 'Carry on stepping through the display when you are ready.',
    fix: 'Back to the question: how could we change the code so the removal is safe?',
    watchFixed: 'Carry on stepping through the display; I will pause at the deletion.',
    probe: 'Back to the question: is "b" still in the key list, and why does that matter?',
  },

  // Keyword rules used to sort free-text answers into a few prepared cases.
  rules: {
    unsure: /not sure|don'?t know|do not know|dunno|idk|no idea|confused|\bhelp\b|^\s*\?+\s*$/i,
    predictError: /error|crash|exception|fail|stop|not allowed|can'?t|cannot|changed size|breaks?/i,
    fixIdea: /copy|list\s*\(|\.keys|separate|another list|different list|new list|snapshot|\[:\]/i,
    probeGood: /still (has|have|contains?|includes?|there|in)|unchanged|not (be )?(change|affect|remov|delet|touch)|doesn'?t (change|affect|remove|delete)|isn'?t (changed|affected)|separate|independent|stays?|remains?|the same/i,
    probeMisconception: /\balso\b|\btoo\b|\bboth\b|as well|(is|gets?|was) (removed|deleted)|no longer|loses? (b|it)/i,
    losingTrack: /los(e|es|ing) track/i,
  },

  // Independent-check scoring rules (hard-coded stand-in for the LLM assessment against the rubric).
  scoring: {
    travers: /(loop|iterat|go(es)? through|walk|traverse|read)[^.]*?(copy|list\s*\(|keys|separate|\[:\])|(copy|keys|separate|\[:\])[^.]*?(loop|iterat)/i,
    modified: /(delet|remov|modif|chang|edit)[^.]*?(original|\bd\b|dictionary|nums)|(original|\bd\b|dictionary|nums)[^.]*?(delet|remov|modif|chang|edit)/i,
    unchanged: /unchanged|not (be )?(change|affect|modif|touch)|doesn'?t (change|get changed|affect)|stays? (the )?same|still (has|contains|includes)|remains?|independent|separate/i,
  },

  independent: {
    1: {
      label: 'dictionary',
      intro: 'Now try one on your own. The display and hints are hidden. This program removes every entry whose value is 0. Give (1) what d contains after the loop, and (2) your reasoning about the two collections involved and why it works.',
      hint: 'Hint: two different collections are involved. Which one does the for-loop read, and which one does del change?',
      answer: { predict: /x\W{0,2}5/, predict2: /z\W{0,2}7/, bad: /y\W{0,2}0|w\W{0,2}0/ },
    },
    2: {
      label: 'list',
      intro: 'Here is another prepared variation, this time with a list. The display and hints are hidden. Give (1) what nums contains after the loop, and (2) your reasoning about the two collections involved and why it works.',
      hint: 'Hint: two different lists are involved. Which one does the for-loop read, and which one does remove() change?',
    },
  },

  // Demo answers for the persona switcher, modelled on the three interview participants.
  personas: {
    p2: {
      label: 'P2 style (strong)',
      predict: 'I think it raises a RuntimeError because the dictionary changes size while I am looping over it.',
      fix: 'Loop over a copy of the keys, list(d.keys()), and delete from d.',
      probe: 'Yes, "b" is still in the key list because it is a separate copy. Deleting from d does not change that list, so the loop is not disturbed.',
      indPredict1: '{"x": 5, "z": 7}',
      indReason1: 'The loop goes through list(d.keys()), a separate copy that stays unchanged. The deletions only change the original d, so the loop is never disturbed.',
      indPredict2: '[1, 3]',
      indReason2: 'The loop goes through nums[:], a separate copy that stays unchanged. remove() only changes the original nums list, so the loop is never disturbed.',
    },
    p3: {
      label: 'P3 style (partial)',
      predict: 'It deletes b and then keeps checking the remaining keys.',
      fix: 'Maybe loop through list(d.keys())?',
      probe: 'I think the key list also loses b when I delete it.',
      indPredict1: '{"x": 5, "z": 7}',
      indReason1: 'It loops through the keys list so it works.',
      indPredict2: '[1, 3]',
      indReason2: 'It loops through a copy so it works.',
    },
    p1: {
      label: 'P1 style (unsure)',
      predict: 'I am not sure what happens.',
      fix: 'I do not know.',
      probe: 'I am not sure.',
      indPredict1: '{"x": 5, "y": 0}',
      indReason1: 'Not sure.',
      indPredict2: '[1, 2, 3]',
      indReason2: 'Not sure.',
    },
  },
};
