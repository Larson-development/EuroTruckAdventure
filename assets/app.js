const state = {
  clips: [],
  query: "",
  activeTags: new Set(),
  sort: "date_desc"
};

const $ = (id) => document.getElementById(id);

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function clipMatches(clip) {
  const q = normalize(state.query);
  const hay = normalize([
    clip.title,
    clip.notes,
    (clip.tags || []).join(" ")
  ].join(" "));

  const qOk = !q || hay.includes(q);

  const tags = new Set((clip.tags || []).map(t => normalize(t)));
  const active = [...state.activeTags].map(normalize);
  const tagsOk = active.length === 0 || active.every(t => tags.has(t));

  return qOk && tagsOk;
}

function sortClips(list) {
  const s = state.sort;
  const copy = [...list];

  const dateVal = (c) => {
    // tom dato => meget gammel
    const d = c.date ? new Date(c.date) : new Date("1970-01-01");
    return d.getTime();
  };

  if (s === "date_desc") copy.sort((a,b) => dateVal(b) - dateVal(a));
  if (s === "date_asc")  copy.sort((a,b) => dateVal(a) - dateVal(b));
  if (s === "title_asc") copy.sort((a,b) => (a.title||"").localeCompare(b.title||"", "da"));
  if (s === "title_desc")copy.sort((a,b) => (b.title||"").localeCompare(a.title||"", "da"));

  return copy;
}

function buildTagbar(clips) {
  const counts = new Map();
  clips.forEach(c => (c.tags||[]).forEach(t => {
    const key = t.trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  }));

  const tagbar = $("tagbar");
  tagbar.innerHTML = "";

  const allTags = [...counts.entries()].sort((a,b) => a[0].localeCompare(b[0], "da"));

  allTags.forEach(([tag, count]) => {
    const el = document.createElement("div");
    el.className = "tag";
    el.textContent = `${tag} (${count})`;

    const active = [...state.activeTags].some(x => normalize(x) === normalize(tag));
    if (active) el.classList.add("active");

    el.addEventListener("click", () => {
      const already = [...state.activeTags].some(x => normalize(x) === normalize(tag));
      if (already) {
        // fjern (case-insensitive)
        [...state.activeTags].forEach(x => {
          if (normalize(x) === normalize(tag)) state.activeTags.delete(x);
        });
      } else {
        state.activeTags.add(tag);
      }
      render();
    });

    tagbar.appendChild(el);
  });
}

function cardHtml(clip) {
  const tags = (clip.tags || []).slice(0, 6).map(t => `<span class="badge">#${escapeHtml(t)}</span>`).join("");
  const date = clip.date ? `<span class="badge">📅 ${escapeHtml(clip.date)}</span>` : "";
  const notes = clip.notes ? `<div class="note">${escapeHtml(clip.notes)}</div>` : "";

  // Hvis embedSrc findes, bruger vi iframe. Ellers viser vi et “ingen embed” panel.
  const player = clip.embedSrc
    ? `<div class="player">
         <iframe
           src="${escapeAttr(clip.embedSrc)}"
           allow="fullscreen; autoplay; encrypted-media"
           loading="lazy"
           title="${escapeAttr(clip.title || "ETS2 clip")}"></iframe>
       </div>`
    : `<div class="player">
         <div class="empty" style="margin:0;">
           <strong>Ingen embed</strong>
           <div style="margin-top:6px;">Åbn via OneDrive-link i stedet.</div>
         </div>
       </div>`;

  return `
    <article class="card">
      <div class="head">
        <h3>${escapeHtml(clip.title || "Uden titel")}</h3>
        <div class="meta">
          ${date}
          ${tags}
        </div>
      </div>
      ${player}
      <div class="fallback">
        <a class="link" href="${escapeAttr(clip.onedriveUrl)}" target="_blank" rel="noopener">🔗 Åbn i OneDrive</a>
        ${clip.embedSrc ? `<a class="link secondary" href="${escapeAttr(clip.embedSrc)}" target="_blank" rel="noopener">🧩 Åbn embed-src</a>` : ""}
      </div>
      ${notes}
    </article>
  `;
}

function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll("\"","&quot;").replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s); }

function render() {
  const filtered = state.clips.filter(clipMatches);
  const finalList = sortClips(filtered);

  $("stats").textContent =
    `Viser ${finalList.length} / ${state.clips.length} klips` +
    (state.activeTags.size ? ` • tags: ${[...state.activeTags].join(", ")}` : "") +
    (state.query ? ` • søgning: "${state.query}"` : "");

  $("grid").innerHTML = finalList.map(cardHtml).join("");

  $("empty").classList.toggle("hidden", finalList.length !== 0);

  // Opdater tagbar aktiv-tilstand (hurtigst ved at rebuild’e)
  buildTagbar(state.clips);
}

async function init(){
  // Hent data fra clips.json
  const res = await fetch("clips.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Kunne ikke hente clips.json");
  state.clips = await res.json();

  // UI hooks
  $("search").addEventListener("input", (e) => {
    state.query = e.target.value || "";
    render();
  });

  $("sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  $("clear").addEventListener("click", () => {
    state.query = "";
    state.activeTags.clear();
    state.sort = "date_desc";
    $("search").value = "";
    $("sort").value = "date_desc";
    render();
  });

  buildTagbar(state.clips);
  render();
}

init().catch(err => {
  console.error(err);
  $("stats").textContent = "Fejl: " + err.message;
});
