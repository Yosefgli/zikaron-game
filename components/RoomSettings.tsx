'use client'

import { useState } from 'react'
import type { Room, CardSet } from '@/types/game'
import { getT } from '@/lib/i18n'

interface Props {
  room: Room
  cardSets: CardSet[]
  onSave: (settings: Partial<{
    pair_found_behavior:     string
    turn_timer_enabled:      boolean
    turn_time_limit_seconds: number
    miss_reveal_ms:          number
    language:                string
    card_set_id:             string
    num_pairs:               number
  }>) => void
}

export default function RoomSettings({ room, cardSets, onSave }: Props) {
  const t = getT(room.language)

  const [behavior,  setBehavior]  = useState(room.pair_found_behavior)
  const [missMs,    setMissMs]    = useState(room.miss_reveal_ms)
  const [timerOn,   setTimerOn]   = useState(room.turn_timer_enabled)
  const [timeLimit, setTimeLimit] = useState(room.turn_time_limit_seconds ?? 30)
  const [lang,      setLang]      = useState(room.language)
  const [setId,     setSetId]     = useState(room.card_set_id ?? '')
  const [numPairs,  setNumPairs]  = useState(room.num_pairs)

  function handleSave() {
    onSave({
      pair_found_behavior:     behavior,
      miss_reveal_ms:          missMs,
      turn_timer_enabled:      timerOn,
      turn_time_limit_seconds: timerOn ? timeLimit : undefined,
      language:                lang,
      card_set_id:             setId || undefined,
      num_pairs:               numPairs,
    })
  }

  const labelClass = 'block text-sm text-slate-400 mb-1'
  const inputClass = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
      <h3 className="font-semibold text-white">{t.settings}</h3>

      {/* Card Set */}
      <div>
        <label className={labelClass}>{t.card_set}</label>
        <select className={inputClass} value={setId} onChange={e => setSetId(e.target.value)}>
          <option value="">{t.select_set}</option>
          {cardSets.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Num Pairs */}
      <div>
        <label className={labelClass}>{t.num_pairs}: {numPairs}</label>
        <input
          type="range" min={4} max={12} value={numPairs}
          onChange={e => setNumPairs(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Pair found behavior */}
      <div>
        <label className={labelClass}>{t.pair_found_behavior}</label>
        <select className={inputClass} value={behavior} onChange={e => setBehavior(e.target.value as 'stay_open' | 'remove_from_board')}>
          <option value="stay_open">{t.stay_open}</option>
          <option value="remove_from_board">{t.remove_from_board}</option>
        </select>
      </div>

      {/* Miss reveal ms */}
      <div>
        <label className={labelClass}>{t.miss_reveal_ms}: {missMs}</label>
        <input
          type="range" min={500} max={5000} step={100} value={missMs}
          onChange={e => setMissMs(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Turn timer */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox" id="timerToggle" checked={timerOn}
          onChange={e => setTimerOn(e.target.checked)}
          className="accent-blue-500 w-4 h-4"
        />
        <label htmlFor="timerToggle" className="text-sm text-slate-300">{t.turn_timer}</label>
      </div>

      {timerOn && (
        <div>
          <label className={labelClass}>{t.turn_time_limit}: {timeLimit}s</label>
          <input
            type="range" min={10} max={120} step={5} value={timeLimit}
            onChange={e => setTimeLimit(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Language */}
      <div>
        <label className={labelClass}>{t.language}</label>
        <select className={inputClass} value={lang} onChange={e => setLang(e.target.value)}>
          <option value="he">עברית</option>
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
      >
        {t.save_settings}
      </button>
    </div>
  )
}
