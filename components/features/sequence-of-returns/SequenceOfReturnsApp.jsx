"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import CombinedChart from "./components/CombinedChart";
import DataTable from "./components/DataTable";
import ScenarioTabs from "./components/ScenarioTabs";
import AssetAllocationGuide from "./components/AssetAllocationGuide";
import RecommendationsPanel from "./components/RecommendationsPanel";
import FinancialReport from "./components/FinancialReport";
import {
  simulatePortfolio,
  generateReturns,
  generateNormalReturns,
  generateAgeBasedReturns,
  computeAllocationPeriods,
  weightedAvgReturn,
  blendWithBonds,
  PRESET_SCENARIOS,
  ALLOCATIONS,
  formatCurrencyFull,
  formatPercent,
  runMonteCarloAnalysis,
} from "./utils/calculations";
import "./index.css";
import "./App.css";

const SCENARIO_COLORS = ["#4f8ef7", "#3ecf8e", "#f7a64f", "#c97af7", "#f75a5a"];

const DEFAULT_INPUTS = {
  startingBalance: 1_000_000,
  avgReturn: 0.07,
  timeHorizon: 30,
  currentAge: null,
  retirementAge: null,
  annualContribution: 0,
  withdrawalRate: 0.04,
  withdrawalMin: null,
  withdrawalMax: null,
};

function parseNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function makeScenario(id, name, color, inputs, returns) {
  return { id, name, color, inputs: { ...inputs }, returns: [...returns] };
}

let _uid = 2;

function getNextScenarioColor(existingScenarios) {
  const usedColors = new Set(existingScenarios.map((s) => s.color));
  return (
    SCENARIO_COLORS.find((color) => !usedColors.has(color)) ??
    SCENARIO_COLORS[existingScenarios.length % SCENARIO_COLORS.length]
  );
}

