"use client";

import { useEffect, useRef, useState } from "react";

const LETTERS = ["P", "-", "O", "-", "A"];

// Scripted timeline (ms). The ink-bleed look comes from feGaussianBlur -> a
// feColorMatrix alpha threshold (alpha_out = A * alpha_in + B): raising A
// while pushing B negative sharpens the blurred edge back into a hard,
// swollen blob; pushing it far enough spreads the alpha so thin that even
// the threshold's "opaque" core drops to zero - a letter disappears through
// the filter itself, no opacity trick needed for that part.
//
// Each letter gets its own filter instance and its own `amount` (0-1: 0 is
// crisp, 1 is fully blurred/thresholded away), offset by STAGGER_MS so they
// resolve in one at a time rather than all together - straight ease in each
// direction, no wobble.
const STAGGER_MS = 110;
const IN_MS = 950;
const HOLD_MS = 850;
const OUT_MS = 950;
const HIDE_TRANSITION_MS = 500;

const MAX_BLUR = 60;
const MAX_THRESHOLD = 90;

const ALL_IN_DONE_MS = (LETTERS.length - 1) * STAGGER_MS + IN_MS;
const HOLD_END_MS = ALL_IN_DONE_MS + HOLD_MS;
const TOTAL_MS = HOLD_END_MS + (LETTERS.length - 1) * STAGGER_MS + OUT_MS;

function thresholdBias(a) {
  return -(a - 1) / 2;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function amountForLetter(t, index) {
  const inStart = index * STAGGER_MS;
  const inEnd = inStart + IN_MS;
  const outStart = HOLD_END_MS + index * STAGGER_MS;
  const outEnd = outStart + OUT_MS;

  if (t < inStart) return 1;
  if (t < inEnd) return 1 - easeInOut((t - inStart) / IN_MS);
  if (t < outStart) return 0;
  if (t < outEnd) return easeInOut((t - outStart) / OUT_MS);
  return 1;
}

export default function IntroLoader({ ready, onDone }) {
  const blurRefs = useRef([]);
  const matrixRefs = useRef([]);
  const [phase, setPhase] = useState("playing");

  useEffect(() => {
    const start = performance.now();
    let rafId;

    function applyFilter(index, amount) {
      const blur = amount * MAX_BLUR;
      const thresholdA = 1 + amount * (MAX_THRESHOLD - 1);
      const blurEl = blurRefs.current[index];
      const matrixEl = matrixRefs.current[index];
      if (blurEl) blurEl.setAttribute("stdDeviation", blur.toFixed(2));
      if (matrixEl) {
        const bias = thresholdBias(thresholdA);
        matrixEl.setAttribute(
          "values",
          `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${thresholdA.toFixed(2)} ${bias.toFixed(2)}`
        );
      }
    }

    function tick(now) {
      const t = now - start;
      LETTERS.forEach((_, index) => applyFilter(index, amountForLetter(t, index)));

      if (t < TOTAL_MS) {
        rafId = requestAnimationFrame(tick);
      } else {
        setPhase((prev) => (prev === "playing" ? "holding" : prev));
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (phase !== "holding" || !ready) return undefined;
    setPhase("hiding");
    const timer = setTimeout(onDone, HIDE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [phase, ready, onDone]);

  return (
    <div
      className={`intro-loader${phase === "hiding" ? " intro-loader--hiding" : ""}`}
    >
      <svg className="intro-loader__defs" aria-hidden="true">
        {LETTERS.map((_, index) => (
          <filter
            key={index}
            id={`ink-bleed-filter-${index}`}
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur
              ref={(el) => {
                blurRefs.current[index] = el;
              }}
              in="SourceGraphic"
              stdDeviation="0"
              result="blurred"
            />
            <feColorMatrix
              ref={(el) => {
                matrixRefs.current[index] = el;
              }}
              in="blurred"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            />
          </filter>
        ))}
      </svg>
      <span className="intro-loader__text">
        {LETTERS.map((letter, index) => (
          <span
            key={index}
            className="intro-loader__letter"
            style={{ filter: `url(#ink-bleed-filter-${index})` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </div>
  );
}
