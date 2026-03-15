import React, { useRef, useCallback, useEffect, useState } from 'react'

const MIN_RETURN = -0.5   // -50%
const MAX_RETURN = 0.5    // +50%
const RANGE = MAX_RETURN - MIN_RETURN

// How many px of vertical drag equals 1% return change
const PX_PER_PCT = 3

export default function DraggableReturnChart({ returns, onChange, avgReturn }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const dragging = useRef(null) // { index, startY, startValue }
  const [tooltip, setTooltip] = useState(null) // { index, x, y, value }
  const [hoveredBar, setHoveredBar] = useState(null)

  const count = returns.length
  const padding = { top: 40, right: 20, bottom: 36, left: 52 }

  // Derive SVG dimensions from container
  const [dims, setDims] = useState({ width: 800, height: 240 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setDims({ width: Math.max(400, width), height: 240 })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { width, height } = dims
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const barWidth = Math.max(4, Math.min(40, chartW / count - 2))
  const barGap = chartW / count

  // Y position from return value
  const yFromValue = useCallback(
    (val) => {
      const ratio = (MAX_RETURN - val) / RANGE
      return padding.top + ratio * chartH
    },
    [chartH, padding.top]
  )

  // Return value from Y position
  const valueFromY = useCallback(
    (y) => {
      const ratio = (y - padding.top) / chartH
      return MAX_RETURN - ratio * RANGE
    },
    [chartH, padding.top]
  )

  const zeroY = yFromValue(0)
  const avgY = yFromValue(avgReturn)

  // ---- Drag logic ----
  const getSVGY = useCallback((clientY) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    return clientY - rect.top
  }, [])

  const onPointerDown = useCallback(
    (e, index) => {
      e.preventDefault()
      dragging.current = {
        index,
        startY: e.clientY,
        startValue: returns[index],
      }
      svgRef.current?.setPointerCapture(e.pointerId)
    },
    [returns]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) {
        // Just update hover tooltip
        return
      }
      const { index, startY, startValue } = dragging.current
      const deltaY = e.clientY - startY
      // Each PX_PER_PCT pixels = 1% change
      const delta = -deltaY / PX_PER_PCT / 100
      const newVal = Math.round(Math.max(MIN_RETURN, Math.min(MAX_RETURN, startValue + delta)) * 1000) / 1000
      const newReturns = [...returns]
      newReturns[index] = newVal
      onChange(newReturns)

      const svgY = getSVGY(e.clientY)
      setTooltip({ index, x: padding.left + index * barGap + barGap / 2, y: svgY - 10, value: newVal })
    },
    [returns, onChange, getSVGY, padding.left, barGap]
  )

  const onPointerUp = useCallback((e) => {
    dragging.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
    setTooltip(null)
  }, [])

  const onBarMouseEnter = useCallback((index, e) => {
    if (dragging.current) return
    setHoveredBar(index)
    const svgY = getSVGY(e.clientY)
    setTooltip({ index, x: padding.left + index * barGap + barGap / 2, y: yFromValue(returns[index]) - 14, value: returns[index] })
  }, [getSVGY, padding.left, barGap, yFromValue, returns])

  const onBarMouseLeave = useCallback(() => {
    if (dragging.current) return
    setHoveredBar(null)
    setTooltip(null)
  }, [])

  // Y grid lines at -40%, -20%, 0%, 20%, 40%
  const gridLines = [-0.4, -0.2, 0, 0.2, 0.4]

  return (
    <div ref={containerRef} style={{ width: '100%', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ cursor: dragging.current ? 'ns-resize' : 'default', display: 'block' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Grid lines */}
        {gridLines.map((val) => {
          const y = yFromValue(val)
          const isZero = val === 0
          return (
            <g key={val}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke={isZero ? '#4a5068' : '#2a2d3e'}
                strokeWidth={isZero ? 1.5 : 1}
                strokeDasharray={isZero ? '0' : '4 3'}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#8b91a8"
                fontSize={10}
              >
                {val >= 0 ? '+' : ''}{(val * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {/* Average return line */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={avgY}
          y2={avgY}
          stroke="#4f8ef7"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          opacity={0.6}
        />
        <text x={width - padding.right + 4} y={avgY + 4} fill="#4f8ef7" fontSize={9} opacity={0.8}>
          avg
        </text>

        {/* Bars */}
        {returns.map((ret, i) => {
          const x = padding.left + i * barGap + (barGap - barWidth) / 2
          const isPositive = ret >= 0
          const barTop = isPositive ? yFromValue(ret) : zeroY
          const barBottom = isPositive ? zeroY : yFromValue(ret)
          const barH = Math.max(2, barBottom - barTop)
          const isHovered = hoveredBar === i
          const isDragging = dragging.current?.index === i

          const fill = isPositive
            ? isDragging || isHovered ? '#5bf5a8' : '#3ecf8e'
            : isDragging || isHovered ? '#ff7070' : '#f75a5a'

          return (
            <g key={i}>
              {/* Hit area — wider than visual bar for easier grabbing */}
              <rect
                x={padding.left + i * barGap}
                y={padding.top}
                width={barGap}
                height={chartH}
                fill="transparent"
                style={{ cursor: 'ns-resize' }}
                onPointerDown={(e) => onPointerDown(e, i)}
                onMouseEnter={(e) => onBarMouseEnter(i, e)}
                onMouseLeave={onBarMouseLeave}
              />
              {/* Visual bar */}
              <rect
                x={x}
                y={barTop}
                width={barWidth}
                height={barH}
                rx={3}
                fill={fill}
                opacity={isDragging ? 1 : isHovered ? 0.95 : 0.85}
                style={{ pointerEvents: 'none' }}
              />
              {/* Drag handle dot */}
              <circle
                cx={x + barWidth / 2}
                cy={barTop - (isPositive ? 4 : -4) + (isPositive ? 0 : barH)}
                r={isDragging || isHovered ? 5 : 3}
                fill={fill}
                style={{ pointerEvents: 'none' }}
              />
              {/* Year label */}
              {(count <= 30 || i % 5 === 0 || i === count - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fill="#8b91a8"
                  fontSize={9}
                >
                  {i + 1}
                </text>
              )}
            </g>
          )
        })}

        {/* Tooltip */}
        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={Math.min(tooltip.x - 28, width - padding.right - 56)}
              y={Math.max(tooltip.y - 22, padding.top - 2)}
              width={56}
              height={22}
              rx={5}
              fill="#1a1d27"
              stroke="#4f8ef7"
              strokeWidth={1}
            />
            <text
              x={Math.min(tooltip.x, width - padding.right - 28)}
              y={Math.max(tooltip.y - 6, padding.top + 12)}
              textAnchor="middle"
              fill="#e8eaf0"
              fontSize={11}
              fontWeight="600"
            >
              Yr {tooltip.index + 1}: {tooltip.value >= 0 ? '+' : ''}{(tooltip.value * 100).toFixed(1)}%
            </text>
          </g>
        )}

        {/* X axis label */}
        <text
          x={padding.left + chartW / 2}
          y={height - 2}
          textAnchor="middle"
          fill="#8b91a8"
          fontSize={10}
        >
          Year
        </text>

        {/* Title */}
        <text x={padding.left} y={20} fill="#8b91a8" fontSize={11} fontWeight={500}>
          Drag bars to adjust annual return %
        </text>
      </svg>
    </div>
  )
}
