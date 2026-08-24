// ====== CONFIG ======
const CONFIG = {
  health: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=767932203&single=true&output=csv',
  symptoms: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=1608466763&single=true&output=csv',
  mood: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=880120131&single=true&output=csv',
  habits: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=335739502&single=true&output=csv'
};

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzg8Uri9-dsiV8HKZzW8byvPMzqicNTCVbkgfx3nlv0MFtfgCuBluoB1Fh6E8FQJoqDcw/exec';

const DIET_KEYWORDS = ['diet', 'food', 'calorie', 'carb', 'protein', 'fat', 'sugar', 'fiber', 'sodium', 'water', 'meal', 'nutrition', 'vitamin', 'cholesterol'];

let dataStore = { health: [], symptoms: [], mood: [], habits: [] };
let charts = {};

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupHabitForm();
  await loadAll();
  document.getElementById('lastUpdated').textContent =
    `Last loaded: ${new Date().toLocaleString()}`;
});

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

async function loadAll() {
  const [health, symptoms, mood, habits] = await Promise.all([
    fetchCsv(CONFIG.health),
    fetchCsv(CONFIG.symptoms),
    fetchCsv(CONFIG.mood),
    fetchCsv(CONFIG.habits).catch(() => [])
  ]);
  dataStore.health = health;
  dataStore.symptoms = symptoms;
  dataStore.mood = mood;
  dataStore.habits = habits;

  renderOverview();
  renderHealthTab();
  renderDietTab();
  renderSymptomsTab();
  renderMoodTab();
  renderHabitsTab();
  renderCorrelationsTab();

  document.getElementById('corrThreshold').addEventListener('change', renderCorrelationsTab);
  document.getElementById('sigOnly').addEventListener('change', renderCorrelationsTab);
}

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: results => resolve(results.data.filter(r => Object.values(r).some(v => v !== null && v !== ''))),
      error: reject
    });
  });
}

// ====== OVERVIEW ======
function renderOverview() {
  const health = dataStore.health;
  if (health.length === 0) return;

  const latest = health[0];
  const cards = [
    { label: 'Resting HR', value: fmt(latest['Resting Heart Rate (count/min)'], 'bpm') },
    { label: 'Sleep (Total)', value: fmt(latest['Sleep Analysis [Total] (hr)'], 'hr') },
    { label: 'Steps', value: fmt(latest['Step Count (count)']) },
    { label: 'Active Energy', value: fmt(latest['Active Energy (kcal)'], 'kcal') },
    { label: 'VO2 Max', value: fmt(latest['VO2 Max (ml/(kg·min))']) },
    { label: 'Weight', value: fmt(latest['Weight (lb)'], 'lb') }
  ];
  document.getElementById('summaryCards').innerHTML = cards.map(c => `
    <div class="card">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>
  `).join('');

  const last30 = health.slice(0, 30).reverse();
  const labels = last30.map(r => shortDate(r['Date/Time']));

  drawLineChart('sleepChart', labels, [
    { label: 'Total Sleep', data: last30.map(r => r['Sleep Analysis [Total] (hr)']), color: '#5eb1ff' },
    { label: 'Deep', data: last30.map(r => r['Sleep Analysis [Deep] (hr)']), color: '#a78bfa' },
    { label: 'REM', data: last30.map(r => r['Sleep Analysis [REM] (hr)']), color: '#34d399' }
  ]);

  drawLineChart('hrChart', labels, [
    { label: 'Resting HR', data: last30.map(r => r['Resting Heart Rate (count/min)']), color: '#f87171' }
  ]);
}

// ====== HEALTH TAB ======
function renderHealthTab() {
  const health = dataStore.health;
  if (health.length === 0) return;

  const cols = Object.keys(health[0]).filter(c => c !== 'Date/Time');
  const select = document.getElementById('metricSelect');
  select.innerHTML = cols.map(c => `<option value="${c}">${c}</option>`).join('');
  select.addEventListener('change', () => drawMetric(select.value));
  drawMetric(cols[0]);

  renderTable('healthTable', health.slice(0, 100));
}

