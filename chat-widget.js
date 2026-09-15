/* Prairie View Dental — FAQ chat widget.
 * Embeddable, dependency-free chat widget with a small on-device intent
 * engine: normalization, stop-word removal, weighted keyword + phrase
 * scoring, disambiguation, small-talk handling, and conversational context.
 * No network calls; the whole knowledge base ships with the page.
 */
(function () {
  "use strict";

  /* ---------------- Intent engine (pure logic) ---------------- */

  var STOPWORDS = {};
  ("a,an,the,and,or,but,is,are,was,were,do,does,did,can,could,would,should,will," +
   "i,you,he,she,it,we,they,my,your,his,her,its,our,their,me,him,us,them,to,of," +
   "in,on,at,for,with,about,as,by,from,have,has,had,be,been,this,that,these," +
   "those,there,here,what,which,who,whom,whose,when,where,why,how,any,some,so," +
   "if,then,than,too,very,just,not,no,yes,there's,it's,I'm,don't,doesn't,s,t,m," +
   "re,ve,ll,d,kind,sort,really,also,like,get,got,one,two,may,might")
    .split(",").forEach(function (w) { STOPWORDS[w] = true; });

  function normalize(text) {
    return String(text).toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function stem(tok) {
    if (tok.length > 4 && tok.slice(-3) === "ies") return tok.slice(0, -3) + "y";
    if (tok.length > 4 && tok.slice(-2) === "es") return tok.slice(0, -2);
    if (tok.length > 3 && tok.slice(-1) === "s") return tok.slice(0, -1);
    return tok;
  }

  function tokens(text) {
    return normalize(text).split(" ")
      .filter(function (t) { return t && !STOPWORDS[t]; })
      .map(stem);
  }

  // Small-talk is matched by regex before the FAQ scorer runs.
  var SMALLTALK = [
    { id: "greeting", re: /^(hi|hey|hello|yo|howdy|good\s?(morning|afternoon|evening))\b/,
      answer: "Hi there! I'm the Prairie View Dental helper. Ask me about hours, services, pricing, insurance, or booking a visit.",
      chips: ["What are your hours?", "Do you take insurance?", "How do I book a visit?"] },
    { id: "thanks", re: /\b(thanks|thank you|thx|ty)\b/,
      answer: "You're welcome! Anything else I can help with?",
      chips: ["What are your hours?", "How do I book a visit?"] },
    { id: "bye", re: /\b(bye|goodbye|see you|talk later|have a (good|great) (day|night))\b/,
      answer: "Goodbye! We hope to see your smile soon.",
      chips: [] },
    { id: "who", re: /\b(who are you|your name|what are you|are you (a )?robot|are you ai)\b/,
      answer: "I'm the Prairie View Dental website assistant. I answer common questions instantly; for anything complicated I'll point you to our front desk.",
      chips: ["Can I talk to a person?", "What services do you offer?"] },
    { id: "human", re: /(talk to|speak to|connect me).{0,20}(person|human|someone|agent)|real person|call (me|someone)/,
      answer: "Of course. Call our front desk at (402) 555-0188 and a real person will help you right away.",
      chips: ["What are your hours?"] }
  ];

  function kwScore(kw, tok) {
    if (kw[tok]) return kw[tok];
    // Prefix fallback for inflections the stemmer misses (whiten <-> whitening).
    for (var k in kw) {
      if (k.length >= 5 && tok.length >= 5 &&
          (k.indexOf(tok) === 0 || tok.indexOf(k) === 0)) {
        return Math.max(1, Math.floor(kw[k] / 2));
      }
    }
    return 0;
  }

  function scoreIntent(intent, toks, normText) {
    var score = 0;
    (intent.phrases || []).forEach(function (p) {
      // Longer phrases are more specific, so they outscore short ones
      // ("how much is whitening" beats "how much").
      if (normText.indexOf(p) !== -1) score += 4 + 2 * p.split(" ").length;
    });
    var kw = intent.keywords || {};
    toks.forEach(function (t) {
      score += kwScore(kw, t);
    });
    return score;
  }

  // Returns {intent} | {ambiguous:[i1,i2]} | {smalltalk} | null
  function matchIntent(text, intents) {
    var normText = normalize(text);
    for (var s = 0; s < SMALLTALK.length; s++) {
      if (SMALLTALK[s].re.test(normText)) return { smalltalk: SMALLTALK[s] };
    }
    var toks = tokens(text);
    if (!toks.length) return null;
    var ranked = intents.map(function (intent) {
      return { intent: intent, score: scoreIntent(intent, toks, normText) };
    }).sort(function (a, b) { return b.score - a.score; });
    var top = ranked[0], second = ranked[1];
    if (!top || top.score < 4) return null;
    if (second && second.score >= 4 && (top.score - second.score) <= 2) {
      return { ambiguous: [top.intent, second.intent] };
    }
    return { intent: top.intent };
  }

  // Short follow-ups that only make sense given the previous answer.
  function resolveFollowUp(text, lastIntentId) {
    var n = normalize(text);
    if (lastIntentId === "hours" && /\b(saturday|sunday|weekend|sat|sun)\b/.test(n)) {
      return "weekend-hours";
    }
    if (lastIntentId === "pricing" && /\b(whiten\w*|bleach\w*)/.test(n)) {
      return "whitening";
    }
    if (lastIntentId === "services" && /\b(whiten\w*|bleach\w*)/.test(n)) {
      return "whitening";
    }
    if (lastIntentId === "booking" && /\b(emergency|urgent|pain|hurt|broken|chipped)\b/.test(n)) {
      return "emergency";
    }
    return null;
  }

  /* ---------------- Widget UI ---------------- */

  var launcherSVG =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ChatWidget(config) {
    this.cfg = config;
    this.open = false;
    this.lastIntentId = null;
    this.build();
  }

  ChatWidget.prototype.build = function () {
    var cfg = this.cfg;
    var root = el("div", "cw-root");
    root.style.setProperty("--cw-primary", cfg.primaryColor || "#0e6b5c");

    var launcher = el("button", "cw-launcher", launcherSVG);
    launcher.setAttribute("aria-label", "Chat with us");
    launcher.setAttribute("aria-expanded", "false");

    var panel = el("div", "cw-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with " + cfg.businessName);
    panel.hidden = true;

    var header = el("div", "cw-header",
      '<span class="cw-dot" aria-hidden="true"></span>' +
      '<div><strong>' + esc(cfg.businessName) + '</strong>' +
      '<span class="cw-status">Online — replies instantly</span></div>' +
      '<button class="cw-close" aria-label="Close chat">&times;</button>');

    var messages = el("div", "cw-messages");
    messages.setAttribute("aria-live", "polite");

    var chips = el("div", "cw-chips");

    var form = el("form", "cw-input-row");
    var input = el("input", "cw-input");
    input.type = "text";
    input.placeholder = "Ask a question…";
    input.setAttribute("aria-label", "Type your question");
    input.autocomplete = "off";
    var send = el("button", "cw-send", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(chips);
    panel.appendChild(form);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    this.root = root; this.panel = panel; this.launcher = launcher;
    this.messages = messages; this.chips = chips; this.input = input;

    var self = this;
    launcher.addEventListener("click", function () { self.toggle(); });
    header.querySelector(".cw-close").addEventListener("click", function () { self.toggle(false); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (v) { self.sendUser(v); input.value = ""; }
    });
    chips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-chip]");
      if (b) self.sendUser(b.dataset.chip);
    });
    messages.addEventListener("click", function (e) {
      var fb = e.target.closest("[data-fb]");
      if (!fb || fb.disabled) return;
      fb.disabled = true;
      var wrap = fb.closest(".cw-feedback");
      wrap.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
      wrap.insertAdjacentHTML("beforeend",
        '<span class="cw-fb-thanks">' +
        (fb.dataset.fb === "up" ? "Glad that helped!" : "Thanks — we'll improve this answer.") +
        "</span>");
    });
  };

  ChatWidget.prototype.toggle = function (force) {
    var want = typeof force === "boolean" ? force : !this.open;
    this.open = want;
    this.panel.hidden = !want;
    this.launcher.setAttribute("aria-expanded", String(want));
    this.root.classList.toggle("cw-open", want);
    if (want && !this.greeted) {
      this.greeted = true;
      this.botSay(this.cfg.greeting ||
        "Hi! I'm the " + this.cfg.businessName + " helper. Ask me about hours, services, pricing, or insurance.",
        this.cfg.starterChips || ["What are your hours?", "What services do you offer?", "Do you take insurance?"]);
      this.input.focus();
    } else if (want) {
      this.input.focus();
    }
  };

  ChatWidget.prototype.scrollDown = function () {
    this.messages.scrollTop = this.messages.scrollHeight;
  };

  ChatWidget.prototype.addMsg = function (who, html, chips) {
    var row = el("div", "cw-row cw-" + who);
    var bubble = el("div", "cw-bubble", html);
    row.appendChild(bubble);
    if (who === "bot") {
      var fb = el("div", "cw-feedback",
        '<button data-fb="up" aria-label="Helpful">&#128077;</button>' +
        '<button data-fb="down" aria-label="Not helpful">&#128078;</button>');
      row.appendChild(fb);
    }
    this.messages.appendChild(row);
    this.renderChips(chips || []);
    this.scrollDown();
  };

  ChatWidget.prototype.renderChips = function (chips) {
    this.chips.innerHTML = chips.map(function (c) {
      return '<button type="button" data-chip="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  };

  ChatWidget.prototype.botSay = function (html, chips, delayMs) {
    var self = this;
    var typing = el("div", "cw-row cw-bot");
    typing.innerHTML = '<div class="cw-bubble cw-typing"><span></span><span></span><span></span></div>';
    this.messages.appendChild(typing);
    this.scrollDown();
    var wait = typeof delayMs === "number" ? delayMs
      : Math.min(1600, 500 + html.length * 6);
    setTimeout(function () {
      typing.remove();
      self.addMsg("bot", html, chips);
    }, wait);
  };

  ChatWidget.prototype.sendUser = function (text) {
    this.addMsg("user", esc(text));
    var self = this;
    setTimeout(function () { self.respond(text); }, 250);
  };

  ChatWidget.prototype.respond = function (text) {
    var cfg = this.cfg;
    var followId = resolveFollowUp(text, this.lastIntentId);
    var hit = followId
      ? { intent: cfg.intentsById[followId] }
      : matchIntent(text, cfg.intents);

    if (hit && hit.smalltalk) {
      this.lastIntentId = hit.smalltalk.id;
      this.botSay(esc(hit.smalltalk.answer), hit.smalltalk.chips);
      return;
    }
    if (hit && hit.ambiguous) {
      var a = hit.ambiguous[0], b = hit.ambiguous[1];
      this.botSay("I want to make sure I answer the right thing — did you mean " +
        "<strong>" + esc(a.label) + "</strong> or <strong>" + esc(b.label) + "</strong>?",
        [a.chip, b.chip]);
      return;
    }
    if (hit && hit.intent) {
      this.lastIntentId = hit.intent.id;
      this.botSay(hit.intent.answer, hit.intent.chips);
      return;
    }
    this.botSay("I don't have an answer for that yet. Call us at <strong>" +
      esc(cfg.phone) + "</strong> or email <strong>" + esc(cfg.email) +
      "</strong> and we'll sort it out.",
      cfg.starterChips || []);
  };

  /* ---------------- Public API ---------------- */

  window.ChatWidget = {
    init: function (config) {
      if (!config || !config.businessName || !config.intents) {
        throw new Error("ChatWidget.init needs {businessName, intents}");
      }
      config.intentsById = {};
      config.intents.forEach(function (i) { config.intentsById[i.id] = i; });
      return new ChatWidget(config);
    },
    // Exposed for automated testing of the intent engine.
    engine: {
      normalize: normalize,
      tokens: tokens,
      matchIntent: matchIntent,
      resolveFollowUp: resolveFollowUp,
      SMALLTALK: SMALLTALK
    }
  };
})();
