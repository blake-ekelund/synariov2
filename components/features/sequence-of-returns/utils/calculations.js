/**
 * Simulate portfolio over time with year-by-year returns and withdrawals.
 * @param {object} params
 * @param {number} params.startingBalance
 * @param {number[]} params.returns - annual return rates (e.g. 0.07 = 7%)
 * @param {number} params.timeHorizon - number of years
 * @param {number} params.withdrawalRate - as decimal (e.g. 0.04 = 4%)
 * @returns {object[]} year-by-year data
 */
export function simulatePortfolio({
  startingBalance,
  returns,
  timeHorizon,
  withdrawalRate,
  annualContribution = 0,
  withdrawalStartYear = 1,
  contributionEndYear = Infinity,
  withdrawalMin = 0,
  withdrawalMax = Infinity,
}) {
  const data = [];
  let balance = startingBalance;

  for (let year = 1; year <= timeHorizon; year++) {
    const returnRate = returns[year - 1] ?? 0;
    const startBalance = balance;

    // Withdrawal is % of current balance each year, clamped to min/max
    const rawWithdrawal = year >= withdrawalStartYear ? balance * withdrawalRate : 0;
    const clampedWithdrawal =
      rawWithdrawal > 0
        ? Math.min(Math.max(rawWithdrawal, withdrawalMin), withdrawalMax)
        : 0;

    const withdrawal = Math.min(clampedWithdrawal, Math.max(0, balance));
    const contribution = year <= contributionEndYear ? annualContribution : 0;

    // Withdraw first, then contribute, then grow
    const balanceAfterNet = balance - withdrawal + contribution;
    const growth = balanceAfterNet * returnRate;
    const endBalance = Math.max(0, balanceAfterNet + growth);

    data.push({
      year,
      startBalance,
      returnRate,
      withdrawal,
      contribution,
      growth,
      endBalance,
    });

    balance = endBalance;

    if (balance <= 0 && contribution <= 0) {
      // Portfolio depleted — fill remaining years
      for (let y = year + 1; y <= timeHorizon; y++) {
        data.push({
          year: y,
          startBalance: 0,
          returnRate: returns[y - 1] ?? 0,
          withdrawal: 0,
          contribution: 0,
          growth: 0,
          endBalance: 0,
        });
      }
      break;
    }
  }

  return data;
}

// ─── Historical Preset Scenarios ─────────────────────────────────────────────

// Real S&P 500 annual total returns (dividends reinvested)
export const PRESET_SCENARIOS = [
  {
    id: "great-depression",
    name: "Great Depression",
    period: "1929 – 1958",
    description: "Dow fell 89% peak-to-trough. The worst bear market in US history.",
    returns: [
      -0.084, -0.249, -0.433, -0.082, 0.539, -0.014, 0.477, 0.339, -0.35, 0.311,
      -0.004, -0.098, -0.116, 0.203, 0.259, 0.198, 0.364, -0.081, 0.057, 0.055,
      0.188, 0.317, 0.24, 0.184, -0.01, 0.526, 0.316, 0.066, -0.108, 0.434,
    ],
  },
  {
    id: "stagflation",
    name: "1970s Stagflation",
    period: "1968 – 1997",
    description: "Oil shocks, double-digit inflation, and a decade of stagnant markets.",
    returns: [
      0.108, -0.085, 0.04, 0.143, 0.19, -0.147, -0.265, 0.372, 0.238, -0.072,
      0.066, 0.184, 0.324, -0.049, 0.214, 0.225, 0.063, 0.322, 0.185, 0.052,
      0.168, 0.315, -0.031, 0.305, 0.076, 0.101, 0.013, 0.376, 0.23, 0.334,
    ],
  },
  {
    id: "dotcom",
    name: "Dot-com + 2008",
    period: "2000 – 2029",
    description: "Two major crashes in the first decade — the worst sequence-of-returns scenario.",
    returns: [
      -0.091, -0.119, -0.221, 0.287, 0.109, 0.049, 0.158, 0.055, -0.37, 0.265,
      0.151, 0.021, 0.16, 0.324, 0.137, 0.014, 0.12, 0.218, -0.044, 0.315,
      0.184, 0.287, -0.181, 0.263, 0.233, 0.07, 0.07, 0.07, 0.07, 0.07,
    ],
  },
  {
    id: "financial-crisis",
    name: "2008 Financial Crisis",
    period: "2006 – 2035",
    description: "Housing bubble collapse. S&P 500 fell 57% from peak, striking year 3 of retirement.",
    returns: [
      0.158, 0.055, -0.37, 0.265, 0.151, 0.021, 0.16, 0.324, 0.137, 0.014,
      0.12, 0.218, -0.044, 0.315, 0.184, 0.287, -0.181, 0.263, 0.233, 0.07,
      0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
    ],
  },
];

