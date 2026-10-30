"use client";

import { useEffect, useState } from "react";

const FRAMES = [
  {
    image: "/intro/P.svg",
    rows: [
      ["P", "O", "A"],
      ["POA", "", ""],
      ["", "", "POA"],
      ["", "POA", ""],
    ],
  },
  {
    image: "/intro/O.svg",
    rows: [
      ["", "", "POA"],
      ["", "POA", ""],
      ["POA", "", ""],
      ["P", "O", "A"],
    ],
  },
  {
    image: "/intro/A.svg",
    rows: [
      ["POA", "", ""],
      ["", "", "POA"],
      ["P", "O", "A"],
      ["", "", "POA"],
    ],
  },
];

const FRAME_MS = 1500;
const IDLE_TIMEOUT_MS = 30000;

const ACTIVITY_EVENTS = ["pointermove", "keydown", "scroll"];
// swallowed briefly after waking so the same tap/scroll doesn't also step the sequence
const WAKE_EVENTS = ["pointerdown", "click", "wheel", "touchstart", "touchend"];
const WAKE_SWALLOW_MS = 600;

export default function IdleScreen() {
  const [idle, setIdle] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer = null;
    let isIdle = false;

    function wake() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        isIdle = true;
        setTick(0);
        setIdle(true);
      }, IDLE_TIMEOUT_MS);
      if (!isIdle) return;
      isIdle = false;
      setIdle(false);
    }

    let swallowUntil = 0;

    function handleWakeEvent(event) {
      if (isIdle) swallowUntil = performance.now() + WAKE_SWALLOW_MS;
      if (performance.now() < swallowUntil) {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
      }
      wake();
    }

    wake();
    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, wake, { passive: true }),
    );
    WAKE_EVENTS.forEach((type) =>
      window.addEventListener(type, handleWakeEvent, {
        capture: true,
        passive: false,
      }),
    );
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, wake));
      WAKE_EVENTS.forEach((type) =>
        window.removeEventListener(type, handleWakeEvent, { capture: true }),
      );
    };
  }, []);

  useEffect(() => {
    if (!idle) return undefined;
    document.body.classList.add("idle-active");
    const timer = setInterval(() => setTick((value) => value + 1), FRAME_MS);
    return () => {
      clearInterval(timer);
      document.body.classList.remove("idle-active");
    };
  }, [idle]);

  if (!idle) return null;

  const frameIndex = tick % FRAMES.length;
  const frame = FRAMES[frameIndex];

  return (
    <div className="idle-screen" aria-hidden="true">
      <div className="idle-screen__grid">
        {frame.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="idle-screen__row">
            {row.map((text, colIndex) => (
              <span key={colIndex} className="idle-screen__cell">
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
      {FRAMES.map(({ image }, index) => (
        <img
          key={image}
          className="idle-screen__image"
          src={image}
          alt=""
          decoding="sync"
          style={{ visibility: index === frameIndex ? "visible" : "hidden" }}
        />
      ))}
    </div>
  );
}