export default function App() {
  const [scenarios, setScenarios] = useState(() => [
    makeScenario(
      "s1",
      "Base Case",
      SCENARIO_COLORS[0],
      DEFAULT_INPUTS,
      generateReturns(DEFAULT_INPUTS.avgReturn, DEFAULT_INPUTS.timeHorizon)
    ),
  ]);
  const [activeId, setActiveId] = useState("s1");
  const [viewMode, setViewMode] = useState("chart");
  const [showBands, setShowBands] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [allocations, setAllocations] = useState(() =>
    ALLOCATIONS.map((row) => ({
      ...row,
      bonds: row.bonds ?? 100 - row.stocks,
    }))
  );  

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const updateActive = useCallback(
    (updaterFn) => {
      setScenarios((prev) =>
        prev.map((s) => (s.id === activeId ? updaterFn(s) : s))
      );
    },
    [activeId]
  );

  const handleInputChange = useCallback(
    (key, rawValue) => {
      updateActive((s) => {
        const next = { ...s, inputs: { ...s.inputs, [key]: rawValue } };

        if (key === "withdrawalRate") {
          next.inputs.withdrawalRate = Math.max(0.01, rawValue ?? 0.01);
        }

        if (key === "timeHorizon") {
          const n = Math.max(1, Math.min(100, Math.round(parseNum(rawValue))));
          next.inputs.timeHorizon = n;
          const age = s.inputs.currentAge;
          if (age != null) {
            next.returns = generateAgeBasedReturns(age, n, false, allocations);
            next.inputs.avgReturn = weightedAvgReturn(age, n, allocations);
          } else if (n > s.returns.length) {
            next.returns = [
              ...s.returns,
              ...generateReturns(s.inputs.avgReturn, n - s.returns.length),
            ];
          } else {
            next.returns = s.returns.slice(0, n);
          }
        }

        if (key === "currentAge") {
          const age =
            rawValue === "" || rawValue == null
              ? null
              : Math.max(1, Math.min(100, Math.round(parseNum(rawValue))));
          next.inputs.currentAge = age;
          if (age != null) {
            const retAge = s.inputs.retirementAge;
            if (retAge != null && retAge > age) {
              const minHorizon = retAge - age + 20;
              if (s.inputs.timeHorizon < minHorizon) {
                next.inputs.timeHorizon = minHorizon;
                next.returns = generateAgeBasedReturns(age, minHorizon, false, allocations);
                next.inputs.avgReturn = weightedAvgReturn(age, minHorizon, allocations);
              } else {
                next.returns = generateAgeBasedReturns(
                  age,
                  s.inputs.timeHorizon,
                  false,
                  allocations
                );
                next.inputs.avgReturn = weightedAvgReturn(
                  age,
                  s.inputs.timeHorizon,
                  allocations
                );
              }
            } else {
              next.returns = generateAgeBasedReturns(
                age,
                s.inputs.timeHorizon,
                false,
                allocations
              );
              next.inputs.avgReturn = weightedAvgReturn(
                age,
                s.inputs.timeHorizon,
                allocations
              );
            }
          }
        }

        if (key === "retirementAge") {
          const retAge =
            rawValue === "" || rawValue == null
              ? null
              : Math.max(1, Math.min(120, Math.round(parseNum(rawValue))));
          next.inputs.retirementAge = retAge;
          const curAge = s.inputs.currentAge;
          if (retAge != null && curAge != null && retAge > curAge) {
            const minHorizon = retAge - curAge + 20;
            if (s.inputs.timeHorizon < minHorizon) {
              next.inputs.timeHorizon = minHorizon;
              next.returns = generateAgeBasedReturns(curAge, minHorizon, false, allocations);
              next.inputs.avgReturn = weightedAvgReturn(curAge, minHorizon, allocations);
            }
          }
        }

        return next;
      });
    },
    [updateActive, allocations]
  );

  const handleReturnChange = useCallback(
    (newReturns) => {
      updateActive((s) => ({ ...s, returns: newReturns }));
    },
    [updateActive]
  );

  const handleResetReturns = useCallback(() => {
    updateActive((s) => {
      const age = s.inputs.currentAge;
      if (age != null) {
        const returns = generateAgeBasedReturns(age, s.inputs.timeHorizon, false, allocations);
        const avg = weightedAvgReturn(age, s.inputs.timeHorizon, allocations);
        return { ...s, returns, inputs: { ...s.inputs, avgReturn: avg } };
      }
      return {
        ...s,
        returns: generateReturns(s.inputs.avgReturn, s.inputs.timeHorizon),
      };
    });
  }, [updateActive, allocations]);

  const handleRandomizeReturns = useCallback(() => {
    updateActive((s) => {
      const age = s.inputs.currentAge;
      const returns = generateNormalReturns(
        s.inputs.avgReturn,
        s.inputs.timeHorizon,
        age,
        allocations
      );
      return { ...s, returns };
    });
  }, [updateActive, allocations]);

  const handleLoadPreset = useCallback(
    (preset) => {
      updateActive((s) => {
        const age = s.inputs.currentAge;
        const returns =
          age != null ? blendWithBonds(preset.returns, age, allocations) : preset.returns;
        const n = returns.length;
        const avg = returns.reduce((sum, r) => sum + r, 0) / n;
        return {
          ...s,
          returns,
          inputs: { ...s.inputs, avgReturn: avg, timeHorizon: n },
        };
      });
    }, 
    [updateActive, allocations]
  );

  const handleAddScenario = useCallback(() => {
    const id = `s${_uid++}`;

    setScenarios((prev) => {
      if (prev.length >= 5) return prev;

      const src = prev.find((s) => s.id === activeId) ?? prev[0];
      const color = getNextScenarioColor(prev);

      const newScenario = makeScenario(
        id,
        `Scenario ${prev.length + 1}`,
        color,
        src.inputs,
        src.returns
      );

      return [...prev, newScenario];
    });

    setActiveId(id);
  }, [activeId]);

  const handleRemoveScenario = useCallback(
    (id) => {
      setScenarios((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((s) => s.id !== id);
        if (activeId === id) setActiveId(next[0].id);
        return next;
      });
    },
    [activeId]
  );

  const handleRenameScenario = useCallback((id, name) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const handleApplyRecommendation = useCallback(
    (overrides, name) => {
      setScenarios((prev) => {
        if (prev.length >= 5) return prev;
        const src = prev.find((s) => s.id === activeId) ?? prev[0];
        const id = `s${_uid++}`;
        const color = getNextScenarioColor(prev);
        const newInputs = { ...src.inputs, ...overrides };

        if (newInputs.withdrawalRate != null) {
          newInputs.withdrawalRate = Math.max(0.01, newInputs.withdrawalRate);
        }

        let returns = src.returns;

        if (overrides.retirementAge != null && newInputs.currentAge != null) {
          const retAge = overrides.retirementAge;
          const curAge = newInputs.currentAge;
          if (retAge > curAge) {
            const minHorizon = retAge - curAge + 20;
            if (newInputs.timeHorizon < minHorizon) {
              newInputs.timeHorizon = minHorizon;
              returns = generateAgeBasedReturns(curAge, minHorizon, false, allocations);
              newInputs.avgReturn = weightedAvgReturn(curAge, minHorizon, allocations);
            }
          }
        }

        const newS = makeScenario(id, name, color, newInputs, returns);
        setActiveId(id);
        return [...prev, newS];
      });
    }, [activeId, allocations]);

  const scenariosWithData = useMemo(
    () =>
      scenarios.map((s) => {
        const { currentAge, retirementAge } = s.inputs;
        const withdrawalStartYear =
          currentAge != null && retirementAge != null
            ? Math.max(1, retirementAge - currentAge + 1)
            : 1;
        const contributionEndYear =
          currentAge != null && retirementAge != null
            ? withdrawalStartYear - 1
            : Infinity;

        return {
          ...s,
          portfolioData: simulatePortfolio({
            startingBalance: s.inputs.startingBalance,
            returns: s.returns,
            timeHorizon: s.inputs.timeHorizon,
            withdrawalRate: s.inputs.withdrawalRate,
            annualContribution: s.inputs.annualContribution,
            withdrawalStartYear,
            contributionEndYear,
            withdrawalMin: s.inputs.withdrawalMin ?? 0,
            withdrawalMax: s.inputs.withdrawalMax ?? Infinity,
          }),
        };
      }),
    [scenarios]
  );

  const activeScenario =
    scenariosWithData.find((s) => s.id === activeId) ?? scenariosWithData[0];
  const { inputs, returns } = activeScenario;
  const portfolioData = activeScenario.portfolioData;

  const allocationPeriods = useMemo(
    () =>
      inputs.currentAge != null
        ? computeAllocationPeriods(inputs.currentAge, inputs.timeHorizon, allocations)
        : [],
    [inputs.currentAge, inputs.timeHorizon, allocations]
  );

  const deferredScenario = useDeferredValue(activeScenario);
  const mcIsStale = deferredScenario !== activeScenario;

  const monteCarloResults = useMemo(() => {
    return runMonteCarloAnalysis(deferredScenario.inputs, 1000, allocations);
  }, [deferredScenario, allocations]);

  const finalBalance = portfolioData[portfolioData.length - 1]?.endBalance ?? 0;
  const depleted = finalBalance <= 0;
  const depletionIdx = portfolioData.findIndex((d) => d.endBalance <= 0);
  const totalWithdrawn = portfolioData.reduce((s, d) => s + d.withdrawal, 0);
  const totalContributions = portfolioData.reduce((s, d) => s + d.contribution, 0);
  const totalReturn = portfolioData.reduce((s, d) => s + d.growth, 0);
  const actualAvg = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);

  const resetDisabled = useMemo(() => {
    if (!returns?.length) return true
    return returns.every((r) => Math.abs(r - inputs.avgReturn) < 0.000001)
  }, [returns, inputs.avgReturn])

  return (
    <div className="app" data-theme={theme}>
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="app-title">Sequence of Returns</h1>
            <p className="app-subtitle">
              Model how market return order affects portfolio longevity
            </p>
          </div>

          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀" : "☽"}
          </button>

          <div className="header-stats">
            {totalContributions > 0 && (
              <Stat
                label="Total Contributions"
                value={formatCurrencyFull(totalContributions)}
                color="positive"
              />
            )}
            <Stat
              label="Total Return"
              value={(totalReturn >= 0 ? "+" : "") + formatCurrencyFull(totalReturn)}
              color={totalReturn >= 0 ? "positive" : "negative"}
            />
            <Stat
              label="Total Withdrawn"
              value={formatCurrencyFull(totalWithdrawn)}
              color="neutral"
            />
            <Stat
              label={`End Balance${scenarios.length > 1 ? ` · ${activeScenario.name}` : ""}`}
              value={depleted ? "Depleted" : formatCurrencyFull(finalBalance)}
              color={
                depleted
                  ? "negative"
                  : finalBalance >= inputs.startingBalance
                  ? "positive"
                  : "neutral"
              }
            />
            {depleted && (
              <Stat
                label="Depleted at"
                value={`Year ${depletionIdx + 1}`}
                color="negative"
              />
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <ScenarioTabs
          scenarios={scenarios}
          activeId={activeId}
          onSelect={setActiveId}
          onAdd={handleAddScenario}
          onRemove={handleRemoveScenario}
          onRename={handleRenameScenario}
        />

        <div className="inputs-row">
          <section className="card inputs-card">
            <div className="section-header">
              <h2 className="card-title">
                Time Horizon
                {scenarios.length > 1 && (
                  <span
                    className="card-title-badge"
                    style={{ background: activeScenario.color }}
                  >
                    {activeScenario.name}
                  </span>
                )}
              </h2>
            </div>

            <div className="inputs-grid inputs-grid--single">
              <NullableWholeNumberInputField
                label="Current Age"
                suffix="yrs"
                placeholder="optional"
                value={inputs.currentAge}
                onChange={(v) => handleInputChange("currentAge", v)}
                tooltip="Your age today. Enables age-based asset allocation and determines when contributions stop and withdrawals begin."
              />
              <NullableWholeNumberInputField
                label="Retirement Age"
                suffix="yrs"
                placeholder="optional"
                value={inputs.retirementAge}
                onChange={(v) => handleInputChange("retirementAge", v)}
                tooltip="Age at which you stop contributing and start withdrawing. Auto-extends the time horizon to cover at least 20 years past retirement."
              />
              <WholeNumberInputField
                label="Time Horizon"
                suffix="yrs"
                value={inputs.timeHorizon}
                onChange={(v) => handleInputChange("timeHorizon", v)}
                tooltip="Total years to simulate, up to 100. Auto-extends when you set a retirement age."
              />
            </div>

            {inputs.retirementAge != null &&
              inputs.currentAge != null &&
              (() => {
                const retireYear = Math.max(
                  1,
                  inputs.retirementAge - inputs.currentAge + 1
                );
                const beyondHorizon = retireYear > inputs.timeHorizon;
                return (
                  <p
                    className="section-note"
                    style={beyondHorizon ? { color: "#f7a64f" } : {}}
                  >
                    {beyondHorizon
                      ? `⚠ Retirement (Year ${retireYear}) is beyond the ${inputs.timeHorizon}-yr horizon.`
                      : `Contributions thru Yr ${Math.max(
                          0,
                          inputs.retirementAge - inputs.currentAge
                        )} · Withdrawals from Yr ${retireYear}`}
                  </p>
                );
              })()}
          </section>

          <section className="card inputs-card">
            <div className="section-header">
              <h2 className="card-title">Portfolio</h2>
            </div>
            <div className="inputs-grid inputs-grid--single">
              <CurrencyInputField
                label="Starting Balance"
                value={inputs.startingBalance}
                onChange={(v) => handleInputChange("startingBalance", v)}
                tooltip="Your portfolio value at the start of year 1."
              />
              <PercentInputField
                label="Avg Return Rate"
                value={inputs.avgReturn}
                onChange={(v) => handleInputChange("avgReturn", v)}
                tooltip="Target annual return used to generate flat returns. Auto-set when age is provided. Drag the return bars in the chart to adjust individual years."
              />
              <CurrencyInputField
                label="Annual Contribution"
                value={inputs.annualContribution}
                onChange={(v) => handleInputChange("annualContribution", v)}
                tooltip="Amount added to the portfolio each year during the accumulation phase (before retirement, or throughout if no retirement age is set)."
              />
            </div>
          </section>

          <section className="card inputs-card">
            <div className="section-header">
              <h2 className="card-title">Withdrawals</h2>
            </div>
            <div className="inputs-grid inputs-grid--single">
              <div className="input-group">
                <label className="input-label">
                  Withdrawal Rate
                  <Tooltip text="Percentage of your current portfolio balance withdrawn each year in retirement. The classic '4% rule' targets long-term sustainability." />
                </label>
                <PercentInputField
                  inline
                  value={inputs.withdrawalRate}
                  onChange={(v) => handleInputChange("withdrawalRate", v)}
                />
              </div>

              <NullableCurrencyInputField
                label="Min Withdrawal / yr"
                value={inputs.withdrawalMin}
                placeholder="no minimum"
                onChange={(v) => handleInputChange("withdrawalMin", v)}
                tooltip="Floor on the annual withdrawal. The portfolio will always pay at least this much per year, even if the % rate would produce less."
              />
              <NullableCurrencyInputField
                label="Max Withdrawal / yr"
                value={inputs.withdrawalMax}
                placeholder="no maximum"
                onChange={(v) => handleInputChange("withdrawalMax", v)}
                tooltip="Ceiling on the annual withdrawal. Withdrawal will never exceed this even if the % rate would produce more."
              />
            </div>

            {inputs.retirementAge != null &&
              inputs.currentAge != null &&
              (() => {
                const retireYear = Math.max(
                  1,
                  inputs.retirementAge - inputs.currentAge + 1
                );
                if (retireYear > inputs.timeHorizon) return null;
                return (
                  <p className="section-note">
                    Withdrawals begin <strong>Year {retireYear}</strong> (age{" "}
                    {inputs.retirementAge})
                  </p>
                );
              })()}
          </section>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Portfolio &amp; Annual Returns</h2>
              <p className="card-subtitle">
                Actual avg:&nbsp;
                <strong style={{ color: actualAvg >= 0 ? "#3ecf8e" : "#f75a5a" }}>
                  {actualAvg >= 0 ? "+" : ""}
                  {formatPercent(actualAvg)}
                </strong>
                &nbsp;·&nbsp;Target avg:&nbsp;
                <strong style={{ color: "#4f8ef7" }}>
                  {inputs.avgReturn >= 0 ? "+" : ""}
                  {formatPercent(inputs.avgReturn)}
                </strong>
              </p>
            </div>

            <div className="chart-controls">
              <div className="chart-actions-group">
                <span className="chart-controls-label">Actions</span>
                <div className="card-actions">
                  <button
                    className="btn-ghost"
                    onClick={handleResetReturns}
                    disabled={resetDisabled}
                    style={{
                      opacity: resetDisabled ? 0.5 : 1,
                      cursor: resetDisabled ? "default" : "pointer",
                    }}
                  >
                    Reset to Avg
                  </button>

                  <button className="btn-ghost" onClick={handleRandomizeReturns}>
                    Randomize
                  </button>
                </div>
              </div>

              <div className="chart-view-group">
                <span className="chart-controls-label">View</span>
                <div className="view-toggle">
                  <button
                    className={`view-btn ${viewMode === "chart" ? "active" : ""}`}
                    onClick={() => setViewMode("chart")}
                  >
                    Chart
                  </button>

                  <button
                    className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                    onClick={() => setViewMode("table")}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === "chart" ? (
            <CombinedChart
              scenarios={scenariosWithData}
              activeId={activeId}
              onReturnChange={handleReturnChange}
              allocationPeriods={allocationPeriods}
              monteCarloBands={showBands ? monteCarloResults?.bands ?? null : null}
            />
          ) : (
            <DataTable
              data={portfolioData}
              startingBalance={inputs.startingBalance}
            />
          )}
        </section>

        <AssetAllocationGuide
          currentAge={inputs.currentAge}
          allocations={allocations}
          onChangeAllocations={(nextAllocations) => {
            setAllocations(nextAllocations);

            if (inputs.currentAge != null) {
              const nextReturns = generateAgeBasedReturns(
                inputs.currentAge,
                inputs.timeHorizon,
                false,
                nextAllocations
              );

              const nextAvgReturn = weightedAvgReturn(
                inputs.currentAge,
                inputs.timeHorizon,
                nextAllocations
              );

              updateActive((s) => ({
                ...s,
                returns: nextReturns,
                inputs: {
                  ...s.inputs,
                  avgReturn: nextAvgReturn,
                },
              }));
            }
          }}
        />

        <RecommendationsPanel
          results={monteCarloResults}
          inputs={activeScenario.inputs}
          isStale={mcIsStale}
          onApply={handleApplyRecommendation}
          canAddScenario={scenarios.length < 5}
        />

        <FinancialReport
          inputs={inputs}
          portfolioData={portfolioData}
          mcResults={monteCarloResults}
          scenarioName={activeScenario.name}
        />
      </main>
    </div>
  );
}

function Stat({ label, value, color = "neutral" }) {
  const colorMap = {
    positive: "var(--positive)",
    negative: "var(--negative)",
    neutral: "var(--text)",
  };

  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: colorMap[color] }}>
        {value}
      </div>
    </div>
  );
}

