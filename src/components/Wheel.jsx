import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Wheel.css';

const COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#34d399',
  '#60a5fa',
  '#f87171',
  '#22d3ee',
  '#c084fc',
  '#fbbf24',
  '#4ade80',
];

const VIEW = 400;
const CENTER = VIEW / 2;
const RADIUS = VIEW / 2 - 6;
const LABEL_RADIUS = RADIUS * 0.62;

function polar(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

function arcPath(startDeg, endDeg) {
  const start = polar(RADIUS, startDeg);
  const end = polar(RADIUS, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function weightedPick(entries) {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight || 1), 0);
  if (total <= 0) return Math.floor(Math.random() * entries.length);
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= Math.max(0, entries[i].weight || 1);
    if (r <= 0) return i;
  }
  return entries.length - 1;
}

export default function Wheel({ entries, onResult }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rafRef = useRef(null);

  const sectors = useMemo(() => {
    const total = entries.reduce((s, e) => s + Math.max(0, e.weight || 1), 0) || 1;
    let cursor = 0;
    return entries.map((entry, idx) => {
      const w = Math.max(0, entry.weight || 1);
      const startDeg = (cursor / total) * 360;
      cursor += w;
      const endDeg = (cursor / total) * 360;
      return {
        idx,
        entry,
        startDeg,
        endDeg,
        midDeg: (startDeg + endDeg) / 2,
        color: COLORS[idx % COLORS.length],
      };
    });
  }, [entries]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function spin() {
    if (spinning || entries.length < 2) return;
    const winnerIdx = weightedPick(entries);
    const sector = sectors[winnerIdx];

    const baseTurns = 5 + Math.random() * 2;
    const jitter = (Math.random() - 0.5) * (sector.endDeg - sector.startDeg) * 0.7;
    const targetMod = 360 - sector.midDeg + jitter;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = baseTurns * 360 + ((targetMod - currentMod + 360) % 360);
    const startRotation = rotation;
    const finalRotation = rotation + delta;

    const duration = 4200 + Math.random() * 800;
    const startedAt = performance.now();
    setSpinning(true);

    function tick(now) {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutQuart(t);
      const value = startRotation + (finalRotation - startRotation) * eased;
      setRotation(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(150);
          } catch {}
        }
        onResult?.(entries[winnerIdx], winnerIdx);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className="wheel-wrap">
      <div className="wheel-stage">
        <div className="wheel-pointer" aria-hidden="true" />
        <svg
          className="wheel-svg"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          style={{ transform: `rotate(${rotation}deg)` }}
          role="img"
          aria-label="Spin wheel"
        >
          {sectors.length === 0 && (
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="var(--color-bg-elev-2)" stroke="var(--color-border)" />
          )}
          {sectors.length === 1 && (
            <>
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={sectors[0].color} />
              <text
                x={CENTER}
                y={CENTER}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#04131f"
                fontWeight="700"
                fontSize="20"
              >
                {truncate(sectors[0].entry.name, 18)}
              </text>
            </>
          )}
          {sectors.length > 1 &&
            sectors.map((s) => {
              const labelPos = polar(LABEL_RADIUS, s.midDeg);
              const arcSize = s.endDeg - s.startDeg;
              const fontSize = Math.max(10, Math.min(20, arcSize / 2.2));
              return (
                <g key={s.idx}>
                  <path d={arcPath(s.startDeg, s.endDeg)} fill={s.color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                  <g transform={`translate(${labelPos.x} ${labelPos.y}) rotate(${s.midDeg})`}>
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#04131f"
                      fontWeight="700"
                      fontSize={fontSize}
                    >
                      {truncate(s.entry.name, 14)}
                    </text>
                  </g>
                </g>
              );
            })}
          <circle cx={CENTER} cy={CENTER} r="22" fill="var(--color-bg-elev)" stroke="var(--color-border)" strokeWidth="2" />
        </svg>
      </div>
      <button
        className="btn btn-primary wheel-spin-btn"
        onClick={spin}
        disabled={spinning || entries.length < 2}
      >
        {spinning ? 'Spinning…' : entries.length < 2 ? 'Add at least 2 entries' : 'Spin'}
      </button>
    </div>
  );
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
