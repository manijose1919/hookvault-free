// Retry delay strategy. The free core uses a fixed (linear) delay; the Premium
// backoff module swaps in exponential growth via the feature gate. Kept as a
// pure function so both strategies are trivially unit-testable.

export function nextDelayMs(failedAttemptNumber, { strategy, baseMs }) {
  if (strategy === 'exponential') {
    return baseMs * 2 ** (failedAttemptNumber - 1);
  }
  return baseMs; // linear / fixed
}