function Tooltip({ text }) {
  return (
    <span className="tooltip-wrap">
      <span className="tooltip-icon">ⓘ</span>
      <span role="tooltip" className="tooltip-box">
        {text}
      </span>
    </span>
  );
}

function CurrencyInputField({ label, value, onChange, inline, tooltip }) {
  const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");
  const [display, setDisplay] = useState(() => fmt(value));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(fmt(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = raw === "" ? 0 : parseInt(raw, 10);
    setDisplay(raw === "" ? "" : num.toLocaleString("en-US"));
    prevValue.current = num;
    onChange(num);
  };

  const handleBlur = () => setDisplay(fmt(value));

  return (
    <div className={`input-group ${inline ? "inline" : ""}`}>
      {label && (
        <label className="input-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
      )}
      <div className="input-with-affix">
        <span className="affix prefix">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{ paddingLeft: 28 }}
        />
      </div>
    </div>
  );
}

function NullableCurrencyInputField({
  label,
  value,
  onChange,
  placeholder,
  inline,
  tooltip,
}) {
  const fmt = (n) => (n == null ? "" : Number(n).toLocaleString("en-US"));
  const [display, setDisplay] = useState(() => fmt(value));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(fmt(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw === "") {
      setDisplay("");
      prevValue.current = null;
      onChange(null);
    } else {
      const num = parseInt(raw, 10);
      setDisplay(num.toLocaleString("en-US"));
      prevValue.current = num;
      onChange(num);
    }
  };

  const handleBlur = () => setDisplay(fmt(value));

  return (
    <div className={`input-group ${inline ? "inline" : ""}`}>
      {label && (
        <label className="input-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
      )}
      <div className="input-with-affix">
        <span className="affix prefix">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{ paddingLeft: 28 }}
        />
      </div>
    </div>
  );
}