// ─── Asset Allocation Data ───────────────────────────────────────────────────

export const ALLOCATIONS = [
  { label: "Aggressive Growth", ageMin: 20, ageMax: 35, stocks: 90, bonds: 10, expectedReturn: 0.098, stdDev: 0.155 },
  { label: "Growth", ageMin: 35, ageMax: 45, stocks: 80, bonds: 20, expectedReturn: 0.09, stdDev: 0.137 },
  { label: "Moderate Growth", ageMin: 45, ageMax: 55, stocks: 70, bonds: 30, expectedReturn: 0.082, stdDev: 0.119 },
  { label: "Balanced", ageMin: 55, ageMax: 62, stocks: 60, bonds: 40, expectedReturn: 0.074, stdDev: 0.101 },
  { label: "Conservative", ageMin: 62, ageMax: 70, stocks: 50, bonds: 50, expectedReturn: 0.066, stdDev: 0.085 },
  { label: "Income", ageMin: 70, ageMax: 200, stocks: 40, bonds: 60, expectedReturn: 0.058, stdDev: 0.072 },
];

/** Return the allocation row for a given age (clamps to last row at highest age band). */
export function getAllocationForAge(age, allocations = ALLOCATIONS) {
  return (
    allocations.find((a) => age >= a.ageMin && age < a.ageMax) ??
    allocations[allocations.length - 1]
  );
}

/** Return the allocation row whose expectedReturn is closest to the given rate. */
export function getClosestAllocationByReturn(rate, allocations = ALLOCATIONS) {
  return allocations.reduce((best, row) =>
    Math.abs(row.expectedReturn - rate) < Math.abs(best.expectedReturn - rate) ? row : best
  );
}

/**
 * Compute allocation periods for a given starting age + time horizon.
 * Returns array of { allocation, startYear, endYear (inclusive), startAge, endAge }.
 */
export function computeAllocationPeriods(currentAge, timeHorizon, allocations = ALLOCATIONS) {
  const periods = [];
  let year = 1;

  while (year <= timeHorizon) {
    const age = currentAge + year - 1;
    const alloc = getAllocationForAge(age, allocations);

    const yearsUntilBoundary = Math.max(1, alloc.ageMax - age);
    const endYear = Math.min(year + yearsUntilBoundary - 1, timeHorizon);

    periods.push({
      allocation: alloc,
      startYear: year,
      endYear,
      startAge: age,
      endAge: currentAge + endYear - 1,
    });

    year = endYear + 1;
  }

  return periods;
}

/**
 * Blend historical stock returns with a bond component based on age-based allocation.
 * The preset returns are 100% equity (S&P 500). This scales them to the user's actual
 * stock/bond mix, using a fixed long-run bond return of ~4.5%.
 * @param {number[]} stockReturns - raw equity returns from a historical preset
 * @param {number} currentAge - user's age at year 1
 * @param {object[]} allocations - custom allocation table
 * @param {number} bondReturn - assumed annual bond return (default 4.5%)
 */
export function blendWithBonds(
  stockReturns,
  currentAge,
  allocations = ALLOCATIONS,
  bondReturn = 0.045
) {
  return stockReturns.map((stockR, i) => {
    const age = currentAge + i;
    const alloc = getAllocationForAge(age, allocations);
    const blended = stockR * (alloc.stocks / 100) + bondReturn * (alloc.bonds / 100);
    return Math.round(blended * 10000) / 10000;
  });
}

// ─── Normal distribution sampling (Box-Muller) ───────────────────────────────

function sampleNormal(mean, stdDev) {
  let u, v;
  do {
    u = Math.random();
  } while (u === 0);
  do {
    v = Math.random();
  } while (v === 0);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdDev;
}

/**
 * Generate returns using proper normal distribution, per allocation period when age is set.
 * @param {number} mean - target average return (used when no age)
 * @param {number} count - number of years
 * @param {number|null} currentAge - if set, use per-period allocation stats
 * @param {object[]} allocations - custom allocation table
 */
export function generateNormalReturns(mean, count, currentAge = null, allocations = ALLOCATIONS) {
  if (currentAge != null) {
    return generateAgeBasedReturns(currentAge, count, true, allocations);
  }

  const alloc = getClosestAllocationByReturn(mean, allocations);

  return Array.from({ length: count }, () =>
    Math.round(sampleNormal(alloc.expectedReturn, alloc.stdDev) * 10000) / 10000
  );
}

/**
 * Generate returns using expected return per allocation period.
 * @param {number} currentAge
 * @param {number} timeHorizon
 * @param {boolean} randomize - if true, use normal distribution; else flat expected return
 * @param {object[]} allocations - custom allocation table
 */