function drawMetric(metric) {
  const last60 = dataStore.health.slice(0, 60).reverse();
  const labels = last60.map(r => shortDate(r['Date/Time']));
  drawLineChart('metricChart', labels, [
    { label: metric, data: last60.map(r => r[metric]), color: '#5eb1ff' }
  ]);
}

// ====== DIET TAB ======
function getDietColumns() {
  const health = dataStore.health;
  if (health.length === 0) return [];
  return Object.keys(health[0]).filter(col => {
    const lower = col.toLowerCase();
    return DIET_KEYWORDS.some(kw => lower.includes(kw)) && col !== 'Water (fl_oz_us)' || col === 'Water (fl_oz_us)';
  });
}

function renderDietTab() {
  const health = dataStore.health;
  const dietCols = getDietColumns();

  if (health.length === 0 || dietCols.length === 0) {
    document.getElementById('dietCards').innerHTML = '<p class="muted">No diet columns detected yet.</p>';
    return;
  }

  const latest = health[0];
  document.getElementById('dietCards').innerHTML = dietCols.slice(0, 6).map(col => `
    <div class="card">
      <div class="label">${col}</div>
      <div class="value">${fmt(latest[col])}</div>
    </div>
  `).join('');

  const last30 = health.slice(0, 30).reverse();
  const labels = last30.map(r => shortDate(r['Date/Time']));
  const palette = ['#5eb1ff', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];
  const series = dietCols.slice(0, 6).map((col, i) => ({
    label: col,
    data: last30.map(r => r[col]),
    color: palette[i % palette.length]
  }));
  drawLineChart('dietChart', labels, series);

  const dietRows = health.slice(0, 100).map(r => {
    const filtered = { 'Date/Time': r['Date/Time'] };
    dietCols.forEach(c => filtered[c] = r[c]);
    return filtered;
  });
  renderTable('dietTable', dietRows);
}

// ====== SYMPTOMS TAB ======
function renderSymptomsTab() {
  renderTable('symptomsTable', dataStore.symptoms.slice(0, 200));
}

// ====== MOOD TAB ======
function renderMoodTab() {
  const mood = dataStore.mood;
  if (mood.length === 0) return;

  const last60 = mood.slice(0, 60).reverse();
  const labels = last60.map(r => shortDate(r['Start']));
  drawLineChart('moodChart', labels, [
    { label: 'Valence', data: last60.map(r => r['Valence']), color: '#34d399' }
  ]);

  renderTable('moodTable', mood.slice(0, 200));
}

// ====== HABITS TAB ======
function setupHabitForm() {
  document.getElementById('habitDate').valueAsDate = new Date();

  document.getElementById('addHabitBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('newHabitName');
    const name = nameInput.value.trim();
    if (!name) return;
    const container = document.getElementById('habitFieldsContainer');
    const label = document.createElement('label');
    label.className = 'habit-toggle';
    label.innerHTML = `<input type="checkbox" name="${name}"> ${name}`;
    container.appendChild(label);
    nameInput.value = '';
  });

  document.getElementById('habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('habitStatus');
    const submitBtn = document.getElementById('habitSubmitBtn');

    if (WEBAPP_URL.includes('PASTE_')) {
      status.textContent = 'Set WEBAPP_URL in dashboard.js first.';
      return;
    }

    const date = document.getElementById('habitDate').value;
    const checkboxes = document.querySelectorAll('#habitFieldsContainer input[type="checkbox"]');
    const payload = { date };
    checkboxes.forEach(cb => { payload[cb.name] = cb.checked ? 'Yes' : 'No'; });

    submitBtn.disabled = true;
    status.textContent = 'Saving...';

    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script web apps don't return readable CORS headers by default
        body: JSON.stringify(payload)
      });
      status.textContent = 'Saved! (may take a minute to appear in the table below after refresh)';
    } catch (err) {
      status.textContent = 'Error saving — check WEBAPP_URL.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderHabitsTab() {
  renderTable('habitsTable', dataStore.habits.slice(0, 100));
}

