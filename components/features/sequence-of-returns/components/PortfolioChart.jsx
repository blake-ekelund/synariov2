import React, { useRef, useEffect, useState } from 'react'
import { formatCurrency, formatCurrencyFull } from '../utils/calculations'

export default function PortfolioChart({ data, startingBalance }) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 280 })
  const [hoveredIdx, setHoveredIdx] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setDims({ width: Math.max(400, width), height: 280 })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!data.length) return null

  const { width, height } = dims
  const padding = { top: 30, right: 24, bottom: 36, left: 70 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Build full dataset: add year 0 = starting balance
  const fullData = [{ year: 0, endBalance: startingBalance }, ...data]
  const values = fullData.map((d) => d.endBalance)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const valRange = maxVal - minVal || 1

  const xScale = (year) => padding.left + (year / (fullData.length - 1)) * chartW
  const yScale = (val) => padding.top + chartH - ((val - minVal) / valRange) * chartH

  // Build SVG path
  const pathD = fullData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.endBalance)}`)
    .join(' ')

  // Area fill path
  const areaD =
    pathD +
    ` L ${xScale(fullData.length - 1)} ${yScale(Math.max(minVal, 0))} L ${xScale(0)} ${yScale(Math.max(minVal, 0))} Z`

  // Grid lines (4 horizontal)
  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const val = minVal + (valRange / gridCount) * i
    return { val, y: yScale(val) }
  })

  // X-axis year labels
  const xLabels = fullData.filter((d, i) => {
    if (fullData.length <= 11) return true
    return i === 0 || i === fullData.length - 1 || i % Math.ceil(fullData.length / 10) === 0
  })

  const depleted = data[data.length - 1]?.endBalance <= 0

  return (
    <div ref={containerRef} style={{ width: '100%', userSelect: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ display: 'block' }}
        onMouseLeave={() => setHoveredIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const mouseX = e.clientX - rect.left - padding.left
          const idx = Math.round((mouseX / chartW) * (fullData.length - 1))
          setHoveredIdx(Math.max(0, Math.min(fullData.length - 1, idx)))
        }}
      >
        <defs>
          <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={depleted ? '#f75a5a' : '#4f8ef7'} stopOpacity={0.35} />
            <stop offset="100%" stopColor={depleted ? '#f75a5a' : '#4f8ef7'} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map(({ val, y }, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#2a2d3e"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#8b91a8" fontSize={10}>
              {formatCurrency(val)}
            </text>
          </g>
        ))}

        {/* Area */}
        <path d={areaD} fill="url(#portfolioGrad)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={depleted ? '#f75a5a' : '#4f8ef7'}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Starting balance reference line */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={yScale(startingBalance)}
          y2={yScale(startingBalance)}
          stroke="#4a5068"
          strokeWidth={1}
          strokeDasharray="5 3"
        />

        {/* X-axis labels */}
        {xLabels.map((d, i) => (
          <text
            key={d.year}
            x={xScale(fullData.indexOf(d))}
            y={height - 8}
            textAnchor="middle"
            fill="#8b91a8"
            fontSize={10}
          >
            {d.year === 0 ? 'Start' : `Yr ${d.year}`}
          </text>
        ))}

        {/* Hover crosshair + tooltip */}
        {hoveredIdx !== null && (
          <>
            <line
              x1={xScale(hoveredIdx)}
              x2={xScale(hoveredIdx)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#4a5068"
              strokeWidth={1}
              strokeDasharray="4 3"
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx={xScale(hoveredIdx)}
              cy={yScale(fullData[hoveredIdx].endBalance)}
              r={5}
              fill={depleted ? '#f75a5a' : '#4f8ef7'}
              style={{ pointerEvents: 'none' }}
            />
            {/* Tooltip box */}
            {(() => {
              const d = fullData[hoveredIdx]
              const tx = Math.min(xScale(hoveredIdx) + 10, width - padding.right - 120)
              const ty = Math.max(yScale(d.endBalance) - 50, padding.top)
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tx} y={ty} width={120} height={44} rx={6} fill="#1a1d27" stroke="#2e3348" strokeWidth={1} />
                  <text x={tx + 10} y={ty + 16} fill="#8b91a8" fontSize={10}>
                    {d.year === 0 ? 'Start' : `Year ${d.year}`}
                  </text>
                  <text x={tx + 10} y={ty + 34} fill="#e8eaf0" fontSize={12} fontWeight="600">
                    {formatCurrencyFull(d.endBalance)}
                  </text>
                </g>
              )
            })()}
          </>
        )}
      </svg>
    </div>
  )
}
