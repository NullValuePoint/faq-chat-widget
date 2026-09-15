# FAQ Chat Widget

An embeddable, dependency-free FAQ chat widget with a small on-device intent engine. No frameworks, no network calls, no API keys. Drop two files into any website and visitors get instant answers to common questions.

**Live demo:** a fictional Lincoln, NE dental office with the widget answering questions about hours, pricing, insurance, booking, and more.

## How it works

`chat-widget.js` contains the whole widget:

- **Intent engine** — normalizes input, strips stop-words, applies light stemming, then scores each FAQ by weighted keyword matches plus phrase matches. Longer, more specific phrases outscore short generic ones.
- **Disambiguation** — when two topics score close (e.g. "cancel my cleaning appointment"), it asks which one you meant instead of guessing.
- **Small talk** — greetings, thanks, goodbyes, "who are you", and "talk to a person" are handled before the FAQ scorer runs.
- **Conversational context** — remembers the last topic so follow-ups like "what about Saturday?" resolve correctly.
- **Graceful fallback** — unknown questions get the business phone and email, never a hallucinated answer.

The UI (in `chat-widget.css`, fully namespaced under `.cw-` so it can't clash with host styles) includes a floating launcher, typing indicator, quick-reply chips, and thumbs up/down feedback on answers.

## Embed it in your site

```html
<link rel="stylesheet" href="chat-widget.css">
<script src="chat-widget.js"></script>
<script>
  ChatWidget.init({
    businessName: "Your Business",
    primaryColor: "#0e6b5c",
    phone: "(402) 555-0100",
    email: "hello@example.com",
    greeting: "Hi! Ask me about hours, services, or pricing.",
    starterChips: ["What are your hours?", "How do I book?"],
    intents: [
      {
        id: "hours",
        label: "office hours",          // used in "did you mean …?" prompts
        chip: "What are your hours?",   // sample question shown as a chip
        keywords: { hour: 3, open: 3, close: 3 },
        phrases: ["what are your hours", "when are you open"],
        answer: "We're open <strong>Mon–Fri, 9–5</strong>.",
        chips: ["How do I book?"]
      }
      // …add as many intents as you like
    ]
  });
</script>
```

See `kb.js` for a complete 19-topic example knowledge base.

## Tests

The intent engine is exposed as `ChatWidget.engine` for testing:

```
node test.js
```

33 assertions covering phrase matches, keyword matches, inflections, disambiguation, small talk, fallbacks, and contextual follow-ups.

## Project structure

| File | Purpose |
|---|---|
| `chat-widget.js` | Widget + intent engine (the reusable product) |
| `chat-widget.css` | Namespaced widget styles |
| `kb.js` | Example knowledge base for the demo business |
| `index.html` / `styles.css` | Demo site for the fictional Prairie View Dental |
| `test.js` | Intent-engine test suite |

*Prairie View Dental is a fictional demo business. The phone number, address, prices, and hours are invented for the demo.*