// ====== CORRELATIONS TAB ======
function buildJoinedDataset() {
  // Join Health (by date), Mood (avg valence per date), Habits (by date) into one row-per-day dataset.
  const byDate = {};

  dataStore.health.forEach(r => {
    const d = toDateKey(r['Date/Time']);
    if (!d) return;
    byDate[d] = byDate[d] || {};
    Object.keys(r).forEach(k => {
      if (k === 'Date/Time') return;
      if (typeof r[k] === 'number') byDate[d][k] = r[k];
    });
  });

  const moodByDate = {};
  dataStore.mood.forEach(r => {
    const d = toDateKey(r['Start']);
    if (!d || typeof r['Valence'] !== 'number') return;
    if (!moodByDate[d]) moodByDate[d] = [];
    moodByDate[d].push(r['Valence']);
  });
  Object.keys(moodByDate).forEach(d => {
    byDate[d] = byDate[d] || {};
    byDate[d]['Mood Valence (avg)'] = moodByDate[d].reduce((a, b) => a + b, 0) / moodByDate[d].length;
  });

  dataStore.habits.forEach(r => {
    const d = toDateKey(r['Date']);
    if (!d) return;
    byDate[d] = byDate[d] || {};
    Object.keys(r).forEach(k => {
      if (k === 'Date') return;
      // Convert Yes/No to 1/0 for correlation purposes
      if (r[k] === 'Yes') byDate[d]['Habit: ' + k] = 1;
      else if (r[k] === 'No') byDate[d]['Habit: ' + k] = 0;
    });
  });

  return Object.values(byDate);
}

function toDateKey(val) {
  const d = new Date(val);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function pValueFromR(r, n) {
  // t-statistic for Pearson r, then approximate two-tailed p-value via t-distribution
  if (n < 3 || Math.abs(r) >= 1) return r === 0 ? 1 : 0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  return tDistTwoTailedP(Math.abs(t), df);
}

// Approximation of the two-tailed p-value for a t-distribution (Abramowitz & Stegun style approx via incomplete beta)
function tDistTwoTailedP(t, df) {
  const x = df / (df + t * t);
  const p = incompleteBeta(x, df / 2, 0.5);
  return p;
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaContinuedFraction(x, a, b) / a;
  } else {
    return 1 - bt * betaContinuedFraction(1 - x, b, a) / b;
  }
}

function betaContinuedFraction(x, a, b) {
  const MAXIT = 100, EPS = 3e-7, FPMIN = 1e-30;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function logGamma(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function renderCorrelationsTab() {
  const joined = buildJoinedDataset();
  const threshold = parseFloat(document.getElementById('corrThreshold').value);
  const sigOnly = document.getElementById('sigOnly').checked;

  if (joined.length < 5) {
    document.getElementById('correlationTable').innerHTML = '<tr><td>Not enough joined data yet (need at least 5 overlapping days).</td></tr>';
    return;
  }

  // Collect all numeric field names present across the joined dataset
  const allFields = new Set();
  joined.forEach(row => Object.keys(row).forEach(k => allFields.add(k)));
  const fields = Array.from(allFields);

  const results = [];
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const fieldA = fields[i], fieldB = fields[j];
      if (isRedundantPair(fieldA, fieldB)) continue;

      const pairs = joined
        .filter(row => typeof row[fieldA] === 'number' && typeof row[fieldB] === 'number')
        .map(row => [row[fieldA], row[fieldB]]);
      if (pairs.length < 5) continue;

      const x = pairs.map(p => p[0]);
      const y = pairs.map(p => p[1]);
      // Skip constant columns (zero variance breaks correlation math)
      if (new Set(x).size === 1 || new Set(y).size === 1) continue;

      const r = pearsonCorrelation(x, y);
      const p = pValueFromR(r, pairs.length);
      results.push({ fieldA, fieldB, r, p, n: pairs.length });
    }
  }

  let filtered = results.filter(res => Math.abs(res.r) >= threshold);
  if (sigOnly) filtered = filtered.filter(res => res.p < 0.05);
  filtered.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  const table = document.getElementById('correlationTable');
  if (filtered.length === 0) {
    table.innerHTML = '<tr><td>No correlations match the current filter.</td></tr>';
    return;
  }

  const thead = `<thead><tr><th>Field A</th><th>Field B</th><th>r</th><th>p-value</th><th>Significant</th><th>n</th></tr></thead>`;
  const tbody = `<tbody>${filtered.slice(0, 150).map(res => `
    <tr>
      <td>${res.fieldA}</td>
      <td>${res.fieldB}</td>
      <td>${res.r.toFixed(3)}</td>
      <td>${res.p.toFixed(4)}</td>
      <td class="${res.p < 0.05 ? 'sig-yes' : 'sig-no'}">${res.p < 0.05 ? 'Yes' : 'No'}</td>
      <td>${res.n}</td>
    </tr>
  `).join('')}</tbody>`;
  table.innerHTML = thead + tbody;
}

