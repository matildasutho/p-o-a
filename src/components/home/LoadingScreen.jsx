"use client";

import { useEffect, useRef } from "react";
import { LOADING_PHRASES } from "@/lib/loadingPhrases";

// How many times the phrase list repeats to fill the screen. Extra words
// beyond the viewport are simply clipped (the list container hides overflow).
const REPEAT_COUNT = 8;
const REPEATED_PHRASES = Array.from({ length: REPEAT_COUNT }, () => LOADING_PHRASES).flat();

// Cursor proximity (px) within which a word is erased.
const ERASE_RADIUS = 70;

export default function LoadingScreen({ closing, variant = "initial" }) {
  const wordRefs = useRef([]);
  const positionsRef = useRef([]);
  const hiddenRef = useRef(new Set());
  const rafRef = useRef(null);

  useEffect(() => {
    function measure() {
      positionsRef.current = wordRefs.current.map((el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    function handlePointerMove(event) {
      if (rafRef.current) return;
      const { clientX, clientY } = event;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const positions = positionsRef.current;
        for (let index = 0; index < positions.length; index += 1) {
          if (hiddenRef.current.has(index)) continue;
          const position = positions[index];
          if (!position) continue;
          const dx = position.cx - clientX;
          const dy = position.cy - clientY;
          if (dx * dx + dy * dy < ERASE_RADIUS * ERASE_RADIUS) {
            hiddenRef.current.add(index);
            const el = wordRefs.current[index];
            if (el) el.style.opacity = "0";
          }
        }
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className={`loading-screen loading-screen--${variant}${
        closing ? " loading-screen--closing" : ""
      }`}
      aria-hidden={closing}
    >
      <div className="loading-screen__list">
        {REPEATED_PHRASES.map((phrase, index) => (
          <span
            key={index}
            ref={(el) => {
              wordRefs.current[index] = el;
            }}
            className="loading-screen__word"
          >
            {phrase}
          </span>
        ))}
      </div>
    </div>
  );
}
