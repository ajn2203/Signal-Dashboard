// ====== CONFIG ======
const CONFIG = {
  health: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=767932203&single=true&output=csv',
  symptoms: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=1608466763&single=true&output=csv',
  mood: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=880120131&single=true&output=csv',
  habits: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=335739502&single=true&output=csv',
  screentime: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pub?gid=1962964825&single=true&output=csv',
  // TODO: paste your published "Workouts" tab CSV link here (File > Share > Publish to web > select the Workouts sheet > CSV)
  workouts: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8hdGPZnbCBnqfHPno1DDZ4QqVs2ydLu9_l01h6HAH9UQgShsJzMj5yYYdPDh-77KxMJkpmzuka3as/pubhtml?gid=971264779&single=true&output=csv'
};

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzg8Uri9-dsiV8HKZzW8byvPMzqicNTCVbkgfx3nlv0MFtfgCuBluoB1Fh6E8FQJoqDcw/exec';

const DIET_KEYWORDS = ['diet', 'food', 'calorie', 'carb', 'protein', 'fat', 'sugar', 'fiber', 'sodium', 'water', 'meal', 'nutrition', 'vitamin', 'cholesterol'];

// Metrics the trend-detection engine watches. "goodDirection" is used only to
// color the alert card (green = trending the healthy way, amber = worth a look);
// it never hides or filters a trend, just labels it.
const TREND_METRICS = [
  { key: 'Resting Heart Rate (count/min)', label: 'Resting Heart Rate', unit: 'bpm', goodDirection: 'down' },
  { key: 'Heart Rate Variability (ms)', label: 'HRV', unit: 'ms', goodDirection: 'up' },
  { key: 'Sleep Analysis [Total] (hr)', label: 'Sleep (Total)', unit: 'hr', goodDirection: 'up' },
  { key: 'Step Count (count)', label: 'Steps', unit: 'steps', goodDirection: 'up' },
  { key: 'Active Energy (kcal)', label: 'Active Energy', unit: 'kcal', goodDirection: 'up' },
  { key: 'Apple Exercise Time (min)', label: 'Exercise Time', unit: 'min', goodDirection: 'up' },
  { key: 'Weight (lb)', label: 'Weight', unit: 'lb', goodDirection: null },
  { key: 'VO2 Max (ml/(kg·min))', label: 'VO2 Max', unit: '', goodDirection: 'up' }
];

let dataStore = { health: [], symptoms: [], mood: [], habits: [], screentime: [], workouts: [] };
let charts = {};

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupHabitForm();
  setupScreenTimeForm();
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
  const [health, symptoms, mood, habits, screentime, workouts] = await Promise.all([
    fetchCsv(CONFIG.health),
    fetchCsv(CONFIG.symptoms),
    fetchCsv(CONFIG.mood),
    fetchCsv(CONFIG.habits).catch(() => []),
    fetchCsv(CONFIG.screentime).catch(() => []),
    fetchCsv(CONFIG.workouts).catch(() => [])
  ]);
  dataStore.health = health;
  dataStore.symptoms = symptoms;
  dataStore.mood = mood;
  dataStore.habits = habits;
  dataStore.screentime = screentime;
  dataStore.workouts = workouts;

  renderOverview();
  renderHealthTab();
  renderDietTab();
  renderSymptomsTab();
  renderMoodTab();
  renderHabitsTab();
  renderScreenTimeTab();
  renderWorkoutsTab();
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
  renderTrendAlerts();
  if (health.length === 0) return;

  const latest = health[0];
  const cards = [
    { label: 'Resting HR', value: fmt(latest['Resting Heart Rate (count/min)'], 'bpm') },
    { label: 'HRV', value: fmt(latest['Heart Rate Variability (ms)'], 'ms') },
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

  drawLineChart('hrvChart', labels, [
    { label: 'HRV (ms)', data: last30.map(r => r['Heart Rate Variability (ms)']), color: '#a78bfa' }
  ]);
}

// ====== TREND DETECTION ======
// Compares a "recent" window (last `recentDays`) against a "baseline" window
// (the `baselineDays` before that) for one metric and flags it if the shift
// is large relative to that metric's own recent variability (z-score), not
// just an arbitrary percentage. This avoids flagging noisy low-signal metrics
// while still catching real shifts in things that don't normally move much.
function daysAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return (Date.now() - d.getTime()) / 86400000;
}