export function generateAgeBasedReturns(
  currentAge,
  timeHorizon,
  randomize = false,
  allocations = ALLOCATIONS
) {
  const returns = [];

  for (let year = 1; year <= timeHorizon; year++) {
    const age = currentAge + year - 1;
    const alloc = getAllocationForAge(age, allocations);

    const r = randomize
      ? Math.round(sampleNormal(alloc.expectedReturn, alloc.stdDev) * 10000) / 10000
      : alloc.expectedReturn;

    returns.push(r);
  }

  return returns;
}

/**
 * Compute the weighted-average expected return across all allocation periods for a given age + horizon.
 */
export function weightedAvgReturn(currentAge, timeHorizon, allocations = ALLOCATIONS) {
  const periods = computeAllocationPeriods(currentAge, timeHorizon, allocations);
  const total = periods.reduce(
    (sum, p) => sum + p.allocation.expectedReturn * (p.endYear - p.startYear + 1),
    0
  );
  return total / timeHorizon;
}

/**
 * Generate a sequence of returns around a mean with optional randomization.
 */
export function generateReturns(mean, count, randomize = false) {
  if (!randomize) {
    return Array(count).fill(mean);
  }
  const alloc = getClosestAllocationByReturn(mean);
  return Array.from({ length: count }, () =>
    Math.round(sampleNormal(alloc.expectedReturn, alloc.stdDev) * 10000) / 10000
  );
}

