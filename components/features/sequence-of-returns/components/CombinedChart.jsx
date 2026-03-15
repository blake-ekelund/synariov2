import React, { useRef, useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatCurrencyFull } from '../utils/calculations'

// Return axis range
const MIN_RET = -0.5
const MAX_RET = 0.5
const RET_RANGE = MAX_RET - MIN_RET

// Layout (px)
const PORT_H = 200   // portfolio section height
const RET_H  = 100   // returns section height
const CF_H   = 70    // cash flow section height
const GAP    = 14    // gap between sections
const GAP2   = 10    // gap between returns and cashflow
const PAD    = { top: 20, right: 54, bottom: 28, left: 72 }
const TOTAL_H = PAD.top + PORT_H + GAP + RET_H + GAP2 + CF_H + PAD.bottom

// Derived section boundaries (constant)
const portTop = PAD.top
const portBot = PAD.top + PORT_H
const retTop  = portBot + GAP
const retBot  = retTop + RET_H
const cfTop   = retBot + GAP2
const cfBot   = cfTop + CF_H
const cfZero  = cfTop + CF_H / 2

// Subtle colors for allocation bands (semi-transparent)
const ALLOC_BAND_COLORS = [
  'rgba(79,142,247,0.06)',   // blue — Aggressive Growth
  'rgba(62,207,142,0.06)',   // green — Growth
  'rgba(247,166,79,0.06)',   // orange — Moderate Growth
  'rgba(201,122,247,0.06)',  // purple — Balanced
  'rgba(247,90,90,0.06)',    // red — Conservative
  'rgba(142,177,247,0.06)',  // light blue — Income
]
const ALLOC_LINE_COLORS = [
  '#4f8ef7','#3ecf8e','#f7a64f','#c97af7','#f75a5a','#8eb1f7',
]