function PercentInputField({ label, value, onChange, inline, tooltip }) {
  const fmt = (v) => (v * 100).toFixed(2);
  const [display, setDisplay] = useState(() => fmt(value));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(fmt(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.\-]/g, "");
    setDisplay(raw);
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      const decimal = num / 100;
      prevValue.current = decimal;
      onChange(decimal);
    }
  };

  const handleBlur = () => setDisplay(fmt(value));

  return (
    <div className={`input-group ${inline ? "inline" : ""}`}>
      {label && (
        <label className="input-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
      )}
      <div className="input-with-affix">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{ paddingRight: 36 }}
        />
        <span className="affix suffix">%</span>
      </div>
    </div>
  );
}

function NullableWholeNumberInputField({
  label,
  value,
  onChange,
  suffix,
  inline,
  placeholder,
  tooltip,
}) {
  const [display, setDisplay] = useState(() => (value == null ? "" : String(value)));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(value == null ? "" : String(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setDisplay(raw);
    if (raw === "") {
      prevValue.current = null;
      onChange(null);
    } else {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) {
        prevValue.current = num;
        onChange(num);
      }
    }
  };

  const handleBlur = () => setDisplay(value == null ? "" : String(value));

  return (
    <div className={`input-group ${inline ? "inline" : ""}`}>
      {label && (
        <label className="input-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
      )}
      <div className="input-with-affix">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          style={suffix ? { paddingRight: 36 } : {}}
        />
        {suffix && <span className="affix suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function WholeNumberInputField({ label, value, onChange, suffix, inline, tooltip }) {
  const [display, setDisplay] = useState(() => String(value));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(String(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setDisplay(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      prevValue.current = num;
      onChange(num);
    }
  };

  const handleBlur = () => setDisplay(String(value));

  return (
    <div className={`input-group ${inline ? "inline" : ""}`}>
      {label && (
        <label className="input-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
      )}
      <div className="input-with-affix">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          style={suffix ? { paddingRight: 36 } : {}}
        />
        {suffix && <span className="affix suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function HistoricalDropdown({ presets, onLoad }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="preset-dropdown-wrap" ref={ref}>
      <button
        className={`btn-ghost preset-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Load historical market returns into this scenario"
      >
        Historical ▾
      </button>
      {open && (
        <div className="preset-dropdown">
          {presets.map((p) => (
            <button
              key={p.id}
              className="preset-item"
              onClick={() => {
                onLoad(p);
                setOpen(false);
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span className="preset-item-name">{p.name}</span>
                <span className="preset-item-period">{p.period}</span>
              </div>
              <span className="preset-item-desc">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
