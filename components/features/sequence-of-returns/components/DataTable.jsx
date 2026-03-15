import React from 'react'
import { formatCurrencyFull, formatPercent } from '../utils/calculations'

export default function DataTable({ data, startingBalance }) {
  if (!data.length) return null
  const hasContributions = data.some(r => r.contribution > 0)
  const headers = hasContributions
    ? ['Year', 'Start Balance', 'Withdrawal', 'Contribution', 'Return %', 'Growth', 'End Balance']
    : ['Year', 'Start Balance', 'Withdrawal', 'Return %', 'Growth', 'End Balance']

  return (
    <div style={{ overflowX: 'auto', margin: '0 -2px' }}>
      <table style={S.table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} style={{ ...S.th, textAlign: i === 0 ? 'center' : 'right' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const depleted = row.endBalance <= 0
            const isEven = i % 2 === 0
            const baseBg = depleted
              ? 'rgba(247,90,90,0.07)'
              : isEven ? 'transparent' : 'rgba(255,255,255,0.025)'
            return (
              <tr
                key={row.year}
                style={{ ...S.tr, background: baseBg }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = baseBg }}
              >
                <td style={{ ...S.td, textAlign: 'center' }}>
                  <span style={{ ...S.yearBadge, opacity: depleted ? 0.5 : 1 }}>{row.year}</span>
                </td>

                <td style={{ ...S.td, color: 'var(--text2)' }}>
                  {formatCurrencyFull(row.startBalance)}
                </td>

                <td style={S.td}>
                  {row.withdrawal > 0
                    ? <span style={S.negative}>−{formatCurrencyFull(row.withdrawal)}</span>
                    : <span style={S.muted}>—</span>}
                </td>

                {hasContributions && (
                  <td style={S.td}>
                    {row.contribution > 0
                      ? <span style={S.positive}>+{formatCurrencyFull(row.contribution)}</span>
                      : <span style={S.muted}>—</span>}
                  </td>
                )}

                <td style={S.td}>
                  <span style={{
                    ...S.pill,
                    background: row.returnRate >= 0 ? 'rgba(62,207,142,0.12)' : 'rgba(247,90,90,0.12)',
                    color: row.returnRate >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {row.returnRate >= 0 ? '+' : ''}{formatPercent(row.returnRate)}
                  </span>
                </td>

                <td style={S.td}>
                  <span style={{ color: row.growth >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                    {row.growth >= 0 ? '+' : ''}{formatCurrencyFull(row.growth)}
                  </span>
                </td>

                <td style={{ ...S.td, fontWeight: 600 }}>
                  {depleted
                    ? <span style={S.depletedPill}>Depleted</span>
                    : <span style={{ color: '#e8eaf0' }}>{formatCurrencyFull(row.endBalance)}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const S = {
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 13,
  },
  th: {
    padding: '11px 16px',
    color: 'var(--text3, #4e5470)',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid var(--border)',
    borderTop: '1px solid var(--border)',
  },
  tr: {
    transition: 'background 0.1s',
  },
  td: {
    padding: '11px 16px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontSize: 13,
  },
  yearBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 6,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text2)',
    fontSize: 11,
    fontWeight: 600,
  },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 5,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.02em',
  },
  depletedPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 5,
    background: 'rgba(247,90,90,0.15)',
    color: 'var(--negative)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  positive: {
    color: 'var(--positive)',
  },
  negative: {
    color: 'var(--negative)',
  },
  muted: {
    color: 'var(--text3, #4e5470)',
  },
}
