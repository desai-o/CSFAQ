export function calculateRangeTotal(data = []) {
  return data.reduce((sum, cell) => {
    // Prefer the API-provided `interactions` count (includes votes and any
    // other event types) so the total reflects real activity even when the
    // underlying data only contains vote events. Falling back to
    // questions + answers would make the total 0 in that case, which
    // causes the "Total Interactions" badge and its trend percentage to
    // collapse to "—" or "0.0%" even when there is real activity.
    const interactions = Number(cell?.interactions ?? 0) || 0;
    if (interactions > 0) return sum + interactions;
    const questions = Number(cell?.questions ?? 0) || 0;
    const answers = Number(cell?.answers ?? 0) || 0;
    return sum + questions + answers;
  }, 0);
}

export function calculateTrendPercent(current, previous) {
  if (previous == null) {
    return { value: '—', positive: true };
  }

  if (previous === 0) {
    return current > 0
      ? { value: '+∞%', positive: true }
      : { value: '0.0%', positive: true };
  }

  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';

  return {
    value: `${sign}${pct.toFixed(1)}%`,
    positive: pct >= 0,
  };
}
