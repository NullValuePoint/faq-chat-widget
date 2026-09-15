// Intent-engine tests for the FAQ chat widget. Run: node test.js
// Loads the real widget code and the real knowledge base, then checks
// that representative questions resolve to the right intent.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;
const sandbox = { window: {}, document: undefined, setTimeout: undefined };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, "chat-widget.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, "kb.js"), "utf8"), sandbox);

const engine = sandbox.window.ChatWidget.engine;
const intents = sandbox.window.PVD_CONFIG.intents;

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; } else { fail++; }
  console.log((ok ? "PASS" : "FAIL") + " | " + name +
    (ok ? "" : "  (got '" + actual + "', wanted '" + expected + "')"));
}

function intentIdFor(text) {
  const hit = engine.matchIntent(text, intents);
  if (!hit) return null;
  if (hit.smalltalk) return "smalltalk:" + hit.smalltalk.id;
  if (hit.ambiguous) return "ambiguous:" + hit.ambiguous.map(i => i.id).join("+");
  return hit.intent.id;
}

// Phrase matches
check("hours question", intentIdFor("What are your hours?"), "hours");
check("hours rephrased", intentIdFor("when are you open"), "hours");
check("saturday hours", intentIdFor("Are you open Saturday?"), "weekend-hours");
check("weekend", intentIdFor("do you work weekends"), "weekend-hours");
// Keyword matches, incl. inflection fallback
check("delta dental", intentIdFor("Do you take Delta Dental?"), "insurance");
check("whitening price", intentIdFor("How much is whitening?"), "whitening");
check("whiten inflection", intentIdFor("I want whiter teeth"), "whitening");
check("implants", intentIdFor("Do you do implants?"), "implants");
check("toothache", intentIdFor("My tooth hurts"), "emergency");
check("emergency keyword", intentIdFor("I have a dental emergency"), "emergency");
check("kids", intentIdFor("Do you see kids?"), "kids");
check("anxiety", intentIdFor("I'm nervous about dentists"), "anxiety");
check("booking", intentIdFor("How do I book a visit?"), "booking");
check("cancel policy", intentIdFor("What is your cancellation policy?"), "cancellation");
check("payment plans", intentIdFor("Do you offer payment plans?"), "payment");
check("location", intentIdFor("Where are you located?"), "location");
check("parking", intentIdFor("Where do I park?"), "parking");
check("new patients", intentIdFor("Do you take new patients?"), "new-patients");
check("second opinion", intentIdFor("Can I get a second opinion?"), "second-opinion");
check("cleaning length", intentIdFor("How long does a cleaning take?"), "cleaning-length");
check("invisalign", intentIdFor("Do you offer Invisalign?"), "invisalign");

// Disambiguation: cancellation vs booking are close
check("ambiguous cancel+booking", intentIdFor("cancel my cleaning appointment"), "ambiguous:cancellation+booking");

// Small talk
check("greeting", intentIdFor("Hi there!"), "smalltalk:greeting");
check("thanks", intentIdFor("thank you very much"), "smalltalk:thanks");
check("bye", intentIdFor("bye, see you later"), "smalltalk:bye");
check("who are you", intentIdFor("are you a robot?"), "smalltalk:who");
check("human", intentIdFor("Can I talk to a person?"), "smalltalk:human");

// Fallback
check("gibberish falls back", intentIdFor("asdkfjhasdf qwerty"), null);
check("off-topic falls back", intentIdFor("what is the weather like"), null);

// Conversational context follow-ups
check("followup saturday after hours",
  engine.resolveFollowUp("what about Saturday?", "hours"), "weekend-hours");
check("followup whitening after pricing",
  engine.resolveFollowUp("what about whitening?", "pricing"), "whitening");
check("followup pain after booking",
  engine.resolveFollowUp("actually it's urgent, my tooth hurts", "booking"), "emergency");
check("no followup without context",
  engine.resolveFollowUp("what about Saturday?", null), null);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