// Groups of fields that are trivially related by definition (sub-components of
// the same measurement, or min/max/avg of the same underlying metric). Any pair
// where both fields fall in the same group is skipped, since a high correlation
// there reflects arithmetic, not behavior.
const REDUNDANT_GROUPS = [
  ['Sleep Analysis [Total] (hr)', 'Sleep Analysis [Asleep] (hr)', 'Sleep Analysis [In Bed] (hr)',
   'Sleep Analysis [Core] (hr)', 'Sleep Analysis [Deep] (hr)', 'Sleep Analysis [REM] (hr)',
   'Sleep Analysis [Awake] (hr)'],
  ['Heart Rate [Min] (count/min)', 'Heart Rate [Max] (count/min)', 'Heart Rate [Avg] (count/min)',
   'Resting Heart Rate (count/min)', 'Walking Heart Rate Average (count/min)'],
  ['Active Energy (kcal)', 'Resting Energy (kcal)', 'Apple Exercise Time (min)',
   'Apple Stand Hour (count)', 'Apple Stand Time (min)', 'Step Count (count)',
   'Walking + Running Distance (mi)', 'Physical Effort (kcal/hr·kg)', 'Flights Climbed (count)'],
  ['Walking Speed (mi/hr)', 'Walking Step Length (in)', 'Walking Asymmetry Percentage (%)',
   'Walking Double Support Percentage (%)', 'Walking Heart Rate Average (count/min)'],
  ['Stair Speed: Down (ft/s)', 'Stair Speed: Up (ft/s)']
];

function isRedundantPair(fieldA, fieldB) {
  return REDUNDANT_GROUPS.some(group => group.includes(fieldA) && group.includes(fieldB));
}

// ====== HELPERS ======
function drawLineChart(canvasId, labels, series) {
  const ctx = document.getElementById(canvasId);
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color + '33',
        tension: 0.3,
        pointRadius: 0,
        fill: false
      }))
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#eaeaea' } } },
      scales: {
        x: { ticks: { color: '#9a9a9a' }, grid: { color: '#2a2a2e' } },
        y: { ticks: { color: '#9a9a9a' }, grid: { color: '#2a2a2e' } }
      }
    }
  });
}

function renderTable(tableId, rows) {
  const table = document.getElementById(tableId);
  if (rows.length === 0) { table.innerHTML = '<tr><td>No data</td></tr>'; return; }
  const cols = Object.keys(rows[0]);
  const thead = `<thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r =>
    `<tr>${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`
  ).join('')}</tbody>`;
  table.innerHTML = thead + tbody;
}

function fmt(val, unit) {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'number' ? val.toFixed(1).replace(/\.0$/, '') : val;
  return unit ? `${num} ${unit}` : `${num}`;
}

function shortDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
