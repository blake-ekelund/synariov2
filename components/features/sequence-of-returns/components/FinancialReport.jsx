import React from 'react'
import { formatCurrencyFull, formatPercent } from '../utils/calculations'

function buildOverview(inputs, portfolioData, mcResults) {
  const { startingBalance, currentAge, retirementAge, timeHorizon,
          annualContribution, withdrawalRate, withdrawalMin } = inputs
  const finalBalance = portfolioData[portfolioData.length - 1]?.endBalance ?? 0
  const depleted = finalBalance <= 0

  const agePart = currentAge != null
    ? ` from age ${currentAge} to ${currentAge + timeHorizon - 1}`
    : ''

  const retirePart = (currentAge != null && retirementAge != null)
    ? ` with a ${retirementAge - currentAge}-year accumulation phase and ${timeHorizon - (retirementAge - currentAge)}-year withdrawal phase`
    : ''

  const startPart = startingBalance > 0
    ? `Starting with ${formatCurrencyFull(startingBalance)}`
    : 'Starting from scratch'

  const contribPart = annualContribution > 0
    ? ` and contributing ${formatCurrencyFull(annualContribution)}/yr`
    : ''

  const endPart = depleted
    ? 'the portfolio is projected to deplete before the time horizon ends under average market conditions.'
    : `the plan projects an ending balance of ${formatCurrencyFull(finalBalance)} under average market conditions.`

  const successPart = mcResults
    ? ` Across 1,000 randomized market simulations, ${(mcResults.successRate * 100).toFixed(1)}% end with funds remaining.`
    : ''

  return `This plan spans ${timeHorizon} years${agePart}${retirePart}. ${startPart}${contribPart}, ${endPart}${successPart}`
}

function buildRisks(inputs, portfolioData, mcResults) {
  const risks = []
  if (!mcResults) return risks

  const { startingBalance, currentAge, retirementAge, timeHorizon,
          withdrawalRate, withdrawalMin, withdrawalMax } = inputs
  const { successRate, worstDepletionYear, p10FinalBalance } = mcResults

  const wsYear = (currentAge != null && retirementAge != null)
    ? Math.max(1, retirementAge - currentAge + 1) : 1
  const yearsToRetirement = (currentAge != null && retirementAge != null)
    ? retirementAge - currentAge : null
  const withdrawalYears = timeHorizon - (wsYear - 1)
  const effectiveSpend = Math.max(startingBalance * withdrawalRate, withdrawalMin ?? 0)

  // Depletion risk
  if (successRate < 0.70) {
    risks.push({
      severity: 'high',
      title: 'High Depletion Risk',
      body: `Only ${(successRate * 100).toFixed(0)}% of simulations end with funds intact. Under poor market conditions your portfolio is very likely to run out before your time horizon ends.`,
    })
  } else if (successRate < 0.90) {
    risks.push({
      severity: 'medium',
      title: 'Moderate Depletion Risk',
      body: `${(successRate * 100).toFixed(1)}% of simulations survive to year ${timeHorizon}${currentAge ? ` (age ${currentAge + timeHorizon - 1})` : ''}. There is a meaningful chance of running short in adverse market environments.`,
    })
  } else if (successRate < 0.95) {
    risks.push({
      severity: 'low',
      title: 'Marginal Depletion Risk',
      body: `${(successRate * 100).toFixed(1)}% success rate is good but leaves a ${(100 - successRate * 100).toFixed(1)}% chance of depletion. Small adjustments could close the gap to the 95% target.`,
    })
  }

  // Median depletion timing
  if (worstDepletionYear != null && successRate < 0.90) {
    const depletionAge = currentAge != null ? currentAge + worstDepletionYear - 1 : null
    risks.push({
      severity: successRate < 0.70 ? 'high' : 'medium',
      title: 'Median Depletion Year',
      body: `In failed simulations, the portfolio runs out around year ${worstDepletionYear}${depletionAge ? ` (age ${depletionAge})` : ''}. This represents roughly ${Math.round((1 - successRate) * 100)}% of projected lifetimes.`,
    })
  }

  // High withdrawal burden relative to retirement-start portfolio value
  const retirementStartIndex = Math.max(0, wsYear - 1)
  const retirementStartRow = portfolioData[retirementStartIndex]
  const retirementStartBalance =
    wsYear <= 1
      ? startingBalance
      : (retirementStartRow?.startBalance ?? startingBalance)

  if (effectiveSpend > 0 && retirementStartBalance > 0) {
    const burdenPct = effectiveSpend / retirementStartBalance

    if (burdenPct > 0.06) {
      risks.push({
        severity: 'high',
        title: 'Heavy Withdrawal Burden',
        body: `Your effective annual spend of ${formatCurrencyFull(effectiveSpend)} is ${(burdenPct * 100).toFixed(1)}% of your portfolio value at retirement (${formatCurrencyFull(retirementStartBalance)}) — well above the classic 4% guideline. In down years, forced liquidation at depressed prices compounds losses.`,
      })
    } else if (burdenPct > 0.04) {
      risks.push({
        severity: 'medium',
        title: 'Elevated Withdrawal Rate',
        body: `Your effective withdrawal of ${formatCurrencyFull(effectiveSpend)}/yr equals ${(burdenPct * 100).toFixed(1)}% of your portfolio value at retirement (${formatCurrencyFull(retirementStartBalance)}), which exceeds the classic 4% benchmark and leaves less room for prolonged downturns.`,
      })
    }
  }

  // Sequence of returns risk in early withdrawal years
  if (wsYear <= timeHorizon && withdrawalYears > 0) {
    const earlyYearRisk = wsYear <= 5
    if (earlyYearRisk && successRate < 0.95) {
      risks.push({
        severity: 'medium',
        title: 'Sequence-of-Returns Exposure',
        body: `Withdrawals begin in year ${wsYear}, making the first 5–7 retirement years the most critical. A bear market in that window forces selling shares at low prices, permanently reducing your portfolio's recovery potential.`,
      })
    }
  }

  // Short accumulation runway
  if (yearsToRetirement != null && yearsToRetirement < 8 && yearsToRetirement > 0) {
    risks.push({
      severity: 'medium',
      title: 'Limited Accumulation Runway',
      body: `With ${yearsToRetirement} years until retirement, there is limited time to grow the portfolio or recover from a market drawdown before withdrawals begin.`,
    })
  }

  // Worst-case balance risk
  if (p10FinalBalance <= 0 && successRate >= 0.70) {
    risks.push({
      severity: 'low',
      title: 'Tail Risk Exposure',
      body: `In the worst 10% of market scenarios your portfolio depletes entirely. While unlikely, extreme market downturns (depression-era or sustained stagflation) could exhaust funds.`,
    })
  }

  return risks
}

