// ====== CONFIG ======
const CONFIG = {
  health: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=767932203&single=true&output=csv',
  symptoms: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=1608466763&single=true&output=csv',
  mood: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=880120131&single=true&output=csv'
};

let dataStore = { health: [], symptoms: [], mood: [] };
let charts = {};

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
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
  const [health, symptoms, mood] = await Promise.all([
    fetchCsv(CONFIG.health),
    fetchCsv(CONFIG.symptoms),
    fetchCsv(CONFIG.mood)
  ]);
  dataStore.health = health;
  dataStore.symptoms = symptoms;
  dataStore.mood = mood;

  renderOverview();
  renderHealthTab();
  renderSymptomsTab();
  renderMoodTab();
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