function detectTrend(rows, dateField, metricField, recentDays = 7, baselineDays = 21) {
  const recentVals = [];
  const baselineVals = [];
  rows.forEach(r => {
    const val = r[metricField];
    if (typeof val !== 'number') return;
    const age = daysAgo(r[dateField]);
    if (age === null || age < 0) return;
    if (age <= recentDays) recentVals.push(val);
    else if (age <= recentDays + baselineDays) baselineVals.push(val);
  });

  // Require a minimum sample in each window so a single data point can't
  // register as a "trend."
  if (recentVals.length < 3 || baselineVals.length < 5) return null;

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = arr => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
  };

  const baseMean = mean(baselineVals);
  const baseStd = std(baselineVals) || Math.abs(baseMean) * 0.05 || 1;
  const recentMean = mean(recentVals);
  const zScore = (recentMean - baseMean) / baseStd;
  const pctChange = baseMean !== 0 ? ((recentMean - baseMean) / Math.abs(baseMean)) * 100 : 0;

  return {
    recentMean, baseMean, zScore, pctChange,
    direction: recentMean > baseMean ? 'up' : 'down',
    n: recentVals.length
  };
}

function renderTrendAlerts() {
  const container = document.getElementById('trendAlerts');
  if (!container) return;
  const health = dataStore.health;

  if (health.length === 0) {
    container.innerHTML = '<p class="muted">Not enough data yet to detect trends.</p>';
    return;
  }

  const results = [];
  TREND_METRICS.forEach(m => {
    const trend = detectTrend(health, 'Date/Time', m.key);
    if (!trend) return;
    if (Math.abs(trend.zScore) < 1) return; // only surface meaningful shifts
    results.push({ ...trend, ...m });
  });

  results.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  const top = results.slice(0, 5);

  if (top.length === 0) {
    container.innerHTML = '<p class="muted">No notable trends this week — everything\'s tracking close to your recent baseline.</p>';
    return;
  }

  container.innerHTML = top.map(t => {
    const arrow = t.direction === 'up' ? '▲' : '▼';
    const cls = t.goodDirection ? (t.direction === t.goodDirection ? 'trend-good' : 'trend-watch') : 'trend-neutral';
    const pct = Math.abs(t.pctChange).toFixed(0);
    const unit = t.unit ? ` ${t.unit}` : '';
    return `
      <div class="trend-card ${cls}">
        <div class="trend-arrow">${arrow}</div>
        <div class="trend-body">
          <div class="trend-label">${t.label}</div>
          <div class="trend-detail">${t.direction === 'up' ? 'Up' : 'Down'} ${pct}% vs. your last 3 weeks — averaging ${fmt(t.recentMean)}${unit} this week</div>
        </div>
      </div>
    `;
  }).join('');
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
const SEVERITY_SCALE = { 'mild': 1, 'moderate': 2, 'severe': 3 };

function renderSymptomsTab() {
  renderTable('symptomsTable', dataStore.symptoms.slice(0, 200));
  renderSymptomFrequencyChart();
  renderSymptomSeverityChart();
  setupSymptomSelect();
}

function setupSymptomSelect() {
  const symptoms = dataStore.symptoms;
  const select = document.getElementById('symptomSelect');
  if (symptoms.length === 0) {
    select.innerHTML = '<option>No symptoms logged yet</option>';
    return;
  }

  const uniqueSymptoms = Array.from(new Set(symptoms.map(r => r['Symptom']).filter(Boolean))).sort();
  select.innerHTML = uniqueSymptoms.map(s => `<option value="${s}">${s}</option>`).join('');
  select.removeEventListener('change', onSymptomSelectChange);
  select.addEventListener('change', onSymptomSelectChange);
  renderSingleSymptomChart(uniqueSymptoms[0]);
}

function onSymptomSelectChange(e) {
  renderSingleSymptomChart(e.target.value);
}

function renderSingleSymptomChart(symptomName) {
  if (!symptomName) return;
  const filtered = dataStore.symptoms.filter(r => r['Symptom'] === symptomName);

  const byDate = {};
  filtered.forEach(r => {
    const d = toDateKey(r['Start']);
    const sevRaw = String(r['Severity'] || '').trim().toLowerCase();
    const sevNum = SEVERITY_SCALE[sevRaw];
    if (!d || sevNum === undefined) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(sevNum);
  });

  const dates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
  const avgSeverity = dates.map(d => {
    const vals = byDate[d];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  drawLineChart('singleSymptomChart', dates.map(d => shortDate(d)), [
    { label: `${symptomName} — Avg Severity (1=Mild, 2=Moderate, 3=Severe)`, data: avgSeverity, color: '#34d399' }
  ]);
}

function renderSymptomFrequencyChart() {
  const symptoms = dataStore.symptoms;
  if (symptoms.length === 0) return;

  const counts = {};
  symptoms.forEach(r => {
    const name = r['Symptom'];
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  drawBarChart('symptomFreqChart', entries.map(e => e[0]), [
    { label: 'Occurrences', data: entries.map(e => e[1]), color: '#f87171' }
  ]);
}

function renderSymptomSeverityChart() {
  const symptoms = dataStore.symptoms;
  if (symptoms.length === 0) return;

  const byDate = {};
  symptoms.forEach(r => {
    const d = toDateKey(r['Start']);
    const sevRaw = String(r['Severity'] || '').trim().toLowerCase();
    const sevNum = SEVERITY_SCALE[sevRaw];
    if (!d || sevNum === undefined) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(sevNum);
  });

  const dates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
  const last30Dates = dates.slice(-30);
  const avgSeverity = last30Dates.map(d => {
    const vals = byDate[d];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  drawLineChart('symptomSeverityChart', last30Dates.map(d => shortDate(d)), [
    { label: 'Avg Severity (1=Mild, 2=Moderate, 3=Severe)', data: avgSeverity, color: '#fbbf24' }
  ]);
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
    const payload = { date, _sheet: 'Habits' };
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
  renderHabitFrequencyChart();
}

function renderHabitFrequencyChart() {
  const habits = dataStore.habits;
  if (habits.length === 0) return;

  const habitNames = Object.keys(habits[0]).filter(k => k !== 'Date');

  const counts = habitNames.map(name => {
    const yesCount = habits.filter(r => String(r[name]).trim().toLowerCase() === 'yes').length;
    return { name, yesCount };
  });

  counts.sort((a, b) => b.yesCount - a.yesCount);

  drawBarChart('habitFreqChart', counts.map(c => c.name), [
    { label: 'Days logged "Yes"', data: counts.map(c => c.yesCount), color: '#5eb1ff' }
  ]);
}

// ====== SCREEN TIME TAB ======
function setupScreenTimeForm() {
  document.getElementById('screenTimeDate').valueAsDate = new Date();

  document.getElementById('screenTimeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('screenTimeStatus');
    const submitBtn = document.getElementById('screenTimeSubmitBtn');

    if (WEBAPP_URL.includes('PASTE_')) {
      status.textContent = 'Set WEBAPP_URL in dashboard.js first.';
      return;
    }

    const date = document.getElementById('screenTimeDate').value;
    const minutes = document.getElementById('screenTimeMinutes').value;
    const payload = { date, _sheet: 'ScreenTime', 'Total Minutes': Number(minutes) };

    submitBtn.disabled = true;
    status.textContent = 'Saving...';

    try {
      await fetch(WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      status.textContent = 'Saved! (may take a minute to appear below after refresh)';
    } catch (err) {
      status.textContent = 'Error saving — check WEBAPP_URL.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderScreenTimeTab() {
  const screentime = dataStore.screentime;
  renderTable('screenTimeTable', screentime.slice(0, 100));

  if (screentime.length === 0) {
    console.log('Screen Time: no rows loaded from CSV. Check CONFIG.screentime URL and that the sheet has data.');
    return;
  }

  const sampleRow = screentime[0];
  const keys = Object.keys(sampleRow);
  const dateKey = keys.find(k => k.trim().toLowerCase() === 'date') || 'Date';
  const minutesKey = keys.find(k => k.trim().toLowerCase() === 'total minutes') || 'Total Minutes';

  console.log('Screen Time keys found:', keys, 'using dateKey:', dateKey, 'minutesKey:', minutesKey);

  const validRows = screentime.filter(r => r[dateKey] && r[minutesKey] !== undefined && r[minutesKey] !== null && r[minutesKey] !== '');

  if (validRows.length === 0) {
    console.log('Screen Time: rows exist but none have both a date and a minutes value.', screentime.slice(0, 3));
    return;
  }

  const sorted = [...validRows].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
  const last30 = sorted.slice(-30);
  const labels = last30.map(r => shortDate(r[dateKey]));

  drawLineChart('screenTimeChart', labels, [
    { label: 'Total Minutes', data: last30.map(r => Number(r[minutesKey])), color: '#fbbf24' }
  ]);
}

// ====== WORKOUTS TAB ======
function renderWorkoutsTab() {
  const workouts = dataStore.workouts;
  const cardsEl = document.getElementById('workoutCards');
  const table = document.getElementById('workoutsTable');

  if (workouts.length === 0) {
    cardsEl.innerHTML = '<p class="muted">No workouts logged yet. Add rows to your Workouts sheet and set CONFIG.workouts in dashboard.js.</p>';
    table.innerHTML = '<tr><td>No data</td></tr>';
    return;
  }

  // Defensive key lookup, same pattern as Screen Time, since this sheet may
  // be populated by hand and headers can drift slightly.
  const keys = Object.keys(workouts[0]);
  const dateKey = keys.find(k => k.trim().toLowerCase() === 'date') || 'Date';
  const strainKey = keys.find(k => k.trim().toLowerCase() === 'strain') || 'Strain';
  const recoveryKey = keys.find(k => k.trim().toLowerCase().includes('recovery')) || 'Recovery Score';
  const caloriesKey = keys.find(k => k.trim().toLowerCase().includes('calor')) || 'Calories (kcal)';
  const avgHrKey = keys.find(k => k.trim().toLowerCase().includes('avg hr')) || 'Avg HR';

  const validRows = workouts.filter(r => r[dateKey]);
  const sortedAsc = [...validRows].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
  const sortedDesc = [...sortedAsc].reverse();

  const last30 = sortedAsc.slice(-30);
  const avgStrain = average(last30.map(r => r[strainKey]).filter(isNum));
  const avgRecovery = average(last30.map(r => r[recoveryKey]).filter(isNum));
  const totalCalories = last30.reduce((sum, r) => sum + (isNum(r[caloriesKey]) ? r[caloriesKey] : 0), 0);

  cardsEl.innerHTML = [
    { label: 'Workouts (30d)', value: last30.length },
    { label: 'Avg Strain (30d)', value: fmt(avgStrain) },
    { label: 'Avg Recovery (30d)', value: fmt(avgRecovery) },
    { label: 'Total Calories (30d)', value: fmt(totalCalories, 'kcal') }
  ].map(c => `
    <div class="card">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>
  `).join('');

  const chartRows = sortedAsc.slice(-30);
  const labels = chartRows.map(r => shortDate(r[dateKey]));

  drawLineChart('workoutStrainChart', labels, [
    { label: 'Strain', data: chartRows.map(r => r[strainKey]), color: '#f87171' },
    { label: 'Recovery', data: chartRows.map(r => r[recoveryKey]), color: '#34d399' }
  ]);

  drawLineChart('workoutHrChart', labels, [
    { label: 'Avg HR', data: chartRows.map(r => r[avgHrKey]), color: '#5eb1ff' }
  ]);

  renderTable('workoutsTable', sortedDesc.slice(0, 100));
}

function average(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function isNum(v) { return typeof v === 'number' && !isNaN(v); }

// ====== CORRELATIONS TAB ======
function buildJoinedDataset() {
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
      if (r[k] === 'Yes') byDate[d]['Habit: ' + k] = 1;
      else if (r[k] === 'No') byDate[d]['Habit: ' + k] = 0;
    });
  });

  dataStore.screentime.forEach(r => {
    const d = toDateKey(r['Date']);
    if (!d || typeof r['Total Minutes'] !== 'number') return;
    byDate[d] = byDate[d] || {};
    byDate[d]['Screen Time (min)'] = r['Total Minutes'];
  });

  if (dataStore.workouts.length > 0) {
    const keys = Object.keys(dataStore.workouts[0]);
    const dateKey = keys.find(k => k.trim().toLowerCase() === 'date') || 'Date';
    const strainKey = keys.find(k => k.trim().toLowerCase() === 'strain') || 'Strain';
    const recoveryKey = keys.find(k => k.trim().toLowerCase().includes('recovery')) || 'Recovery Score';

    dataStore.workouts.forEach(r => {
      const d = toDateKey(r[dateKey]);
      if (!d) return;
      byDate[d] = byDate[d] || {};
      if (typeof r[strainKey] === 'number') byDate[d]['Workout Strain'] = r[strainKey];
      if (typeof r[recoveryKey] === 'number') byDate[d]['Workout Recovery'] = r[recoveryKey];
    });
  }

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
  if (n < 3 || Math.abs(r) >= 1) return r === 0 ? 1 : 0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  return tDistTwoTailedP(Math.abs(t), df);
}

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
  const a = String(fieldA).trim();
  const b = String(fieldB).trim();
  return REDUNDANT_GROUPS.some(group => {
    const normalizedGroup = group.map(g => g.trim());
    return normalizedGroup.includes(a) && normalizedGroup.includes(b);
  });
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
        pointRadius: 3,
        pointBackgroundColor: s.color,
        pointBorderColor: '#0d0d0f',
        pointBorderWidth: 1,
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

function drawBarChart(canvasId, labels, series) {
  const ctx = document.getElementById(canvasId);
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.label,
        data: s.data,
        backgroundColor: s.color + 'aa',
        borderColor: s.color,
        borderWidth: 1
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#eaeaea' } } },
      scales: {
        x: { ticks: { color: '#9a9a9a' }, grid: { color: '#2a2a2e' } },
        y: { ticks: { color: '#9a9a9a' }, grid: { color: '#2a2a2e' }, beginAtZero: true }
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