function buildOpportunities(inputs, portfolioData, mcResults) {
  const opps = []
  if (!mcResults) return opps

  const { startingBalance, currentAge, retirementAge, timeHorizon,
          annualContribution, withdrawalRate, withdrawalMin } = inputs
  const { successRate, medianFinalBalance, p90FinalBalance,
          suggestedRetirementAge, suggestedAnnualContribution } = mcResults

  const wsYear = (currentAge != null && retirementAge != null)
    ? Math.max(1, retirementAge - currentAge + 1) : 1
  const yearsToRetirement = (currentAge != null && retirementAge != null)
    ? retirementAge - currentAge : null

  // Strong plan
  if (successRate >= 0.95) {
    opps.push({
      title: 'Robust Plan Foundation',
      body: `A ${(successRate * 100).toFixed(1)}% success rate means your plan withstands the vast majority of historical and simulated market cycles, including crashes and prolonged downturns.`,
    })
  }

  // Long compounding runway
  if (yearsToRetirement != null && yearsToRetirement >= 12) {
    const contribTotal = annualContribution * yearsToRetirement
    opps.push({
      title: 'Compounding Growth Window',
      body: `${yearsToRetirement} years of pre-retirement growth gives your investments significant time to compound${annualContribution > 0 ? `, with ${formatCurrencyFull(contribTotal)} in total planned contributions alone` : ''}.`,
    })
  }

  // Contribution leverage
  if (annualContribution > 0 && yearsToRetirement != null && yearsToRetirement >= 5) {
    const approxGrowth = annualContribution * ((Math.pow(1 + (inputs.avgReturn ?? 0.07), yearsToRetirement) - 1) / (inputs.avgReturn ?? 0.07))
    opps.push({
      title: 'Contribution Leverage',
      body: `At your current return rate, ${formatCurrencyFull(annualContribution)}/yr invested over ${yearsToRetirement} years grows to approximately ${formatCurrencyFull(approxGrowth)} — a ${((approxGrowth / (annualContribution * yearsToRetirement) - 1) * 100).toFixed(0)}% gain over raw contributions through compounding.`,
    })
  }

  // Legacy wealth potential
  if (medianFinalBalance > startingBalance * 2 && successRate >= 0.85) {
    opps.push({
      title: 'Legacy Wealth Potential',
      body: `Your median projected ending balance of ${formatCurrencyFull(medianFinalBalance)} suggests meaningful wealth accumulation beyond your own needs — potential for estate planning, charitable giving, or generational transfer.`,
    })
  }

  // Spending flexibility
  if (successRate >= 0.95 && suggestedRetirementAge == null) {
    const effectiveSpend = Math.max(startingBalance * withdrawalRate, withdrawalMin ?? 0)
    opps.push({
      title: 'Spending Flexibility',
      body: `Your plan's strong success rate leaves room to increase discretionary spending${effectiveSpend > 0 ? ` above your current ${formatCurrencyFull(effectiveSpend)}/yr baseline` : ''} without meaningfully compromising long-term sustainability.`,
    })
  }

  // Best-case upside
  if (p90FinalBalance > medianFinalBalance * 1.5 && successRate >= 0.80) {
    opps.push({
      title: 'Strong Market Upside',
      body: `In the top 10% of market scenarios your portfolio ends at ${formatCurrencyFull(p90FinalBalance)} — nearly ${Math.round(p90FinalBalance / Math.max(1, medianFinalBalance))}× the median outcome — illustrating the upside from sustained strong market performance.`,
    })
  }

  // Suggested actions as opportunity
  if (suggestedAnnualContribution != null) {
    opps.push({
      title: 'Contribution Optimization',
      body: `Increasing annual contributions to ${formatCurrencyFull(suggestedAnnualContribution)}/yr (${formatCurrencyFull(suggestedAnnualContribution - (annualContribution ?? 0))} more than current) is projected to bring your success rate to 95%.`,
    })
  }

  return opps
}

