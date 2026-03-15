import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatPercent, ALLOCATIONS } from "../utils/calculations";

function stdDevColor(sd) {
  if (sd <= 0.09) return "#3ecf8e";
  if (sd <= 0.12) return "#f7c94f";
  if (sd <= 0.145) return "#f7a64f";
  return "#f75a5a";
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function interpolateMetrics(stocksPct) {
  const sorted = [...ALLOCATIONS].sort((a, b) => a.stocks - b.stocks);
  const target = clamp(stocksPct, 0, 100);

  if (target <= sorted[0].stocks) {
    return {
      expectedReturn: sorted[0].expectedReturn,
      stdDev: sorted[0].stdDev,
    };
  }

  if (target >= sorted[sorted.length - 1].stocks) {
    return {
      expectedReturn: sorted[sorted.length - 1].expectedReturn,
      stdDev: sorted[sorted.length - 1].stdDev,
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const low = sorted[i];
    const high = sorted[i + 1];

    if (target >= low.stocks && target <= high.stocks) {
      const range = high.stocks - low.stocks || 1;
      const t = (target - low.stocks) / range;

      return {
        expectedReturn:
          low.expectedReturn + (high.expectedReturn - low.expectedReturn) * t,
        stdDev: low.stdDev + (high.stdDev - low.stdDev) * t,
      };
    }
  }

  return {
    expectedReturn: 0.07,
    stdDev: 0.12,
  };
}

function buildEditableAllocations(base) {
  return base.map((row) => ({
    ...row,
    bonds: 100 - row.stocks,
  }));
}

function InfoTip({ text }) {
  return (
    <span className="tooltip-wrap" style={{ marginLeft: 6 }}>
      <span className="tooltip-icon">ⓘ</span>
      <span role="tooltip" className="tooltip-box">
        {text}
      </span>
    </span>
  );
}

export default function AssetAllocationGuide({
  currentAge,
  allocations,
  onChangeAllocations,
}) {
  const [localAllocations, setLocalAllocations] = useState(() =>
    buildEditableAllocations(allocations?.length ? allocations : ALLOCATIONS)
  );

  useEffect(() => {
    setLocalAllocations(
      buildEditableAllocations(allocations?.length ? allocations : ALLOCATIONS)
    );
  }, [allocations]);

  const currentIdx = useMemo(() => {
    if (currentAge == null) return null;
    return localAllocations.findIndex(
      (row) => currentAge >= row.ageMin && currentAge <= row.ageMax
    );
  }, [currentAge, localAllocations]);

  function updateRow(index, nextStocksRaw) {
    const stocks = clamp(Number(nextStocksRaw), 0, 100);
    const bonds = 100 - stocks;
    const { expectedReturn, stdDev } = interpolateMetrics(stocks);

    const next = localAllocations.map((row, i) =>
      i === index
        ? {
            ...row,
            stocks,
            bonds,
            expectedReturn,
            stdDev,
          }
        : row
    );

    setLocalAllocations(next);
    onChangeAllocations?.(next);
  }

  function resetDefaults() {
    const reset = buildEditableAllocations(ALLOCATIONS);
    setLocalAllocations(reset);
    onChangeAllocations?.(reset);
  }

  const isDefault =
    JSON.stringify(localAllocations.map(({ stocks }) => stocks)) ===
    JSON.stringify(ALLOCATIONS.map(({ stocks }) => stocks));

  return (
    <section className="card alloc-card">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="card-title">Asset Allocation by Life Stage</h2>
          <p className="card-subtitle">
            Adjust stock/bond mix for each age group. Expected return and
            volatility update automatically for every stage.
          </p>
        </div>

        <button
          className="btn-ghost"
          onClick={resetDefaults}
          disabled={isDefault}
          style={{ whiteSpace: "nowrap", opacity: isDefault ? 0.5 : 1 }}
        >
          Reset Defaults
        </button>
      </div>

      <div className="alloc-table-wrap">
        <table className="alloc-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Typical Age</th>
              <th style={{ width: 240 }}>Allocation</th>

              <th className="alloc-th-right">
                <span className="alloc-th-label">
                  Stocks
                  <InfoTip text="The percentage of the portfolio invested in equities. Higher stock allocation generally increases both expected return and volatility." />
                </span>
              </th>

              <th className="alloc-th-right">
                <span className="alloc-th-label">
                  Bonds
                  <InfoTip text="The percentage of the portfolio invested in fixed income. Higher bond allocation generally lowers expected return and reduces volatility." />
                </span>
              </th>

              <th className="alloc-th-right">
                <span className="alloc-th-label">
                  Exp. Return
                  <InfoTip text="The estimated annual return for that allocation mix, based on interpolated historical assumptions." />
                </span>
              </th>

              <th className="alloc-th-right">
                <span className="alloc-th-label">
                  Std Dev
                  <InfoTip text="Standard deviation measures annual volatility. Higher values mean returns tend to swing more widely from year to year." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {localAllocations.map((row, i) => {
              const isCurrent = i === currentIdx;

              return (
                <tr
                  key={`${row.ageMin}-${row.ageMax}-${row.label}`}
                  className={`alloc-row ${isCurrent ? "alloc-active" : ""}`}
                >
                  <td className="alloc-label">
                    {row.label}
                    {isCurrent && (
                      <span className="alloc-current-badge">current age</span>
                    )}
                  </td>

                  <td className="alloc-age">
                    {row.ageMin === 70 ? "70+" : `${row.ageMin}–${row.ageMax}`}
                  </td>

                  <td>
                    <DraggableAllocBar
                      stocks={row.stocks}
                      onChange={(nextStocks) => updateRow(i, nextStocks)}
                    />
                  </td>

                  <td className="alloc-pct alloc-stocks alloc-td-right">
                    {row.stocks}%
                  </td>

                  <td className="alloc-pct alloc-bonds alloc-td-right">
                    {row.bonds}%
                  </td>

                  <td className="alloc-return alloc-td-right">
                    +{formatPercent(row.expectedReturn)}
                  </td>

                  <td className="alloc-td-right">
                    <span
                      className="alloc-stddev"
                      style={{ color: stdDevColor(row.stdDev) }}
                    >
                      ±{formatPercent(row.stdDev)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="alloc-footnote">
        * Based on historical US market data (1926–2023). Past performance does
        not guarantee future results. Expected returns are nominal annualized
        figures. Standard deviation reflects annual portfolio volatility.
      </p>
    </section>
  );
}

function DraggableAllocBar({ stocks, onChange }) {
  const barRef = useRef(null);
  const draggingRef = useRef(false);

  function updateFromClientX(clientX) {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pct = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    onChange(Math.round(pct));
  }

  function handlePointerDown(e) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }

  function handlePointerUp(e) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      ref={barRef}
      className="alloc-bar alloc-bar--interactive"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={`${stocks}% stocks / ${100 - stocks}% bonds`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={stocks}
      aria-label="Stock allocation"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(clamp(stocks - 1, 0, 100));
        if (e.key === "ArrowRight") onChange(clamp(stocks + 1, 0, 100));
        if (e.key === "Home") onChange(0);
        if (e.key === "End") onChange(100);
      }}
    >
      <div className="alloc-bar-stocks" style={{ width: `${stocks}%` }} />
      <div className="alloc-bar-bonds" style={{ width: `${100 - stocks}%` }} />
      <div
        className="alloc-bar-handle"
        style={{ left: `${stocks}%` }}
        aria-hidden="true"
      />
    </div>
  );
}
