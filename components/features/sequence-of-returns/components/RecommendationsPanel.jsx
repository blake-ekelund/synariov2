import React from 'react'
import { formatCurrencyFull } from '../utils/calculations'

export default function RecommendationsPanel({ results, inputs, isStale = false, onApply, canAddScenario = true }) {
  if (!results) {
    return (
      <section className="card mc-panel">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="card-title">Monte Carlo Analysis</h2>
            <p className="card-subtitle" style={{ opacity: 0.5 }}>Computing 1,000 simulations…</p>
          </div>
        </div>
      </section>
    )
  }

  const {
    numSimulations,
    successRate,
    medianFinalBalance,
    p10FinalBalance,
    p90FinalBalance,
    suggestedRetirementAge,
    suggestedAnnualContribution,
    suggestedMaxWithdrawal,
    worstDepletionYear,
  } = results

  const pct = (successRate * 100).toFixed(1)
  const isGood = successRate >= 0.90
  const isWarn = successRate >= 0.70 && successRate < 0.90
  const rateColor = isGood ? 'var(--positive)' : isWarn ? '#f7a64f' : 'var(--negative)'

  // Show "optimized plan" when retirement age or contribution change is suggested
  const showOptimizedPlan = suggestedRetirementAge != null || suggestedAnnualContribution != null

  return (
    <section className="card mc-panel">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="card-title">
            Monte Carlo Analysis
            {isStale && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>updating…</span>}
          </h2>
          <p className="card-subtitle">
            {numSimulations.toLocaleString()} simulations · randomized return sequences
          </p>
        </div>
        {showOptimizedPlan && canAddScenario && onApply && (
          <button
            className="btn-ghost btn-ghost--active"
            style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
            onClick={() => onApply(
              {
                ...(suggestedRetirementAge != null ? { retirementAge: suggestedRetirementAge } : {}),
                ...(suggestedAnnualContribution != null ? { annualContribution: suggestedAnnualContribution } : {}),
              },
              `Optimized Plan`
            )}
          >
            + Try optimized plan
          </button>
        )}
      </div>

      <div className="mc-body">
        {/* ── Success rate indicator ── */}
        <div className="mc-success-block">
          <div className="mc-success-rate" style={{ color: rateColor }}>
            {pct}%
          </div>
          <div className="mc-success-label">
            of simulations end with money remaining
          </div>
          {successRate >= 0.95 && (
            <div className="mc-note mc-note--positive">
              Your plan survives the vast majority of market scenarios.
            </div>
          )}
          {isWarn && (
            <div className="mc-note mc-note--warn">
              Moderate risk of depletion. Consider adjustments.
            </div>
          )}
          {!isGood && !isWarn && (
            <div className="mc-note mc-note--negative">
              High risk of portfolio depletion. See recommendations below.
            </div>
          )}
        </div>

        {/* ── Insight tiles ── */}
        <div className="mc-insights-grid">
          <div className="mc-tile">
            <div className="mc-tile-label">Median Final Balance</div>
              <div
                className="mc-tile-value"
                style={{
                  color: medianFinalBalance <= 0 ? 'var(--negative)' : 'var(--text)'
                }}
              >
                {medianFinalBalance <= 0 ? 'Depleted' : formatCurrencyFull(medianFinalBalance)}
              </div>
            <div className="mc-tile-sub">50th percentile outcome</div>
          </div>

          <div className="mc-tile">
            <div className="mc-tile-label">Worst-Case Balance</div>
            <div className="mc-tile-value"
              style={{ color: p10FinalBalance <= 0 ? 'var(--negative)' : undefined }}>
              {p10FinalBalance <= 0 ? 'Depleted' : formatCurrencyFull(p10FinalBalance)}
            </div>
            <div className="mc-tile-sub">10th percentile · poor-market scenario</div>
          </div>

          {successRate >= 0.90 && (
            <div className="mc-tile">
              <div className="mc-tile-label">Best-Case Balance</div>
              <div className="mc-tile-value" style={{ color: 'var(--positive)' }}>
                {formatCurrencyFull(p90FinalBalance)}
              </div>
              <div className="mc-tile-sub">90th percentile · strong-market scenario</div>
            </div>
          )}

          {suggestedMaxWithdrawal != null && (
            <div className="mc-tile mc-tile--highlight">
              <div className="mc-tile-label">Suggested Spending Cap</div>
              <div className="mc-tile-value" style={{ color: '#f7a64f' }}>
                {formatCurrencyFull(suggestedMaxWithdrawal)}/yr
              </div>
              <div className="mc-tile-sub">
                max annual withdrawal to achieve 95% success
                {inputs.withdrawalMax != null && inputs.withdrawalMax < Infinity && (
                  <span style={{ color: 'var(--negative)' }}>
                    {' '}(currently {formatCurrencyFull(inputs.withdrawalMax)})
                  </span>
                )}
              </div>
              {canAddScenario && onApply && (
                <button
                  className="mc-apply-btn"
                  onClick={() => onApply(
                    { withdrawalMax: suggestedMaxWithdrawal },
                    `${formatCurrencyFull(suggestedMaxWithdrawal)} Cap`
                  )}
                >
                  → Try scenario
                </button>
              )}
            </div>
          )}

          {suggestedAnnualContribution != null && (
            <div className="mc-tile mc-tile--highlight">
              <div className="mc-tile-label">Suggested Contribution</div>
              <div className="mc-tile-value" style={{ color: 'var(--positive)' }}>
                {formatCurrencyFull(suggestedAnnualContribution)}/yr
              </div>
              <div className="mc-tile-sub">
                annual savings to achieve 95% success
                {inputs.annualContribution > 0 && (
                  <span style={{ color: 'var(--text2)' }}>
                    {' '}(currently {formatCurrencyFull(inputs.annualContribution)})
                  </span>
                )}
              </div>
              {canAddScenario && onApply && (
                <button
                  className="mc-apply-btn"
                  onClick={() => onApply(
                    { annualContribution: suggestedAnnualContribution },
                    `+${formatCurrencyFull(suggestedAnnualContribution - (inputs.annualContribution ?? 0))} Contrib`
                  )}
                >
                  → Try scenario
                </button>
              )}
            </div>
          )}

          {suggestedRetirementAge != null && (
            <div className="mc-tile mc-tile--highlight">
              <div className="mc-tile-label">Suggested Retirement Age</div>
              <div className="mc-tile-value" style={{ color: '#f7a64f' }}>
                {suggestedRetirementAge}
              </div>
              <div className="mc-tile-sub">
                +{suggestedRetirementAge - inputs.retirementAge} yrs achieves 95% success
              </div>
              {canAddScenario && onApply && (
                <button
                  className="mc-apply-btn"
                  onClick={() => onApply(
                    { retirementAge: suggestedRetirementAge },
                    `Retire at ${suggestedRetirementAge}`
                  )}
                >
                  → Try scenario
                </button>
              )}
            </div>
          )}

          {successRate < 1.0 && worstDepletionYear != null && (
            <div className="mc-tile">
              <div className="mc-tile-label">Median Depletion Year</div>
              <div className="mc-tile-value" style={{ color: 'var(--negative)' }}>
                Year {worstDepletionYear}
              </div>
              <div className="mc-tile-sub">
                {inputs.currentAge != null
                  ? `age ${inputs.currentAge + worstDepletionYear - 1} · `
                  : ''}
                median of failed simulations
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
