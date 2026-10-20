// Plays a recorded call and keeps a transcript and an action log in sync with the audio.
// Usage: CallPlayer(rootEl, { src: "assets/calls/booking", onEvent(tool) {} })
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  window.CallPlayer = async function (root, opts) {
    const data = await fetch(opts.src + ".json").then(r => r.json());
    const audio = new Audio(opts.src + ".mp3");
    audio.preload = "metadata";
    const q = sel => root.querySelector(sel);
    const btn = q("[data-play]"), bar = q("[data-bar]"), time = q("[data-time]");
    const list = q("[data-lines]"), log = q("[data-log]");
    const names = opts.names || { a: "Receptionist", c: "Caller" };
    let shown = -1, logged = -1;

    // Waveform-style progress bar, drawn once from a seeded pattern so it looks like speech.
    if (bar && !bar.children.length) {
      let s = (opts.seed || 7);
      const n = 64;
      for (let i = 0; i < n; i++) {
        s = (s * 9301 + 49297) % 233280;
        const t = i / n * data.duration;
        const talking = data.lines.some(l => t >= l.start && t <= l.end);
        const h = talking ? 30 + (s / 233280) * 70 : 8;
        const b = document.createElement("i");
        b.style.height = h + "%";
        b.dataset.t = t.toFixed(2);
        bar.appendChild(b);
      }
      bar.addEventListener("click", e => {
        const r = bar.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * data.duration;
        if (audio.paused) audio.play();
      });
    }

    function render(t) {
      if (time) time.textContent = fmt(t) + " / " + fmt(data.duration);
      if (bar) [...bar.children].forEach(b => b.classList.toggle("on", +b.dataset.t <= t));
      let idx = -1;
      data.lines.forEach((l, i) => { if (l.start <= t + 0.05) idx = i; });
      if (list && idx !== shown) {
        list.innerHTML = data.lines.slice(0, idx + 1).map((l, i) =>
          `<li class="${l.who === "a" ? "agent" : "caller"}${i === idx ? " now" : ""}"><span>${esc(names[l.who])}</span><p>${esc(l.text)}</p></li>`).join("");
        list.scrollTop = list.scrollHeight;
        shown = idx;
      }
      if (log) {
        const tools = data.lines.map((l, i) => ({ l, i })).filter(x => x.l.tool && x.l.start <= t + 0.05);
        if (tools.length - 1 !== logged) {
          log.innerHTML = tools.map(({ l }) => `<li><b>${esc(l.tool.t.replace(/_/g, " "))}</b><span>${esc(l.tool.d)}</span><em>${esc(l.tool.r)}</em></li>`).join("");
          if (tools.length - 1 > logged && opts.onEvent) opts.onEvent(tools[tools.length - 1].l.tool, tools.length);
          logged = tools.length - 1;
        }
      }
      if (opts.onTime) opts.onTime(t, data);
    }
    function setState() {
      root.classList.toggle("playing", !audio.paused);
      if (btn) btn.setAttribute("aria-label", audio.paused ? "Play the call" : "Pause the call");
    }
    audio.addEventListener("timeupdate", () => render(audio.currentTime));
    audio.addEventListener("play", setState);
    audio.addEventListener("pause", setState);
    audio.addEventListener("ended", () => { setState(); if (opts.onEnd) opts.onEnd(); });
    if (btn) btn.addEventListener("click", () => {
      document.querySelectorAll("audio").forEach(a => a !== audio && a.pause());
      CallPlayer.stopOthers(audio);
      audio.paused ? audio.play() : audio.pause();
    });
    CallPlayer.all.push(audio);
    render(0);
    return { audio, data, reset() { audio.pause(); audio.currentTime = 0; shown = -1; logged = -1; render(0); } };
  };
  CallPlayer.all = [];
  CallPlayer.stopOthers = keep => CallPlayer.all.forEach(a => a !== keep && a.pause());
})();
