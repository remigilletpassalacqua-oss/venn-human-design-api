import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBirthPositions, calculateHumanDesign } from 'natalengine';

// Frozen Swiss Ephemeris 2.10 true-node longitudes, tropical, true ecliptic of
// date. The Swiss library is an audit oracle only; it is not a runtime dependency.
// Eight fictional charts plus one published Jobs chart, both natal and Design
// moments. Design times are Venn's closest representable minute at 88° solar arc.
const reference = [
  ['V1 P', '1990-01-15T13:30:00Z', 316.5808237296865],
  ['V1 D', '1989-10-20T13:39:00Z', 323.58065407682994],
  ['C1 P', '1988-04-18T07:25:00Z', 352.63839922130643],
  ['C1 D', '1988-01-21T07:43:00Z', 354.40248231384254],
  ['C2 P', '1992-07-03T20:10:00Z', 270.656874965105],
  ['C2 D', '1992-04-03T15:18:00Z', 274.1432058129771],
  ['C3 P', '1989-11-27T05:40:00Z', 319.6926308714453],
  ['C3 D', '1989-08-30T08:41:00Z', 325.85072965052444],
  ['V2 P', '1993-02-09T10:50:00Z', 259.43665709159876],
  ['V2 D', '1992-11-14T19:56:00Z', 261.7185904847339],
  ['C4 P', '1991-05-30T16:05:00Z', 289.3963902319175],
  ['C4 D', '1991-03-01T20:28:00Z', 297.29294635683294],
  ['C5 P', '1987-08-21T23:15:00Z', 2.80854555321041],
  ['C5 D', '1987-05-21T23:04:00Z', 10.447420485872714],
  ['C6 P', '1994-12-11T19:45:00Z', 224.3686442677979],
  ['C6 D', '1994-09-14T14:28:00Z', 226.45744178858283],
  ['Jobs P', '1955-02-25T03:15:00Z', 273.410023826605],
  ['Jobs D', '1954-11-30T11:54:00Z', 275.71573299730096],
];

function deltaDegrees(a, b) {
  return ((a - b + 540) % 360) - 180;
}

function atUtcMoment(value, options) {
  const date = new Date(value);
  return calculateBirthPositions(date.getUTCFullYear(), date.getUTCMonth() + 1,
    date.getUTCDate(), date.getUTCHours() + date.getUTCMinutes() / 60, 0,
    null, null, options);
}

test('true nodes follow the Swiss Ephemeris reference within 15 arcseconds', () => {
  for (const [label, moment, swissLongitude] of reference) {
    const positions = atUtcMoment(moment);
    const error = Math.abs(deltaDegrees(positions.northNode.longitude,
      swissLongitude)) * 3600;
    assert(error <= 15, `${label}: ${error.toFixed(3)} arcseconds`);
    assert(Math.abs(deltaDegrees(positions.southNode.longitude,
      (positions.northNode.longitude + 180) % 360)) < 1e-10, label);
    assert.equal(positions.nodeType, 'true', label);
  }
});

test('mean node remains a separate unchanged option', () => {
  const trueChart = atUtcMoment('1955-02-25T03:15:00Z');
  const meanChart = atUtcMoment('1955-02-25T03:15:00Z', { nodeType: 'mean' });
  assert.equal(meanChart.nodeType, 'mean');
  assert(Math.abs(deltaDegrees(meanChart.northNode.longitude,
    272.5049475262944)) < 0.03);
  assert(Math.abs(deltaDegrees(trueChart.northNode.longitude,
    meanChart.northNode.longitude)) > 0.8);
});

test('published Jobs Design nodal lines become 58.2 and 52.2', () => {
  const chart = calculateHumanDesign('1955-02-24', 19.25, -8);
  assert.equal(chart.gates.design.northNode.gate, 58);
  assert.equal(chart.gates.design.northNode.line, 2);
  assert.equal(chart.gates.design.southNode.gate, 52);
  assert.equal(chart.gates.design.southNode.line, 2);
});
