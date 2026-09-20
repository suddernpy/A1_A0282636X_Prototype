# Learning CUI Prototype: why loop over a copy?

CS3249 Assignment 1 (A0282636X). A hard-coded prototype of the proposed learning CUI. Open `index.html` in a browser; no build or server needed.

## What it demonstrates
One scripted activity on removing items from a Python dictionary while iterating, plus a list variation.

1. **Predict**: the learner predicts and explains before the execution display unlocks.
2. **Examine**: step through the crash, propose a fix, then explain why the copied key list is unaffected by `del`.
3. **Apply**: a new example with the display and hints hidden. Prediction and reasoning are scored separately (0-2 for each of three criteria, out of 6). Using the hint marks the attempt as assisted and leads to the list variation.

Click any code line to ask about it; the reply is tied to the whole program and the current step, then returns to the open question. The "Demo persona" menu fills answers styled after the three interview participants (P1 unsure, P2 strong, P3 partial) so each path can be shown quickly.

## What is hard-coded vs. the full system
| Prototype | Full system |
|---|---|
| Keyword/regex rules sort answers into a few cases | LLM interprets the learner's free-text reasoning |
| Prepared reply for each case | LLM-generated clarification, checked against the exercise data |
| Regex scoring of the rubric | LLM assessment checked against the rubric |
| Fixed exercises and traces (`content.js`) | Same: verified exercises, criteria and visual states |

Files: `index.html`, `style.css`, `script.js` (state machine and UI), `content.js` (all exercises, traces, replies and rules).