export default function CombinedChart({ scenarios, activeId, onReturnChange, allocationPeriods = [], monteCarloBands = null }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const dragging = useRef(null)
  const [svgWidth, setSvgWidth] = useState(800)
  const [hoverYear, setHoverYear] = useState(null)
  const [retTooltip, setRetTooltip] = useState(null) // { index, value }

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setSvgWidth(Math.max(400, entries[0].contentRect.width))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const chartW = svgWidth - PAD.left - PAD.right

  // Active scenario
  const activeScenario = scenarios.find(s => s.id === activeId)
  const activeReturns  = activeScenario?.returns ?? []

  // X-axis: year 0 (start) → maxHorizon
  const maxHorizon = Math.max(
    ...scenarios.map(s => s.portfolioData.length),
    activeReturns.length, 1
  )
  const xScale = useCallback(
    (yearIdx) => PAD.left + (yearIdx / maxHorizon) * chartW,
    [chartW, maxHorizon]
  )

  // Portfolio Y-scale (top = high value)
  const allBalances = scenarios.flatMap(s => [
    s.inputs.startingBalance,
    ...s.portfolioData.map(d => d.endBalance),
  ])
  const maxBalance = Math.max(...allBalances, 1)
  const portY = useCallback(
    (val) => portBot - (Math.max(0, val) / maxBalance) * PORT_H,
    [maxBalance]
  )

  // Returns Y-scale (zero line at midpoint of returns section)
  const retY     = (val) => retTop + ((MAX_RET - val) / RET_RANGE) * RET_H
  const retZeroY = retY(0)

  // Bar geometry
  const barGap = chartW / Math.max(maxHorizon, 1)
  const barW   = Math.max(3, Math.min(26, barGap * 0.65))

  // Cash flow scale (active scenario only)
  const activeCFData = activeScenario?.portfolioData ?? []
  const maxCF = Math.max(...activeCFData.map(d => Math.max(d.contribution, d.withdrawal)), 1)
  const cfBarH = (val) => Math.min((val / maxCF) * (CF_H / 2), CF_H / 2)

  // SVG path helpers
  const buildLinePath = useCallback((scenario) => {
    const pts = [
      { i: 0, v: scenario.inputs.startingBalance },
      ...scenario.portfolioData.map((d, idx) => ({ i: idx + 1, v: d.endBalance })),
    ]
    return pts.map(({ i, v }, k) => `${k === 0 ? 'M' : 'L'} ${xScale(i)} ${portY(v)}`).join(' ')
  }, [xScale, portY])

  const buildAreaPath = useCallback((scenario) => {
    const line = buildLinePath(scenario)
    const n = scenario.portfolioData.length
    return `${line} L ${xScale(n)} ${portBot} L ${xScale(0)} ${portBot} Z`
  }, [buildLinePath, xScale])

  const buildBandPath = useCallback((lowerVals, upperVals) => {
    if (!lowerVals.length) return ''
    const fwd = upperVals.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(i + 1)} ${portY(v)}`
    ).join(' ')
    const back = [...lowerVals].reverse().map((v, i) =>
      `L ${xScale(lowerVals.length - i)} ${portY(v)}`
    ).join(' ')
    return `${fwd} ${back} Z`
  }, [xScale, portY])

  // ---- Drag / pointer logic ----
  const getSVGY = useCallback((clientY) => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? clientY - rect.top : 0
  }, [])

  const getSVGX = useCallback((clientX) => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? clientX - rect.left : 0
  }, [])

  const onPointerDown = useCallback((e, index) => {
    e.preventDefault()
    dragging.current = { index, startY: e.clientY, startVal: activeReturns[index] }
    svgRef.current?.setPointerCapture(e.pointerId)
  }, [activeReturns])

  const onPointerMove = useCallback((e) => {
    if (dragging.current) {
      const { index, startY, startVal } = dragging.current
      const deltaY = e.clientY - startY
      // px per unit return = RET_H / RET_RANGE  →  invert for drag
      const delta  = -deltaY / (RET_H / RET_RANGE)
      const newVal = Math.round(Math.max(MIN_RET, Math.min(MAX_RET, startVal + delta)) * 1000) / 1000
      const next = [...activeReturns]
      next[index] = newVal
      onReturnChange(next)
      setRetTooltip({ index, value: newVal })
      return
    }

    // Crosshair hover
    const x = getSVGX(e.clientX)
    if (x >= PAD.left && x <= PAD.left + chartW) {
      const yr = Math.round(((x - PAD.left) / chartW) * maxHorizon)
      setHoverYear(Math.max(0, Math.min(maxHorizon, yr)))
    } else {
      setHoverYear(null)
    }
  }, [activeReturns, onReturnChange, getSVGX, chartW, maxHorizon])

  const onPointerUp = useCallback((e) => {
    dragging.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
    setRetTooltip(null)
  }, [])

  // Grid values
  const portGridVals = Array.from({ length: 5 }, (_, i) => (maxBalance / 4) * (4 - i))
  const retGridVals  = [-0.4, -0.2, 0, 0.2, 0.4]

  // X-axis labels
  const step = maxHorizon <= 20 ? 1 : Math.ceil(maxHorizon / 10)
  const xLabels = Array.from({ length: maxHorizon + 1 }, (_, i) => i)
    .filter(i => i === 0 || i === maxHorizon || i % step === 0)

  return (
    <div ref={containerRef} style={{ width: '100%', userSelect: 'none' }}>
      {/* Legend — rendered as HTML below the chart */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 20px',
        padding: '4px 0 10px',
        marginLeft: PAD.left,
      }}>
        {scenarios.map(s => {
          const final   = s.portfolioData[s.portfolioData.length - 1]?.endBalance ?? 0
          const depleted = final <= 0
          const isActive = s.id === activeId
          return (
            <div key={s.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isActive ? 1 : 0.55,
            }}>
              <span style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: s.color,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 0 2px ${s.color}40` : 'none',
              }} />
              <span style={{
                color: isActive ? 'var(--text)' : 'var(--text2)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap',
              }}>
                {s.name}:&nbsp;
                <span style={{ color: depleted ? 'var(--negative)' : isActive ? 'var(--text)' : 'var(--text2)' }}>
                  {depleted ? 'Depleted' : formatCurrencyFull(final)}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={TOTAL_H}
        style={{ display: 'block' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseLeave={() => { setHoverYear(null); setRetTooltip(null) }}
      >
        <defs>
          {scenarios.map(s => (
            <linearGradient key={s.id} id={`cgrad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        {/* ═══════════════════════════════════
            ALLOCATION BANDS
        ═══════════════════════════════════ */}
        {allocationPeriods.map((p, i) => {
          const x1 = xScale(p.startYear - 1)
          const x2 = xScale(p.endYear)
          const bw = x2 - x1
          const colorIdx = i % ALLOC_BAND_COLORS.length
          const isLast = i === allocationPeriods.length - 1
          return (
            <g key={i}>
              {/* Band fill — spans both portfolio and returns sections */}
              <rect x={x1} y={portTop} width={bw} height={portBot - portTop + GAP + RET_H}
                fill={ALLOC_BAND_COLORS[colorIdx]} style={{ pointerEvents: 'none' }} />
              {/* Transition line (not on last period) */}
              {!isLast && (
                <line x1={x2} x2={x2} y1={portTop} y2={retBot}
                  stroke={ALLOC_LINE_COLORS[colorIdx]} strokeWidth={1}
                  strokeDasharray="4 3" opacity={0.5}
                  style={{ pointerEvents: 'none' }} />
              )}
              {/* Label at top of band */}
              {bw > 40 && (
                <text x={x1 + bw / 2} y={portTop + 12}
                  textAnchor="middle" fill={ALLOC_LINE_COLORS[colorIdx]}
                  fontSize={9} opacity={0.8}
                  style={{ pointerEvents: 'none' }}>
                  {p.allocation.label}
                </text>
              )}
              {/* Age label below band label */}
              {bw > 40 && (
                <text x={x1 + bw / 2} y={portTop + 22}
                  textAnchor="middle" fontSize={8}
                  style={{ pointerEvents: 'none', fill: 'var(--chart-label-dim)' }}>
                  Age {p.startAge}–{p.endAge}
                </text>
              )}
            </g>
          )
        })}

        {/* ═══════════════════════════════════
            PORTFOLIO SECTION
        ═══════════════════════════════════ */}

        {/* Horizontal grid + left y-axis labels */}
        {portGridVals.map((val, i) => {
          const y = portY(val)
          return (
            <g key={i}>
              <line x1={PAD.left} x2={svgWidth - PAD.right} y1={y} y2={y}
                strokeWidth={1} style={{ stroke: 'var(--chart-grid)' }} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10}
                style={{ fill: 'var(--chart-label)' }}>
                {formatCurrency(val)}
              </text>
            </g>
          )
        })}

        {/* ═══════════════════════════════════
            MONTE CARLO FAN CHART
        ═══════════════════════════════════ */}
        {monteCarloBands?.length > 0 && (() => {
          const p10s = monteCarloBands.map(b => b.p10)
          const p25s = monteCarloBands.map(b => b.p25)
          const p50s = monteCarloBands.map(b => b.p50)
          const p75s = monteCarloBands.map(b => b.p75)
          const p90s = monteCarloBands.map(b => b.p90)
          const medianPts = p50s.map((v, i) =>
            `${i === 0 ? 'M' : 'L'} ${xScale(i + 1)} ${portY(v)}`
          ).join(' ')
          return (
            <g style={{ pointerEvents: 'none' }}>
              <path d={buildBandPath(p10s, p90s)} fill="var(--accent)" fillOpacity={0.10} />
              <path d={buildBandPath(p25s, p75s)} fill="var(--accent)" fillOpacity={0.18} />
              <path d={medianPts} fill="none" stroke="var(--accent)"
                strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.65} />
            </g>
          )
        })()}

        {/* Area fill — active scenario only */}
        {activeScenario && (
          <path d={buildAreaPath(activeScenario)} fill={`url(#cgrad-${activeScenario.id})`} />
        )}

        {/* Lines — inactive scenarios (rendered first, behind active) */}
        {scenarios
          .filter(s => s.id !== activeId)
          .map(s => (
            <path key={s.id} d={buildLinePath(s)} fill="none"
              stroke={s.color} strokeWidth={1.5} strokeOpacity={0.5} strokeLinejoin="round" />
          ))}

        {/* Active scenario line */}
        {activeScenario && (
          <path d={buildLinePath(activeScenario)} fill="none"
            stroke={activeScenario.color} strokeWidth={2.5} strokeLinejoin="round" />
        )}

        {/* Hover crosshair in portfolio zone */}
        {hoverYear !== null && (
          <line x1={xScale(hoverYear)} x2={xScale(hoverYear)}
            y1={portTop} y2={portBot}
            strokeWidth={1} strokeDasharray="4 3"
            style={{ stroke: 'var(--chart-label-dim)', pointerEvents: 'none' }} />
        )}

        {/* Hover dot per scenario at hover year */}
        {hoverYear !== null && hoverYear > 0 && scenarios.map(s => {
          const d = s.portfolioData[hoverYear - 1]
          if (!d) return null
          return (
            <circle key={s.id}
              cx={xScale(hoverYear)} cy={portY(d.endBalance)}
              r={4} fill={s.color}
              style={{ pointerEvents: 'none' }} />
          )
        })}

        {/* Hover tooltip (right of crosshair) */}
        {hoverYear !== null && hoverYear > 0 && (() => {
          const lineH      = 17
          const activeRow  = activeCFData[hoverYear - 1]
          const returnRate = activeRow?.returnRate ?? null
          const contrib    = activeRow?.contribution ?? 0
          const withdrawal = activeRow?.withdrawal   ?? 0
          const hasCF      = contrib > 0 || withdrawal > 0
          const extraRows = activeRow ? 3 : 0
          const boxH       = 20 + scenarios.length * lineH + (extraRows > 0 ? 6 + extraRows * lineH : 0)
          const boxW       = 190
          let   tx         = xScale(hoverYear) + 10
          if (tx + boxW > svgWidth - PAD.right) tx = xScale(hoverYear) - boxW - 8
          const ty         = portTop + 4
          let   row        = 0

          const rowY = () => ty + 20 + (++row) * lineH

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={ty} width={boxW} height={boxH} rx={7} strokeWidth={1}
                style={{ fill: 'var(--chart-tooltip-bg)', stroke: 'var(--border)' }} />

              {/* Header */}
              {(() => {
                const currentAge = activeScenario?.inputs?.currentAge ?? null
                const ageLabel = currentAge != null && hoverYear > 0
                  ? `Age ${currentAge + hoverYear - 1} · Year ${hoverYear}`
                  : `Year ${hoverYear}`

                return (
                  <text
                    x={tx + 10}
                    y={ty + 14}
                    fontSize={10}
                    fontWeight={600}
                    style={{
                      fill: 'var(--text2)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {ageLabel}
                  </text>
                )
              })()}

              {[
                ...scenarios.filter((s) => s.id === activeId),
                ...scenarios.filter((s) => s.id !== activeId),
              ].map((s) => {
                const d = s.portfolioData[hoverYear - 1]
                const bal = d?.endBalance ?? 0
                const y = rowY()
                const isActive = s.id === activeId

                return (
                  <g key={s.id}>
                    <circle
                      cx={tx + 11}
                      cy={y - 4}
                      r={3.5}
                      fill={s.color}
                      opacity={isActive ? 1 : 0.6}
                    />

                    <text
                      x={tx + 20}
                      y={y}
                      fontSize={10}
                      fontWeight={isActive ? 600 : 400}
                      style={{
                        fill: isActive ? 'var(--text)' : 'var(--text2)',
                        opacity: isActive ? 1 : 0.8,
                      }}
                    >
                      {s.name}
                    </text>

                    <text
                      x={tx + boxW - 8}
                      y={y}
                      textAnchor="end"
                      fontSize={11}
                      fontWeight={isActive ? 700 : 500}
                      style={{
                        fill: bal <= 0
                          ? 'var(--negative)'
                          : isActive
                            ? 'var(--text)'
                            : 'var(--text2)',
                        opacity: isActive ? 1 : 0.85,
                      }}
                    >
                      {bal <= 0 ? 'Depleted' : formatCurrencyFull(bal)}
                    </text>
                  </g>
                )
              })}

              {/* Divider */}
              {extraRows > 0 && (
                <line x1={tx + 8} x2={tx + boxW - 8}
                  y1={ty + 20 + scenarios.length * lineH + 4}
                  y2={ty + 20 + scenarios.length * lineH + 4}
                  strokeWidth={1} style={{ stroke: 'var(--border)' }} />
              )}

              {(() => {
                const y1 = rowY()
                const y2 = rowY()
                const y3 = rowY()

                const growth = activeRow?.growth ?? 0
                const netImpact = growth + contrib - withdrawal

                const returnColor = growth >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)'
                const cashFlowLabel =
                  contrib > 0 ? 'Contribution' : withdrawal > 0 ? 'Withdrawal' : 'Cash Flow'
                const cashFlowValue =
                  contrib > 0
                    ? `+${formatCurrencyFull(contrib)}`
                    : withdrawal > 0
                      ? `−${formatCurrencyFull(withdrawal)}`
                      : '—'
                const cashFlowColor =
                  contrib > 0
                    ? 'var(--chart-positive)'
                    : withdrawal > 0
                      ? 'var(--chart-negative)'
                      : 'var(--text2)'

                const netColor =
                  netImpact >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)'

                return (
                  <g>
                    {/* Return */}
                    <text x={tx + 10} y={y1} fontSize={10} style={{ fill: 'var(--text2)' }}>
                      Return
                    </text>

                    <text
                      x={tx + boxW - 8}
                      y={y1}
                      textAnchor="end"
                      fontSize={11}
                      fontWeight={600}
                      style={{ fill: returnColor }}
                    >
                      {growth >= 0 ? '+' : '−'}{formatCurrencyFull(Math.abs(growth))}
                    </text>

                    {/* Contribution / Withdrawal */}
                    <text x={tx + 10} y={y2} fontSize={10} style={{ fill: 'var(--text2)' }}>
                      {cashFlowLabel}
                    </text>
                    <text
                      x={tx + boxW - 8}
                      y={y2}
                      textAnchor="end"
                      fontSize={11}
                      fontWeight={600}
                      style={{ fill: cashFlowColor }}
                    >
                      {cashFlowValue}
                    </text>

                    {/* Net Impact */}
                    <text x={tx + 10} y={y3} fontSize={10} style={{ fill: 'var(--text2)' }}>
                      Net Impact
                    </text>
                    <text
                      x={tx + boxW - 8}
                      y={y3}
                      textAnchor="end"
                      fontSize={11}
                      fontWeight={700}
                      style={{ fill: netColor }}
                    >
                      {netImpact >= 0 ? '+' : '−'}{formatCurrencyFull(Math.abs(netImpact))}
                    </text>
                  </g>
                )
              })()}
            </g>
          )
        })()}

        {/* ═══════════════════════════════════
            SECTION DIVIDER
        ═══════════════════════════════════ */}
        <line x1={PAD.left} x2={svgWidth - PAD.right}
          y1={portBot + GAP / 2} y2={portBot + GAP / 2}
          strokeWidth={1} style={{ stroke: 'var(--chart-divider)' }} />
        <text x={PAD.left + 2} y={portBot + GAP - 3} fontSize={9}
          style={{ fill: 'var(--chart-label-dim)' }}>
          Annual Returns — drag bars to adjust
        </text>

        {/* ═══════════════════════════════════
            RETURNS SECTION
        ═══════════════════════════════════ */}

        {/* Returns grid + right y-axis */}
        {retGridVals.map(val => {
          const y      = retY(val)
          const isZero = val === 0
          return (
            <g key={val}>
              <line x1={PAD.left} x2={svgWidth - PAD.right} y1={y} y2={y}
                strokeWidth={isZero ? 1.5 : 1}
                strokeDasharray={isZero ? '0' : '4 3'}
                style={{ stroke: isZero ? 'var(--chart-grid-zero)' : 'var(--chart-grid)' }} />
              <text x={svgWidth - PAD.right + 5} y={y + 4} fontSize={9}
                style={{ fill: 'var(--chart-label)' }}>
                {val >= 0 ? '+' : ''}{(val * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {/* Return bars — active scenario, draggable */}
        {activeReturns.map((ret, i) => {
          const cx     = xScale(i + 1)
          const isPos  = ret >= 0
          const bTop   = isPos ? retY(ret) : retZeroY
          const bBot   = isPos ? retZeroY  : retY(ret)
          const bh     = Math.max(2, bBot - bTop)
          const bx     = cx - barW / 2
          const fill   = isPos ? 'var(--chart-positive)' : 'var(--chart-negative)'
          const isHov  = retTooltip?.index === i
          return (
            <g key={i}>
              {/* Wide transparent hit area */}
              <rect
                x={cx - barGap / 2} y={retTop}
                width={barGap} height={RET_H}
                fill="transparent" style={{ cursor: 'ns-resize' }}
                onPointerDown={(e) => onPointerDown(e, i)}
                onMouseEnter={() => !dragging.current && setRetTooltip({ index: i, value: ret })}
                onMouseLeave={() => !dragging.current && setRetTooltip(null)}
              />
              {/* Bar */}
              <rect x={bx} y={bTop} width={barW} height={bh}
                rx={2} opacity={isHov ? 0.92 : 0.68}
                style={{ fill, pointerEvents: 'none' }} />
              {/* Handle dot */}
              <circle cx={cx} cy={isPos ? bTop : bBot}
                r={isHov ? 4 : 2.5}
                style={{ fill, pointerEvents: 'none' }} />
            </g>
          )
        })}

        {/* Returns crosshair extension */}
        {hoverYear !== null && hoverYear > 0 && (
          <line x1={xScale(hoverYear)} x2={xScale(hoverYear)}
            y1={retTop} y2={retBot}
            strokeWidth={1} strokeDasharray="4 3"
            style={{ stroke: 'var(--chart-label-dim)', pointerEvents: 'none' }} />
        )}

        {/* Drag / hover tooltip for returns */}
        {retTooltip && (() => {
          const cx   = xScale(retTooltip.index + 1)
          const val  = retTooltip.value
          const boxW = 72
          const tx   = Math.min(Math.max(cx - boxW / 2, PAD.left), svgWidth - PAD.right - boxW)
          const ty   = val >= 0 ? retY(val) - 28 : retZeroY + 6
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={ty} width={boxW} height={22}
                rx={4} strokeWidth={1}
                style={{ fill: 'var(--chart-tooltip-bg)', stroke: 'var(--accent)' }} />
              <text x={tx + boxW / 2} y={ty + 15}
                textAnchor="middle" fontSize={11} fontWeight={600}
                style={{ fill: 'var(--text)' }}>
                {val >= 0 ? '+' : ''}{(val * 100).toFixed(2)}%
              </text>
            </g>
          )
        })()}

        {/* ═══════════════════════════════════
            X-AXIS
        ═══════════════════════════════════ */}
        {xLabels.map(i => (
          <text key={i} x={xScale(i)} y={retBot + 18}
            textAnchor="middle" fontSize={10}
            style={{ fill: 'var(--chart-label)' }}>
            {i === 0 ? 'Start' : i}
          </text>
        ))}

        {/* ═══════════════════════════════════
            CASH FLOW SECTION
        ═══════════════════════════════════ */}
        <line x1={PAD.left} x2={svgWidth - PAD.right}
          y1={cfTop - GAP2 / 2} y2={cfTop - GAP2 / 2}
          strokeWidth={1} style={{ stroke: 'var(--chart-divider)' }} />
        <text x={PAD.left + 2} y={cfTop - 2} fontSize={9}
          style={{ fill: 'var(--chart-label-dim)' }}>
          Cash Flow — contributions &amp; withdrawals
        </text>
        <line x1={PAD.left} x2={svgWidth - PAD.right}
          y1={cfZero} y2={cfZero}
          strokeWidth={1} style={{ stroke: 'var(--chart-grid-zero)' }} />
        <text x={PAD.left - 6} y={cfZero - 4}
          textAnchor="end" fontSize={8}
          style={{ fill: 'var(--chart-positive)' }}>
          +{formatCurrency(maxCF)}
        </text>
        <text x={PAD.left - 6} y={cfZero + 12}
          textAnchor="end" fontSize={8}
          style={{ fill: 'var(--chart-negative)' }}>
          −{formatCurrency(maxCF)}
        </text>
        {activeCFData.map((d, i) => {
          const cx = xScale(i + 1)
          const bx = cx - barW / 2
          if (d.contribution > 0) {
            const bh = cfBarH(d.contribution)
            return <rect key={i} x={bx} y={cfZero - bh} width={barW} height={bh}
              rx={1} opacity={0.72}
              style={{ fill: 'var(--chart-positive)', pointerEvents: 'none' }} />
          }
          if (d.withdrawal > 0) {
            const bh = cfBarH(d.withdrawal)
            return <rect key={i} x={bx} y={cfZero} width={barW} height={bh}
              rx={1} opacity={0.72}
              style={{ fill: 'var(--chart-negative)', pointerEvents: 'none' }} />
          }
          return null
        })}
        {hoverYear !== null && hoverYear > 0 && (
          <line x1={xScale(hoverYear)} x2={xScale(hoverYear)}
            y1={cfTop} y2={cfBot}
            strokeWidth={1} strokeDasharray="4 3"
            style={{ stroke: 'var(--chart-label-dim)', pointerEvents: 'none' }} />
        )}

        {/* Shared left border */}
        <line x1={PAD.left} x2={PAD.left}
          y1={portTop} y2={cfBot}
          strokeWidth={1} style={{ stroke: 'var(--chart-border)' }} />

        {/* Portfolio Value y-axis rotated label */}
        <text
          x={12} y={portTop + PORT_H / 2}
          textAnchor="middle" fontSize={10}
          transform={`rotate(-90,12,${portTop + PORT_H / 2})`}
          style={{ fill: 'var(--chart-label)' }}>
          Portfolio Value
        </text>
      </svg>
    </div>
  )
}
