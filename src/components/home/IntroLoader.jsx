"use client";

import { useEffect, useRef, useState } from "react";

// Each frame is four rows of [left, centre, right] text, plus one large
// letter image laid over the top. Frames hard-cut — no fades.
// Swap the placeholder SVGs in public/intro/ for the final letter images
// (keep the filenames, or update `image` below).
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

const FRAME_MS = 700;
// Play at least one full loop of frames before the loader can close, and
// only ever close after the last frame of a loop.
const MIN_FRAMES = FRAMES.length;

export default function IntroLoader({ ready, onDone }) {
  const [tick, setTick] = useState(0);
  // Read from the timer so a change in readiness doesn't restart the frame.
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    FRAMES.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = tick + 1;
      // Close at the end of a full P-O-A loop, once at least one loop has
      // played and every sequence asset has loaded. Deciding here, before
      // the next frame renders, stops the first frame flashing back up just
      // as the loader is removed.
      if (
        next >= MIN_FRAMES &&
        next % FRAMES.length === 0 &&
        readyRef.current
      ) {
        onDone();
        return;
      }
      setTick(next);
    }, FRAME_MS);
    return () => clearTimeout(timer);
  }, [tick, onDone]);

  const frame = FRAMES[tick % FRAMES.length];

  return (
    <div className="intro-loader" aria-hidden="true">
      <div className="intro-loader__grid">
        {frame.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="intro-loader__row">
            {row.map((text, colIndex) => (
              <span key={colIndex} className="intro-loader__cell">
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
      <img className="intro-loader__image" src={frame.image} alt="" />
    </div>
  );
}
