import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRangeTotal, calculateTrendPercent } from './communityHeatmapUtils.js';

test('calculateRangeTotal sums questions and answers from heatmap rows', () => {
  const rows = [
    { questions: 4, answers: 8 },
    { questions: 2, answers: 1 },
    { questions: 0, answers: 0 }
  ];

  assert.equal(calculateRangeTotal(rows), 15);
});

test('calculateTrendPercent returns a real percentage change for the current and previous totals', () => {
  const result = calculateTrendPercent(120, 100);

  assert.equal(result.value, '+20.0%');
  assert.equal(result.positive, true);
});