export function formatCurrency(value) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatCurrencyFull(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

// ─── Monte Carlo Analysis ─────────────────────────────────────────────────────

function computePercentile(sortedArr, p) {
  return sortedArr[Math.max(0, Math.ceil(p * sortedArr.length) - 1)];
}

function quickSuccessRate(inputs, wsYear, ceYear, n, allocations = ALLOCATIONS) {
  let successes = 0;
  for (let i = 0; i < n; i++) {
    const ret = generateNormalReturns(
      inputs.avgReturn,
      inputs.timeHorizon,
      inputs.currentAge ?? null,
      allocations
    );

    const data = simulatePortfolio({
      startingBalance: inputs.startingBalance,
      returns: ret,
      timeHorizon: inputs.timeHorizon,
      withdrawalRate: inputs.withdrawalRate,
      annualContribution: inputs.annualContribution,
      withdrawalStartYear: wsYear,
      contributionEndYear: ceYear,
      withdrawalMin: inputs.withdrawalMin ?? 0,
      withdrawalMax: inputs.withdrawalMax ?? Infinity,
    });

    if ((data[data.length - 1]?.endBalance ?? 0) > 0) successes++;
  }
  return successes / n;
}

// Find the highest annual withdrawal cap (withdrawalMax) that still achieves 95% success.
// Effective spend = max(rate-based withdrawal, withdrawalMin) — whichever drives actual spending.
// Cannot suggest a cap more than 10% below that effective spend.
function binarySearchMaxWithdrawal(inputs, wsYear, ceYear, n, allocations = ALLOCATIONS) {
  const rateWithdrawal = inputs.startingBalance * inputs.withdrawalRate;
  const effectiveSpend = Math.max(rateWithdrawal, inputs.withdrawalMin ?? 0);
  if (effectiveSpend <= 0) return null;

  const hi0 =
    inputs.withdrawalMax < Infinity
      ? Math.min(inputs.withdrawalMax, effectiveSpend)
      : effectiveSpend;

  const floor = effectiveSpend * 0.9;
  if (floor >= hi0 * 0.99) return null;

  if (
    quickSuccessRate(
      { ...inputs, withdrawalMax: floor },
      wsYear,
      ceYear,
      n,
      allocations
    ) < 0.95
  ) {
    return null;
  }

  let lo = floor,
    hi = hi0;
  for (let i = 0; i < 15; i++) {
    const mid = (lo + hi) / 2;
    const rate = quickSuccessRate(
      { ...inputs, withdrawalMax: mid },
      wsYear,
      ceYear,
      n,
      allocations
    );
    if (rate >= 0.95) lo = mid;
    else hi = mid;
  }

  const result = Math.round(lo / 500) * 500;
  if (result >= effectiveSpend * 0.98) return null;
  return result;
}

// Find the minimum annual contribution that achieves 95% success (accumulation phase only).
// Cannot suggest more than 10% above the current contribution amount.
function binarySearchContribution(inputs, wsYear, ceYear, n, allocations = ALLOCATIONS) {
  if (wsYear <= 1) return null;

  const current = inputs.annualContribution ?? 0;
  const maxContrib = current > 0 ? current * 1.1 : current + 5000;

  if (
    quickSuccessRate(
      { ...inputs, annualContribution: maxContrib },
      wsYear,
      ceYear,
      n,
      allocations
    ) < 0.95
  ) {
    return null;
  }

  let lo = current,
    hi = maxContrib;
  for (let i = 0; i < 15; i++) {
    const mid = (lo + hi) / 2;
    const rate = quickSuccessRate(
      { ...inputs, annualContribution: mid },
      wsYear,
      ceYear,
      n,
      allocations
    );
    if (rate >= 0.95) hi = mid;
    else lo = mid;
  }

  const result = Math.round(hi / 500) * 500;
  if (result <= current + 500) return null;
  return result;
}

/**
 * Run N Monte Carlo simulations for a given scenario and return
 * year-by-year percentile bands plus summary stats and recommendations.
 * @param {object} inputs - same shape as scenario.inputs
 * @param {number} numSimulations
 * @param {object[]} allocations - custom allocation table
 */
export function runMonteCarloAnalysis(inputs, numSimulations = 1000, allocations = ALLOCATIONS) {
  const {
    startingBalance,
    avgReturn,
    timeHorizon,
    currentAge,
    retirementAge,
    annualContribution,
    withdrawalRate,
  } = inputs;

  const wsYear =
    currentAge != null && retirementAge != null
      ? Math.max(1, retirementAge - currentAge + 1)
      : 1;
  const ceYear =
    currentAge != null && retirementAge != null
      ? wsYear - 1
      : Infinity;

  const yearBalances = Array.from({ length: timeHorizon }, () => []);
  const depletionYears = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const ret = generateNormalReturns(avgReturn, timeHorizon, currentAge ?? null, allocations);

    const data = simulatePortfolio({
      startingBalance,
      returns: ret,
      timeHorizon,
      withdrawalRate,
      annualContribution,
      withdrawalStartYear: wsYear,
      contributionEndYear: ceYear,
      withdrawalMin: inputs.withdrawalMin ?? 0,
      withdrawalMax: inputs.withdrawalMax ?? Infinity,
    });

    data.forEach((row, i) => yearBalances[i].push(row.endBalance));

    const final = data[data.length - 1]?.endBalance ?? 0;
    if (final <= 0) {
      const idx = data.findIndex((d) => d.endBalance <= 0);
      depletionYears.push(idx + 1);
    }
  }

  const successRate = (numSimulations - depletionYears.length) / numSimulations;

  const bands = yearBalances.map((col, i) => {
    const sorted = [...col].sort((a, b) => a - b);
    return {
      year: i + 1,
      p10: computePercentile(sorted, 0.1),
      p25: computePercentile(sorted, 0.25),
      p50: computePercentile(sorted, 0.5),
      p75: computePercentile(sorted, 0.75),
      p90: computePercentile(sorted, 0.9),
    };
  });

  const finalSorted = [...yearBalances[timeHorizon - 1]].sort((a, b) => a - b);
  const p10Final = computePercentile(finalSorted, 0.1);
  const p50Final = computePercentile(finalSorted, 0.5);
  const p90Final = computePercentile(finalSorted, 0.9);

  const worstDepletionYear =
    depletionYears.length > 0
      ? [...depletionYears].sort((a, b) => a - b)[Math.floor(depletionYears.length / 2)]
      : null;

  let suggestedRetirementAge = null;
  if (successRate < 0.95 && currentAge != null && retirementAge != null) {
    for (const delta of [3, 5, 7, 10]) {
      const cAge = retirementAge + delta;
      const cWsYear = Math.max(1, cAge - currentAge + 1);
      const cCeYear = cWsYear - 1;

      if (
        quickSuccessRate(
          { ...inputs, retirementAge: cAge },
          cWsYear,
          cCeYear,
          300,
          allocations
        ) >= 0.95
      ) {
        suggestedRetirementAge = cAge;
        break;
      }
    }
  }

  let suggestedAnnualContribution = null;
  if (successRate < 0.95) {
    suggestedAnnualContribution = binarySearchContribution(
      inputs,
      wsYear,
      ceYear,
      300,
      allocations
    );
  }

  let suggestedMaxWithdrawal = null;
  if (successRate < 0.95) {
    suggestedMaxWithdrawal = binarySearchMaxWithdrawal(
      inputs,
      wsYear,
      ceYear,
      300,
      allocations
    );
  }

  return {
    numSimulations,
    successRate,
    bands,
    medianFinalBalance: p50Final,
    p10FinalBalance: p10Final,
    p90FinalBalance: p90Final,
    suggestedRetirementAge,
    suggestedAnnualContribution,
    suggestedMaxWithdrawal,
    worstDepletionYear,
  };
}
