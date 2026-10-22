import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import qrcode from 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';

const API = 'https://jayreddin-card.puter.work';
const $ = (id) => document.getElementById(id);

createIcons({ icons });

/* ---------- Card address (works in preview and once published) ---------- */
const cardUrl = (() => {
    const u = new URL(window.location.href);
    u.hash = '';
    u.search = '';
    u.pathname = u.pathname.replace(/index\.html$/, '');
    return u.toString();
})();

/* ---------- Greeting by local time ---------- */
(function setGreeting() {
    const el = $('greeting');
    try {
        const h = new Date().getHours();
        let g = 'Hey there!';
        if (h >= 5 && h < 12) g = 'Good morning!';
        else if (h >= 12 && h < 17) g = 'Good afternoon!';
        else if (h >= 17 && h < 22) g = 'Good evening!';
        else g = 'Hey, night owl!';
        el.textContent = g;
    } catch (e) { /* keep the default line */ }
})();

/* ---------- Theme toggle (remembers choice, defaults to system) ---------- */
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
const themeBtn = $('theme-btn');

function readSaved() {
    try { return localStorage.getItem('jr-theme'); } catch (e) { return null; }
}
function isDark() {
    const saved = root.getAttribute('data-theme');
    return saved ? saved === 'dark' : media.matches;
}
function syncTheme() {
    const dark = isDark();
    root.classList.toggle('is-dark', dark);
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0b1120' : '#1f2f5c');
}
themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('jr-theme', next); } catch (e) {}
    syncTheme();
});
media.addEventListener('change', () => { if (!readSaved()) syncTheme(); });
syncTheme();

/* ---------- Toast ---------- */
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
document.body.appendChild(toast);
let toastTimer;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

/* ---------- Copy link ---------- */
const shareBtn = $('share-btn');
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
        return ok;
    }
}
shareBtn.addEventListener('click', async () => {
    const ok = await copyText(cardUrl);
    if (ok) {
        shareBtn.classList.add('copied');
        $('share-label').textContent = 'Copied';
        showToast('Link copied to clipboard');
        setTimeout(() => { shareBtn.classList.remove('copied'); $('share-label').textContent = 'Copy link'; }, 1800);
    } else {
        window.prompt('Copy this link:', cardUrl);
    }
});

/* ---------- QR code ---------- */
(function renderQR() {
    $('card-url').textContent = cardUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    try {
        const qr = qrcode(0, 'M');
        qr.addData(cardUrl);
        qr.make();
        const n = qr.getModuleCount();
        let d = '';
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
            }
        }
        $('qr').innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
    } catch (e) {
        $('qr').closest('.qr-block').hidden = true;
    }
})();

/* ---------- Visitor counter (anonymous; counted once per browser session) ---------- */
const fmt = new Intl.NumberFormat();
async function loadVisits() {
    let counted = false;
    try { counted = sessionStorage.getItem('jr-counted') === '1'; } catch (e) {}
    try {
        const res = await fetch(`${API}/${counted ? 'stats' : 'visit'}`, { method: counted ? 'GET' : 'POST' });
        if (!res.ok) throw new Error('bad status');
        const { visits } = await res.json();
        if (!counted) { try { sessionStorage.setItem('jr-counted', '1'); } catch (e) {} }
        $('visits-text').textContent = `${fmt.format(visits)} ${visits === 1 ? 'visitor' : 'visitors'}`;
    } catch (e) {
        $('visits').hidden = true;
    }
}
loadVisits();

/* ---------- Guestbook ---------- */
const list = $('gb-list');
const form = $('gb-form');
const nameEl = $('gb-name');
const msgEl = $('gb-message');
const statusEl = $('gb-status');
const submitBtn = $('gb-submit');

function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
}
function entryEl(e) {
    const li = document.createElement('li');
    li.className = 'gb-entry';
    const head = document.createElement('div');
    head.className = 'gb-entry-head';
    const name = document.createElement('strong');
    name.textContent = e.name;
    const time = document.createElement('time');
    time.dateTime = new Date(e.ts).toISOString();
    time.textContent = timeAgo(e.ts);
    head.append(name, time);
    const p = document.createElement('p');
    p.textContent = e.message;
    li.append(head, p);
    return li;
}
function renderEntries(entries) {
    list.innerHTML = '';
    if (!entries.length) {
        const li = document.createElement('li');
        li.className = 'gb-empty muted small';
        li.textContent = 'No messages yet — be the first to sign!';
        list.appendChild(li);
    } else {
        entries.forEach(e => list.appendChild(entryEl(e)));
    }
    $('gb-count').textContent = entries.length ? `${entries.length} ${entries.length === 1 ? 'note' : 'notes'}` : '';
}
let entries = [];
async function loadGuestbook() {
    try {
        const res = await fetch(`${API}/guestbook`);
        if (!res.ok) throw new Error('bad status');
        const data = await res.json();
        entries = Array.isArray(data.entries) ? data.entries : [];
        renderEntries(entries);
    } catch (e) {
        list.innerHTML = '<li class="gb-empty muted small">Couldn’t load messages right now.</li>';
    }
}
loadGuestbook();

function resetStatus() {
    statusEl.classList.remove('error');
    statusEl.innerHTML = `<span id="gb-chars">${msgEl.value.length}</span>/280`;
}
msgEl.addEventListener('input', resetStatus);

form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = nameEl.value.trim();
    const message = msgEl.value.trim();
    if (!name || !message) {
        statusEl.textContent = 'Please add your name and a message.';
        statusEl.classList.add('error');
        return;
    }
    submitBtn.disabled = true;
    statusEl.classList.remove('error');
    statusEl.textContent = 'Sending…';
    try {
        const res = await fetch(`${API}/guestbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message, website: form.website.value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong.');
        if (data.entry) { entries = [data.entry, ...entries].slice(0, 30); renderEntries(entries); }
        msgEl.value = '';
        resetStatus();
        showToast('Thanks for signing!');
    } catch (e) {
        statusEl.textContent = e.message || 'Couldn’t send. Please try again.';
        statusEl.classList.add('error');
    } finally {
        submitBtn.disabled = false;
    }
});
