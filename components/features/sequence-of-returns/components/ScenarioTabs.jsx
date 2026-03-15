import React, { useState, useRef, useEffect } from 'react'

const MAX_SCENARIOS = 5

export default function ScenarioTabs({ scenarios, activeId, onSelect, onAdd, onRemove, onRename }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startEdit = (e, s) => {
    e.stopPropagation()
    setEditingId(s.id)
    setEditValue(s.name)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingId(null)
  }

  return (
    <div className="scenario-bar">
      <div className="scenario-tabs">
        {scenarios.map((s) => {
          const isActive = s.id === activeId
          return (
            <div
              key={s.id}
              className={`scenario-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
              onDoubleClick={(e) => startEdit(e, s)}
              style={{ '--tab-color': s.color }}
            >
              <span className="tab-dot" style={{ background: s.color }} />

              {editingId === s.id ? (
                <input
                  ref={inputRef}
                  className="tab-name-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={onKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-name">{s.name}</span>
              )}

              {scenarios.length > 1 && (
                <button
                  className="tab-remove"
                  onClick={(e) => { e.stopPropagation(); onRemove(s.id) }}
                  title="Remove scenario"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {scenarios.length < MAX_SCENARIOS && (
        <button className="scenario-add" onClick={onAdd} title="Add scenario (copies current)">
          + Scenario
        </button>
      )}

      <span className="scenario-hint">Double-click tab to rename</span>
    </div>
  )
}