const SEVERITY_COLOR = {
  high:   'var(--negative)',
  medium: '#f7a64f',
  low:    'var(--text2)',
}

export default function FinancialReport({ inputs, portfolioData, mcResults, scenarioName }) {
  if (!portfolioData?.length) return null

  const overview = buildOverview(inputs, portfolioData, mcResults)
  const risks = buildRisks(inputs, portfolioData, mcResults)
  const opps = buildOpportunities(inputs, portfolioData, mcResults)

  return (
    <section className="card report-card">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="card-title">Financial Plan Report</h2>
          <p className="card-subtitle">{scenarioName} · personalized analysis</p>
        </div>
      </div>

      <p className="report-overview">{overview}</p>

      <div className="report-columns">
        {/* Risks */}
        <div className="report-col">
          <div className="report-col-header report-col-header--risk">
            <span className="report-col-icon">⚠</span> Risks
          </div>
          {risks.length === 0 ? (
            <p className="report-empty">No significant risks identified for this plan.</p>
          ) : (
            risks.map((r, i) => (
              <div key={i} className="report-item">
                <div className="report-item-title" style={{ color: SEVERITY_COLOR[r.severity] }}>
                  {r.title}
                </div>
                <div className="report-item-body">{r.body}</div>
              </div>
            ))
          )}
        </div>

        {/* Opportunities */}
        <div className="report-col">
          <div className="report-col-header report-col-header--opp">
            <span className="report-col-icon">✦</span> Opportunities
          </div>
          {opps.length === 0 ? (
            <p className="report-empty">Run Monte Carlo analysis to surface opportunities.</p>
          ) : (
            opps.map((o, i) => (
              <div key={i} className="report-item">
                <div className="report-item-title" style={{ color: 'var(--positive)' }}>
                  {o.title}
                </div>
                <div className="report-item-body">{o.body}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {mcResults && (
        <div className="report-bottom-line">
          {mcResults.successRate >= 0.95
            ? `Bottom line: Your plan is on solid footing. Focus on maintaining discipline through market volatility and revisiting allocations as you approach retirement.`
            : mcResults.successRate >= 0.80
            ? `Bottom line: Your plan is viable but not fully stress-tested. Small adjustments to contributions, retirement age, or spending could meaningfully improve long-term resilience.`
            : `Bottom line: Your current plan carries significant risk of depletion. Consider the recommended adjustments above — even modest changes in multiple levers compound into dramatically better outcomes.`}
        </div>
      )}
    </section>
  )
}
