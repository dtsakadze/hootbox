/*! Hootbox feedback widget · MIT License · https://github.com/dtsakadze/hootbox */
(() => {
	if (window.Hootbox?.__loaded) return;

	const script = document.currentScript || document.querySelector("script[data-key][src*='widget.js']");
	if (!script) return;
	const KEY = script.getAttribute("data-key");
	const BASE = new URL(script.src).origin;
	const HIDE_BUTTON = script.hasAttribute("data-hide-button");
	if (!KEY) {
		console.warn("[hootbox] Missing data-key on the widget script tag.");
		return;
	}

	const COLORS = { violet: "#7b61ff", tomato: "#ff6b4a", sunny: "#ffc83d", mint: "#2dd4a0", sky: "#4aa8ff", bubblegum: "#ff7ac3" };
	const TYPES = {
		idea: ["💡", "Idea", "What would make things better?"],
		bug: ["🐞", "Bug", "What happened? What did you expect?"],
		praise: ["💛", "Praise", "What made you smile?"],
		question: ["❓", "Question", "What would you like to know?"],
		other: ["💬", "Other", "Tell us everything…"],
	};
	const FACES = ["😖", "🙁", "😐", "🙂", "😍"];

	const state = { config: null, open: false, type: null, rating: null, identity: {}, metadata: {}, sending: false };

	const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-rounded, "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif; }
.launcher, .panel { position: fixed; z-index: 2147483000; bottom: 20px; }
.right { right: 20px; } .left { left: 20px; }
.launcher { display: flex; align-items: center; gap: 8px; padding: 10px 18px 10px 12px; border: 2px solid #1e1b2e; border-radius: 999px;
  background: var(--accent); color: #1e1b2e; font-weight: 800; font-size: 15px; cursor: pointer; box-shadow: 3px 3px 0 #1e1b2e;
  transition: transform .15s, box-shadow .15s; }
.launcher:hover { transform: translate(-1px,-1px) rotate(-2deg); box-shadow: 4px 4px 0 #1e1b2e; }
.launcher:active { transform: translate(2px,2px); box-shadow: 0 0 0 #1e1b2e; }
.launcher svg { width: 26px; height: 26px; }
.panel { width: min(380px, calc(100vw - 24px)); max-height: calc(100vh - 40px); overflow: auto; background: #fff; color: #1e1b2e;
  border: 2px solid #1e1b2e; border-radius: 26px; box-shadow: 6px 6px 0 #1e1b2e; animation: pop .3s cubic-bezier(.34,1.56,.64,1); }
@keyframes pop { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } .launcher { transition: none; } }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--accent); border-bottom: 2px solid #1e1b2e; border-radius: 24px 24px 0 0; }
.head h2 { margin: 0; font-size: 17px; font-weight: 900; flex: 1; }
.x { border: 2px solid #1e1b2e; background: #fff; border-radius: 999px; width: 30px; height: 30px; cursor: pointer; font-size: 15px; font-weight: 900; line-height: 1; color: #1e1b2e; }
form, .done { padding: 16px; display: grid; gap: 12px; }
.types { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 2px solid #1e1b2e; background: #fff; border-radius: 999px; padding: 5px 11px; font-size: 13px; font-weight: 800; cursor: pointer; color: #5d5873; }
.chip[aria-pressed="true"] { background: #fff1c9; color: #1e1b2e; box-shadow: 2px 2px 0 #1e1b2e; transform: translateY(-1px); }
textarea, input { width: 100%; border: 2px solid #1e1b2e; border-radius: 16px; padding: 10px 12px; font-size: 14px; color: #1e1b2e; background: #fff; outline: none; }
textarea { min-height: 110px; resize: vertical; line-height: 1.45; }
textarea:focus, input:focus { border-color: #7b61ff; box-shadow: 0 0 0 4px #ebe5ff; }
.label { font-size: 12px; font-weight: 800; color: #5d5873; margin: 0 0 4px; }
.faces { display: flex; gap: 4px; }
.face { width: 42px; height: 42px; font-size: 24px; border: 2px solid transparent; border-radius: 14px; background: none; cursor: pointer; transition: transform .1s; }
.face:hover { transform: scale(1.12); background: #f3efe4; }
.face[aria-pressed="true"] { border-color: #1e1b2e; background: #ffc83d; transform: scale(1.1); }
.faces.picked .face:not([aria-pressed="true"]) { opacity: .4; filter: grayscale(1); }
.send { border: 2px solid #1e1b2e; border-radius: 999px; background: #1e1b2e; color: #fff; font-weight: 900; font-size: 15px; padding: 11px; cursor: pointer; box-shadow: 2px 2px 0 #7b61ff; }
.send:disabled { opacity: .6; cursor: wait; }
.err { background: #ffe4dc; border: 2px solid #1e1b2e; border-radius: 14px; padding: 8px 12px; font-size: 13px; font-weight: 700; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.done { text-align: center; justify-items: center; padding: 28px 20px; }
.done p { margin: 0; color: #5d5873; font-size: 14px; }
.done strong { font-size: 22px; font-weight: 900; }
.foot { text-align: center; font-size: 11px; color: #9a95ad; padding: 0 0 12px; }
.foot a { color: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
:focus-visible { outline: 3px solid #7b61ff; outline-offset: 2px; }
`;

	const OWL = (body) =>
		`<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M28 38 22 8l28 16zM92 38l6-30-28 16z" fill="${body}" stroke="#1e1b2e" stroke-width="6" stroke-linejoin="round"/><path d="M18 62C18 32 38 18 60 18s42 14 42 44v24c0 18-18 26-42 26s-42-8-42-26z" fill="${body}" stroke="#1e1b2e" stroke-width="6"/><circle cx="41" cy="54" r="14" fill="#fff" stroke="#1e1b2e" stroke-width="5"/><circle cx="79" cy="54" r="14" fill="#fff" stroke="#1e1b2e" stroke-width="5"/><circle cx="43" cy="56" r="6" fill="#1e1b2e"/><circle cx="81" cy="56" r="6" fill="#1e1b2e"/><path d="M52 66h16l-8 12z" fill="#ffc83d" stroke="#1e1b2e" stroke-width="4" stroke-linejoin="round"/></svg>`;

	const host = document.createElement("div");
	host.setAttribute("data-hootbox-root", "");
	const root = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = CSS;
	root.appendChild(style);

	const el = (tag, attrs, children) => {
		const n = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs || {})) {
			if (k === "text") n.textContent = v;
			else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
			else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
		}
		for (const c of children || []) if (c) n.appendChild(c);
		return n;
	};

	let launcher;
	let panel;
	let lastFocus;

	function side() {
		return state.config.position === "bottom-left" ? "left" : "right";
	}

	function renderLauncher() {
		if (HIDE_BUTTON) return;
		launcher = el("button", { class: `launcher ${side()}`, type: "button", "aria-haspopup": "dialog", onclick: () => api.open() });
		launcher.innerHTML = OWL("#fff"); // static, trusted markup
		launcher.appendChild(el("span", { text: state.config.buttonLabel }));
		root.appendChild(launcher);
	}

	function close() {
		if (!panel) return;
		panel.remove();
		panel = null;
		state.open = false;
		if (launcher) launcher.style.display = "";
		if (lastFocus?.focus) lastFocus.focus();
	}

	function renderPanel() {
		const cfg = state.config;
		const types = cfg.types.length ? cfg.types : ["idea"];
		if (!state.type || !types.includes(state.type)) state.type = types[0];

		const titleId = "hb-title";
		panel = el("div", { class: `panel ${side()}`, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId });
		const head = el("div", { class: "head" }, [
			el("h2", { id: titleId, text: cfg.name ? `Feedback for ${cfg.name}` : "Send feedback" }),
			el("button", { class: "x", type: "button", "aria-label": "Close", text: "✕", onclick: close }),
		]);
		const icon = el("span", {});
		icon.innerHTML = OWL("#fff");
		icon.firstChild.setAttribute("width", "30");
		icon.firstChild.setAttribute("height", "30");
		head.prepend(icon);
		panel.appendChild(head);

		const message = el("textarea", {
			name: "message",
			required: true,
			minlength: "2",
			maxlength: "5000",
			"aria-label": "Your feedback",
			placeholder: TYPES[state.type][2],
		});
		const typeRow = el("div", { class: "types", role: "group", "aria-label": "Feedback type" });
		for (const t of types) {
			typeRow.appendChild(
				el("button", {
					class: "chip",
					type: "button",
					"aria-pressed": String(state.type === t),
					text: `${TYPES[t][0]} ${TYPES[t][1]}`,
					onclick: () => {
						state.type = t;
						for (const b of typeRow.children) b.setAttribute("aria-pressed", String(b === typeRow.children[types.indexOf(t)]));
						message.placeholder = TYPES[t][2];
					},
				}),
			);
		}

		const faces = el("div", { class: "faces", role: "group", "aria-label": "How do you feel?" });
		FACES.forEach((f, i) => {
			faces.appendChild(
				el("button", {
					class: "face",
					type: "button",
					"aria-label": `Mood ${i + 1} of 5`,
					"aria-pressed": "false",
					text: f,
					onclick: () => {
						state.rating = state.rating === i + 1 ? null : i + 1;
						faces.classList.toggle("picked", !!state.rating);
						[...faces.children].forEach((b, j) => {
							b.setAttribute("aria-pressed", String(state.rating === j + 1));
						});
					},
				}),
			);
		});

		const errorBox = el("div", { class: "err", role: "alert", hidden: true });
		const knownEmail = state.identity.email;
		const email =
			cfg.askEmail === "hidden" || knownEmail
				? null
				: el("input", {
						type: "email",
						name: "email",
						maxlength: "254",
						autocomplete: "email",
						"aria-label": "Email",
						placeholder: cfg.askEmail === "required" ? "Your email" : "Email (optional), so we can reply",
						required: cfg.askEmail === "required",
					});
		const honeypot = el("input", { class: "hp", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
		const send = el("button", { class: "send", type: "submit", text: "Send feedback" });

		const form = el("form", { novalidate: false }, [
			errorBox,
			types.length > 1 ? typeRow : null,
			message,
			el("div", {}, [el("p", { class: "label", text: "How do you feel? (optional)" }), faces]),
			email,
			honeypot,
			send,
		]);
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			if (state.sending) return;
			state.sending = true;
			send.disabled = true;
			send.textContent = "Sending…";
			errorBox.hidden = true;
			try {
				const res = await fetch(`${BASE}/api/v1/feedback`, {
					method: "POST",
					headers: { "content-type": "text/plain;charset=UTF-8" },
					body: JSON.stringify({
						key: KEY,
						source: "widget",
						type: state.type,
						message: message.value,
						rating: state.rating,
						email: email?.value || state.identity.email || null,
						name: state.identity.name || null,
						pageUrl: location.href.slice(0, 2048),
						metadata: state.metadata,
						website: honeypot.value,
					}),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || "Couldn't send your feedback. Please try again.");
				showDone(data.message || cfg.thankYouMessage);
			} catch (err) {
				errorBox.textContent = err.message || "Network error. Please try again.";
				errorBox.hidden = false;
				send.disabled = false;
				send.textContent = "Send feedback";
			} finally {
				state.sending = false;
			}
		});
		panel.appendChild(form);
		const foot = el("div", { class: "foot" });
		foot.append(
			"Powered by ",
			el("a", { href: "https://github.com/dtsakadze/hootbox", target: "_blank", rel: "noopener", text: "Hootbox" }),
		);
		panel.appendChild(foot);

		panel.addEventListener("keydown", (e) => {
			if (e.key === "Escape") close();
			if (e.key === "Tab") {
				const f = [...panel.querySelectorAll("button, textarea, input:not(.hp), a")].filter((n) => !n.disabled && n.offsetParent !== null);
				const first = f[0];
				const last = f[f.length - 1];
				if (e.shiftKey && root.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && root.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		});

		function showDone(text) {
			form.remove();
			const done = el("div", { class: "done", role: "status" });
			const owl = el("span", {});
			owl.innerHTML = OWL(COLORS[cfg.color] || COLORS.violet);
			owl.firstChild.setAttribute("width", "80");
			owl.firstChild.setAttribute("height", "80");
			done.append(owl, el("strong", { text: "Hoot hoot! 🎉" }), el("p", { text }));
			done.appendChild(el("button", { class: "chip", type: "button", text: "Close", onclick: close }));
			panel.insertBefore(done, foot);
			state.rating = null;
		}

		root.appendChild(panel);
		if (launcher) launcher.style.display = "none";
		message.focus();
	}

	let ready;
	function load() {
		ready ??= fetch(`${BASE}/api/v1/widget-config?key=${encodeURIComponent(KEY)}`)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
			.then((cfg) => {
				state.config = cfg;
				root.host.style.setProperty("--accent", COLORS[cfg.color] || COLORS.violet);
				renderLauncher();
				return cfg;
			})
			.catch((err) => {
				console.warn("[hootbox] Could not load widget:", err.message);
				ready = undefined;
				throw err;
			});
		return ready;
	}

	const api = {
		__loaded: true,
		open(opts) {
			lastFocus = document.activeElement;
			load().then(
				() => {
					if (opts?.type && TYPES[opts.type]) state.type = opts.type;
					if (state.open) close();
					state.open = true;
					renderPanel();
				},
				() => {},
			);
		},
		close,
		identify(user) {
			state.identity = {
				email: user?.email ? String(user.email) : undefined,
				name: user?.name ? String(user.name) : undefined,
			};
		},
		setMetadata(meta) {
			const clean = {};
			for (const [k, v] of Object.entries(meta || {}).slice(0, 20)) {
				if (v === null || ["string", "number", "boolean"].includes(typeof v))
					clean[String(k).slice(0, 40)] = typeof v === "string" ? v.slice(0, 500) : v;
			}
			state.metadata = clean;
		},
	};
	window.Hootbox = api;

	document.addEventListener("click", (e) => {
		const trigger = e.target?.closest?.("[data-hootbox]");
		if (trigger) {
			e.preventDefault();
			api.open({ type: trigger.getAttribute("data-hootbox") || undefined });
		}
	});

	const mount = () => {
		document.body.appendChild(host);
		load().catch(() => {});
	};
	if (document.body) mount();
	else document.addEventListener("DOMContentLoaded", mount);
})();
