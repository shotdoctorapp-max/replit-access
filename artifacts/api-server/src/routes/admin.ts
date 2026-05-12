import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, bugReports, waitlist } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

let _adminSecretMissingLogged = false;

function adminAuth(req: import("express").Request, res: import("express").Response): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (!_adminSecretMissingLogged) {
      logger.warn("ADMIN_SECRET env var is not set — admin routes are disabled");
      _adminSecretMissingLogged = true;
    }
    res.status(503).json({ error: "Admin access not configured. Set the ADMIN_SECRET env var." });
    return false;
  }
  const provided = req.headers["x-admin-secret"];
  const providedStr = Array.isArray(provided) ? provided[0] : provided;
  const isValid =
    !!providedStr &&
    providedStr.length === secret.length &&
    timingSafeEqual(Buffer.from(providedStr), Buffer.from(secret));
  if (!isValid) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// ── Bug Reports ───────────────────────────────────────────────────────────────

router.get("/admin/bug-reports", async (req, res): Promise<void> => {
  if (!adminAuth(req, res)) return;

  const parsed = pageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const rows = await db
      .select()
      .from(bugReports)
      .orderBy(desc(bugReports.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(bugReports);

    const MAX_DEVICE_INFO_JSON_CHARS = 1000;
    res.json({
      data: rows.map((r) => {
        let deviceInfo: unknown = r.deviceInfo;
        if (deviceInfo !== null && deviceInfo !== undefined) {
          const raw = JSON.stringify(deviceInfo);
          if (raw.length > MAX_DEVICE_INFO_JSON_CHARS) {
            deviceInfo = { _truncated: raw.slice(0, MAX_DEVICE_INFO_JSON_CHARS) + "…" };
          }
        }
        return {
          id: r.id,
          userId: r.userId,
          message: r.message,
          deviceInfo,
          createdAt: r.createdAt,
        };
      }),
      meta: { page, limit, total: count ?? null },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch bug reports");
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.delete("/admin/bug-reports/:id", async (req, res): Promise<void> => {
  if (!adminAuth(req, res)) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(bugReports)
      .where(eq(bugReports.id, id))
      .returning({ id: bugReports.id });

    if (!deleted) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Failed to delete bug report");
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// ── Waitlist ──────────────────────────────────────────────────────────────────

router.get("/admin/waitlist", async (req, res): Promise<void> => {
  if (!adminAuth(req, res)) return;

  const parsed = pageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const rows = await db
      .select()
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(waitlist);

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        source: r.source,
        createdAt: r.createdAt,
      })),
      meta: { page, limit, total: count ?? null },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch waitlist");
    res.status(500).json({ error: "Failed to fetch waitlist" });
  }
});

router.get("/admin/waitlist/export.csv", async (req, res): Promise<void> => {
  if (!adminAuth(req, res)) return;

  try {
    const rows = await db
      .select()
      .from(waitlist)
      .orderBy(asc(waitlist.createdAt));

    const lines = [
      "id,email,source,signed_up_at",
      ...rows.map((r) =>
        [
          r.id,
          `"${r.email.replace(/"/g, '""')}"`,
          `"${(r.source ?? "").replace(/"/g, '""')}"`,
          r.createdAt.toISOString(),
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="waitlist-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(lines.join("\r\n"));
  } catch (err) {
    req.log.error({ err }, "Failed to export waitlist CSV");
    res.status(500).json({ error: "Failed to export waitlist" });
  }
});

// ── Dashboard HTML ────────────────────────────────────────────────────────────

router.get("/admin", (_req, res): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Shot Doctor · Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1e1e1e;
    --border: #2a2a2a;
    --fg: #f0f0f0;
    --muted: #888;
    --green: #00C853;
    --red: #ff4444;
    --radius: 8px;
  }
  body { background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.5; min-height: 100vh; }
  #lock-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .lock-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 100%; max-width: 360px; text-align: center; }
  .lock-card h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
  .lock-card p { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .lock-logo { font-size: 32px; margin-bottom: 16px; }
  input[type=password] { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--fg); font-size: 14px; padding: 10px 14px; outline: none; margin-bottom: 12px; }
  input[type=password]:focus { border-color: var(--green); }
  .btn { display: inline-flex; align-items: center; gap: 6px; background: var(--green); color: #000; font-size: 13px; font-weight: 700; border: none; border-radius: var(--radius); padding: 9px 18px; cursor: pointer; transition: opacity .15s; text-decoration: none; }
  .btn:hover { opacity: .85; }
  .btn.btn-ghost { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); font-weight: 500; }
  .btn.btn-danger { background: transparent; color: var(--red); border: 1px solid var(--red); font-weight: 500; }
  .btn.btn-danger:hover { background: var(--red); color: #fff; }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  #app { display: none; }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 10px; }
  .header-logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header-logo span { color: var(--green); }
  .badge { background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; font-size: 12px; color: var(--muted); }
  nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; gap: 0; }
  .nav-tab { padding: 12px 18px; font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; user-select: none; }
  .nav-tab:hover { color: var(--fg); }
  .nav-tab.active { color: var(--green); border-bottom-color: var(--green); }
  main { max-width: 1100px; margin: 0 auto; padding: 24px; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; min-width: 140px; }
  .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 4px; }
  .stat-value { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: var(--green); }
  .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .toolbar h2 { font-size: 16px; font-weight: 600; flex: 1; }
  #status-bugs, #status-waitlist { font-size: 12px; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  th { background: var(--surface2); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }
  .cell-id { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cell-user { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
  .cell-email { font-size: 13px; }
  .cell-source { font-size: 12px; color: var(--muted); }
  .cell-message { max-width: 380px; word-break: break-word; white-space: pre-wrap; font-size: 13px; }
  .cell-device { font-size: 11px; color: var(--muted); max-width: 180px; }
  .cell-device pre { white-space: pre-wrap; word-break: break-all; font-family: inherit; }
  .cell-time { white-space: nowrap; font-size: 12px; color: var(--muted); }
  .empty { text-align: center; padding: 60px 24px; color: var(--muted); }
  .pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; gap: 12px; }
  .pagination-info { font-size: 12px; color: var(--muted); }
  .pagination-btns { display: flex; gap: 8px; }
  .err-banner { background: #3a0000; border: 1px solid var(--red); border-radius: var(--radius); color: #ff9999; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; display: none; }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 700px) {
    .cell-device, th:nth-child(3), td:nth-child(3) { display: none; }
    .cell-source { display: none; }
  }
</style>
</head>
<body>

<!-- Lock screen -->
<div id="lock-screen">
  <div class="lock-card">
    <div class="lock-logo">🏀</div>
    <h1>Shot Doctor Admin</h1>
    <p>Enter your admin secret to continue.</p>
    <form id="lock-form">
      <input type="password" id="secret-input" placeholder="Admin secret" autocomplete="current-password" required />
      <button class="btn" style="width:100%;justify-content:center" type="submit">Unlock</button>
    </form>
    <p id="lock-err" style="color:var(--red);font-size:12px;margin-top:12px;display:none"></p>
  </div>
</div>

<!-- Dashboard -->
<div id="app">
  <header>
    <div class="header-left">
      <span class="header-logo">Shot <span>Doctor</span></span>
      <span class="badge">Admin</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <button class="btn btn-ghost btn-sm" onclick="reloadCurrent()">↻ Refresh</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Lock</button>
    </div>
  </header>

  <nav>
    <div class="nav-tab active" id="tab-waitlist" onclick="switchTab('waitlist')">Waitlist</div>
    <div class="nav-tab" id="tab-bugs" onclick="switchTab('bugs')">Bug Reports</div>
  </nav>

  <main>
    <!-- ── Waitlist Tab ── -->
    <div class="tab-panel active" id="panel-waitlist">
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-label">Total Signups</div>
          <div class="stat-value" id="wl-count">—</div>
        </div>
      </div>
      <div class="err-banner" id="err-waitlist"></div>
      <div class="toolbar">
        <h2>All Signups</h2>
        <span id="status-waitlist"></span>
        <a id="csv-link" class="btn btn-ghost btn-sm" href="#" onclick="exportCsv(event)">⬇ Export CSV</a>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">ID</th>
            <th>Email</th>
            <th>Source</th>
            <th>Signed Up</th>
          </tr>
        </thead>
        <tbody id="wl-tbody"></tbody>
      </table>
      <div class="pagination">
        <span class="pagination-info" id="wl-page-info"></span>
        <div class="pagination-btns">
          <button class="btn btn-ghost btn-sm" id="wl-prev" onclick="wlChangePage(-1)" disabled>← Prev</button>
          <button class="btn btn-ghost btn-sm" id="wl-next" onclick="wlChangePage(1)" disabled>Next →</button>
        </div>
      </div>
    </div>

    <!-- ── Bug Reports Tab ── -->
    <div class="tab-panel" id="panel-bugs">
      <div class="err-banner" id="err-bugs"></div>
      <div class="toolbar">
        <h2>All Reports</h2>
        <span id="status-bugs"></span>
        <span id="bugs-total-label" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">ID</th>
            <th>Message</th>
            <th>Device</th>
            <th>User</th>
            <th>Submitted</th>
            <th style="width:60px"></th>
          </tr>
        </thead>
        <tbody id="bugs-tbody"></tbody>
      </table>
      <div class="pagination">
        <span class="pagination-info" id="bugs-page-info"></span>
        <div class="pagination-btns">
          <button class="btn btn-ghost btn-sm" id="bugs-prev" onclick="bugsChangePage(-1)" disabled>← Prev</button>
          <button class="btn btn-ghost btn-sm" id="bugs-next" onclick="bugsChangePage(1)" disabled>Next →</button>
        </div>
      </div>
    </div>
  </main>
</div>

<script>
const LIMIT = 25;
let secret = '';
let currentTab = 'waitlist';
let wlPage = 1;
let bugsPage = 1;
let wlLoaded = false;
let bugsLoaded = false;

function getSecret() { return sessionStorage.getItem('admin_secret') || ''; }
function setSecret(s) { sessionStorage.setItem('admin_secret', s); secret = s; }
function clearSecret() { sessionStorage.removeItem('admin_secret'); secret = ''; }

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'waitlist' && !wlLoaded) loadWaitlist(1);
  if (tab === 'bugs' && !bugsLoaded) loadBugs(1);
}

function reloadCurrent() {
  if (currentTab === 'waitlist') loadWaitlist(wlPage);
  else loadBugs(bugsPage);
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

async function fetchWaitlist(page) {
  const res = await fetch('/api/admin/waitlist?page=' + page + '&limit=' + LIMIT, {
    headers: { 'x-admin-secret': secret }
  });
  if (res.status === 401) throw new Error('invalid_secret');
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

async function loadWaitlist(page) {
  const tbody = document.getElementById('wl-tbody');
  const status = document.getElementById('status-waitlist');
  const errBanner = document.getElementById('err-waitlist');
  errBanner.style.display = 'none';
  status.innerHTML = '<span class="spinner"></span>';
  tbody.innerHTML = '<tr><td colspan="4" class="empty"><span class="spinner"></span></td></tr>';

  try {
    const data = await fetchWaitlist(page);
    wlPage = page;
    wlLoaded = true;
    document.getElementById('wl-count').textContent = data.meta.total !== null ? data.meta.total : '—';
    renderWaitlistTable(data.data);
    renderWaitlistPagination(data.meta);
    status.textContent = '';
  } catch (e) {
    if (e.message === 'invalid_secret') { clearSecret(); showLock('Invalid secret — please try again.'); }
    else { errBanner.textContent = 'Error: ' + e.message; errBanner.style.display = 'block'; status.textContent = ''; }
    tbody.innerHTML = '';
  }
}

function renderWaitlistTable(rows) {
  const tbody = document.getElementById('wl-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">No signups yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => \`<tr>
    <td class="cell-id">#\${r.id}</td>
    <td class="cell-email">\${esc(r.email)}</td>
    <td class="cell-source">\${esc(r.source || '—')}</td>
    <td class="cell-time">\${fmt(r.createdAt)}</td>
  </tr>\`).join('');
}

function renderWaitlistPagination(meta) {
  const { page, limit, total } = meta;
  const totalPages = total !== null ? Math.ceil(total / limit) : null;
  document.getElementById('wl-page-info').textContent =
    'Page ' + page + (totalPages ? ' of ' + totalPages : '');
  document.getElementById('wl-prev').disabled = page <= 1;
  document.getElementById('wl-next').disabled = totalPages !== null ? page >= totalPages : false;
}

function wlChangePage(delta) { loadWaitlist(wlPage + delta); }

async function exportCsv(e) {
  e.preventDefault();
  const url = '/api/admin/waitlist/export.csv';
  const res = await fetch(url, { headers: { 'x-admin-secret': secret } });
  if (!res.ok) { alert('Export failed'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  a.download = 'waitlist-' + today + '.csv';
  a.click();
}

// ── Bug Reports ───────────────────────────────────────────────────────────────

async function fetchReports(page) {
  const res = await fetch('/api/admin/bug-reports?page=' + page + '&limit=' + LIMIT, {
    headers: { 'x-admin-secret': secret }
  });
  if (res.status === 401) throw new Error('invalid_secret');
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

async function loadBugs(page) {
  const tbody = document.getElementById('bugs-tbody');
  const status = document.getElementById('status-bugs');
  const errBanner = document.getElementById('err-bugs');
  errBanner.style.display = 'none';
  status.innerHTML = '<span class="spinner"></span>';
  tbody.innerHTML = '<tr><td colspan="6" class="empty"><span class="spinner"></span></td></tr>';

  try {
    const data = await fetchReports(page);
    bugsPage = page;
    bugsLoaded = true;
    document.getElementById('bugs-total-label').textContent =
      data.meta.total !== null ? data.meta.total + ' total' : '';
    renderBugsTable(data.data);
    renderBugsPagination(data.meta);
    status.textContent = '';
  } catch (e) {
    if (e.message === 'invalid_secret') { clearSecret(); showLock('Invalid secret — please try again.'); }
    else { errBanner.textContent = 'Error: ' + e.message; errBanner.style.display = 'block'; status.textContent = ''; }
    tbody.innerHTML = '';
  }
}

function renderBugsTable(rows) {
  const tbody = document.getElementById('bugs-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No bug reports yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const MAX_DEVICE_DISPLAY = 500;
    const raw = r.deviceInfo ? JSON.stringify(r.deviceInfo, null, 2) : '—';
    const device = raw.length > MAX_DEVICE_DISPLAY ? raw.slice(0, MAX_DEVICE_DISPLAY) + '\n…(truncated)' : raw;
    return \`<tr>
      <td class="cell-id">#\${r.id}</td>
      <td class="cell-message">\${esc(r.message)}</td>
      <td class="cell-device"><pre>\${esc(device)}</pre></td>
      <td class="cell-user">\${esc(r.userId || '—')}</td>
      <td class="cell-time">\${fmt(r.createdAt)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteReport(\${r.id})">Delete</button></td>
    </tr>\`;
  }).join('');
}

function renderBugsPagination(meta) {
  const { page, limit, total } = meta;
  const totalPages = total !== null ? Math.ceil(total / limit) : null;
  document.getElementById('bugs-page-info').textContent =
    'Page ' + page + (totalPages ? ' of ' + totalPages : '');
  document.getElementById('bugs-prev').disabled = page <= 1;
  document.getElementById('bugs-next').disabled = totalPages !== null ? page >= totalPages : false;
}

function bugsChangePage(delta) { loadBugs(bugsPage + delta); }

async function deleteReport(id) {
  if (!confirm('Delete report #' + id + '? This cannot be undone.')) return;
  const res = await fetch('/api/admin/bug-reports/' + id, {
    method: 'DELETE', headers: { 'x-admin-secret': secret }
  });
  if (!res.ok && res.status !== 204) { alert('Failed to delete'); return; }
  await loadBugs(bugsPage);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function logout() { clearSecret(); showLock(); }

function showLock(err) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('lock-screen').style.display = 'flex';
  const lockErr = document.getElementById('lock-err');
  if (err) { lockErr.textContent = err; lockErr.style.display = 'block'; }
  else { lockErr.style.display = 'none'; }
  setTimeout(() => document.getElementById('secret-input').focus(), 50);
}

document.getElementById('lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = document.getElementById('secret-input').value.trim();
  if (!val) return;
  setSecret(val);
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  wlLoaded = false;
  bugsLoaded = false;
  switchTab('waitlist');
});

// Auto-unlock if session has a stored secret
const stored = getSecret();
if (stored) {
  secret = stored;
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  switchTab('waitlist');
} else {
  setTimeout(() => document.getElementById('secret-input').focus(), 100);
}
</script>
</body>
</html>`;

export default router;
