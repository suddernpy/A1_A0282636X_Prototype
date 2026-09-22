# Python Tutor: Prototype

## Prototyping method

The prototype uses a **simulated CUI/state-machine method**. Tutor responses, execution traces, scoring rules, exercises, hints, and misconception handling are predefined in JavaScript. It does not use a backend, execute Python, or call an LLM.

## Learning goal

The CUI helps learners develop genuine understanding by guiding them to predict, examine evidence, explain their reasoning, and apply a concept independently instead of simply accepting a solution.

## How to open and run

No installation or build step is required.

1. Open `index.html` in a modern browser.
2. Keep the browser wide enough to see the left history panel, chat, and right workspace. The layout adapts on smaller screens.
3. Press **Restart** to begin the interaction again.

## How to view or roleplay the prototype

Follow the conversation as the learner and use the controls as the CUI:

1. Select a **Demo learner** in the top bar.
2. Press **Fill** whenever a scripted learner response is required.
3. Press **Send** to submit the filled response.
4. Continue using the suggested buttons and execution controls as they appear. The demo paths are hard-coded, so typing an alternative prompt or response may not trigger the intended next step.

## Planned CUI features

1. **Predict:** type what you think the dictionary loop will do and why. The execution display stays locked until a prediction is made.
2. **Examine:** use **Next step** to inspect the buggy run, propose a safe correction, and step through the fixed version. During execution, the code and execution cards move into the chat with code above execution.
3. **Apply:** select **I’m ready**, then answer three questions about a new dictionary example. The display and guided hints are hidden during this check.
4. Review the scorecard and progress panel. An unaided 6/6 attempt is recorded as mastery.

You can also:

- Click code lines and press **Explain** to ask about selected lines.
- Type clarification questions such as “What does `del` do?” during the guided stages.
- Use the collapsible **Past questions** panel on the left to review questions asked in the current session.
- Use **Ask about your own Python** on the right to submit custom code and a question as conversation context.

## Demo-only features

These features support presentation and testing; they are not part of the core learning interaction:

- The **Demo learner** selector and **Fill** button reproduce prepared learner answers.
- Prepared persona answers represent strong, partially mistaken, and unsure learner behaviours.
- The custom-code panel captures input but does not execute or analyse arbitrary Python.
- The progress panel stores mastery locally in the browser for demonstration purposes.

## Files

- `index.html` — page structure and interface regions.
- `style.css` — layout, themes, responsive behaviour, and visual states.
- `script.js` — state machine, conversation flow, interaction handling, and scoring.
- `content.js` — exercises, traces, explanations, hints, rules, criteria, and demo answers.
