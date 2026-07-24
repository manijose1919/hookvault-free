// HookVault dashboard — dependency-free. Polls the same JSON APIs the CLI uses.
//
// Security: all dynamic values are inserted via textContent / createElement,
// never innerHTML, so a value flowing from the API can never inject markup.

const $ = (id) => document.getElementById(id);

function fmtTime(ts) {
  if (!ts) return '';
  // SQLite stores UTC 'YYYY-MM-DD HH:MM:SS'.
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.text != null) node.textContent = opts.text;
  if (opts.className) node.className = opts.className;
  return node;
}

async function loadHealth() {
  try {
    const res = await fetch('/health');
    const h = await res.json();
    $('tier').textContent = `tier: ${h.tier}`;
    $('version').textContent = `v${h.version}`;
    $('status').textContent = h.status;
    $('status').style.color = h.status === 'ok' ? 'var(--ok)' : 'var(--bad)';

    const feats = h.features || [];
    const container = $('features');
    container.replaceChildren();
    if (!feats.length) {
      container.append(
        el('span', {
          className: 'empty',
          text: 'Free tier — upgrade to unlock premium & pro modules.',
        })
      );
    } else {
      for (const f of feats) container.append(el('span', { className: 'pill', text: f }), document.createTextNode(' '));
    }
  } catch {
    $('status').textContent = 'unreachable';
    $('status').style.color = 'var(--bad)';
  }
}

async function loadDeliveries() {
  try {
    const res = await fetch('/deliveries?limit=25');
    const { attempts } = await res.json();
    const tbody = $('deliveries');
    $('deliveries-empty').hidden = attempts.length > 0;

    tbody.replaceChildren();
    for (const a of attempts) {
      const row = el('tr');
      row.append(
        el('td', { className: 'muted', text: fmtTime(a.attempted_at) }),
        (() => {
          const td = el('td');
          td.append(el('code', { text: a.event_id }));
          return td;
        })(),
        (() => {
          const td = el('td');
          td.append(el('code', { text: a.endpoint_id }));
          return td;
        })(),
        el('td', { text: String(a.attempt_number) }),
        el('td', { className: `status-${a.status}`, text: a.status }),
        el('td', { text: a.response_code == null ? '' : String(a.response_code) })
      );
      tbody.append(row);
    }
  } catch {
    /* transient; next poll will retry */
  }
}

async function tick() {
  await Promise.all([loadHealth(), loadDeliveries()]);
}

tick();
setInterval(tick, 4000);
