import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { calculateHumanDesign } from 'natalengine';
import { DateTime } from 'luxon';
import { app } from '../server.mjs';

// Fictional births from Venn's offline chart benchmark; never real user data.
const knownHourCharts = [
  ['V1', '1990-01-15', '14:30', 'Europe/Paris'],
  ['C1', '1988-04-18', '09:25', 'Europe/Paris'],
  ['C2', '1992-07-03', '22:10', 'Europe/Paris'],
  ['C3', '1989-11-27', '06:40', 'Europe/Paris'],
  ['V2', '1993-02-09', '11:50', 'Europe/Paris'],
  ['C4', '1991-05-30', '18:05', 'Europe/Paris'],
  ['C5', '1987-08-22', '01:15', 'Europe/Paris'],
  ['C6', '1994-12-11', '20:45', 'Europe/Paris'],
];

function calculate(date, time, zone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = DateTime.fromObject({ year, month, day, hour, minute }, { zone });
  assert(local.isValid, `Invalid fixture ${date} ${time} ${zone}`);
  return calculateHumanDesign(date, hour + minute / 60, local.offset / 60);
}

function solarArcErrorArcsec(chart) {
  const personality = chart.gates.personality.sun.longitude;
  const design = chart.gates.design.sun.longitude;
  return Math.abs(((personality - design + 360) % 360) - 88) * 3600;
}

test('eight known-hour charts resolve Design to the nearest minute', () => {
  for (const [id, date, time, zone] of knownHourCharts) {
    const chart = calculate(date, time, zone);
    assert(solarArcErrorArcsec(chart) <= 2,
      `${id} Design solar arc error: ${solarArcErrorArcsec(chart)} arcseconds`);
    assert.equal(Object.keys(chart.gates.personality).length, 13, id);
    assert.equal(Object.keys(chart.gates.design).length, 13, id);
    assert.equal(chart.gates.design.sun.longitude, chart.positions.design.sun.longitude, id);
    for (const channel of chart.channels) {
      assert(channel.gates.every((gate) => chart.gates.all.includes(gate)), id);
    }
  }
});

test('the boundary fixture puts Design Moon on gate 39.6, not 53.1', () => {
  const chart = calculate('1990-01-15', '14:30', 'Europe/Paris');
  assert.equal(chart.gates.design.moon.gate, 39);
  assert.equal(chart.gates.design.moon.line, 6);
  assert(solarArcErrorArcsec(chart) < 1);
});

test('minute conversion stays precise across dates and birth offsets', () => {
  let worstError = 0;
  for (let index = 0; index < 120; index++) {
    const year = 1970 + (index * 37) % 55;
    const month = 1 + (index * 7) % 12;
    const day = 1 + (index * 11) % 27;
    const hour = (index * 13) % 24 + ((index * 17) % 60) / 60;
    const timezone = [-8, -5, 0, 1, 2, 5.5, 10][index % 7];
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const chart = calculateHumanDesign(date, hour, timezone);
    worstError = Math.max(worstError, solarArcErrorArcsec(chart));
  }
  assert(worstError <= 2, `Worst Design solar arc error: ${worstError} arcseconds`);
});

test('the Design search is independent of the server host timezone', () => {
  const code = `import { calculateHumanDesign } from 'natalengine';
    const c = calculateHumanDesign('1990-01-15', 14.5, 1);
    console.log(JSON.stringify({sun:c.gates.design.sun.longitude,
      moon:c.gates.design.moon.longitude, date:c.positions.design.date}));`;
  const run = (zone) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code],
      { encoding: 'utf8', env: { ...process.env, TZ: zone } });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  };
  assert.deepEqual(run('UTC'), run('Pacific/Auckland'));
});

test('the Venn HTTP endpoint returns the corrected chart and birth timezone', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/human-design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ birthDate: '1990-01-15', birthTime: '14:30',
        latitude: 48.8566, longitude: 2.3522 }),
    });
    assert.equal(response.status, 200);
    const chart = await response.json();
    assert.equal(chart.calculationVersion, 'venn-api-v2');
    assert.equal(chart.vennInput.ianaTimezone, 'Europe/Paris');
    assert.equal(chart.vennInput.timezone, 1);
    assert.equal(chart.gates.design.moon.gate, 39);
    assert(solarArcErrorArcsec(chart) <= 2);
  } finally {
    await new Promise((resolve, reject) => server.close((error) =>
      error ? reject(error) : resolve()));
  }
});
