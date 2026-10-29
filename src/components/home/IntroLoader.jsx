"use client";

import { useEffect, useRef, useState } from "react";

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

const DEFINITIONS_SRC = "/POA_Definitions.gif";
const DEFINITIONS_MS = 6300;
const MIN_FRAMES = FRAMES.length;

function loaderBarKeyframes() {
  const keyframes = [{ offset: 0, transform: "scaleX(0)" }];
  let time = 0;
  let progress = 0;
  for (;;) {
    time += 0.04 + Math.random() * 0.14;
    if (time >= 0.95) break;
    if (Math.random() > 0.25) {
      progress = Math.min(progress + Math.random() * 0.22, 0.97);
    }
    keyframes.push({ offset: time, transform: `scaleX(${progress})` });
  }
  keyframes.push({ offset: 1, transform: "scaleX(1)" });
  return keyframes;
}

export default function IntroLoader({ ready, onDone }) {
  const [tick, setTick] = useState(0);
  const [showDefinitions, setShowDefinitions] = useState(true);
  const definitionsRef = useRef(null);
  const barRef = useRef(null);
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const img = definitionsRef.current;
    let timer = null;
    let barAnimation = null;
    function start() {
      clearTimeout(timer);
      barAnimation?.cancel();
      barAnimation = barRef.current.animate(loaderBarKeyframes(), {
        duration: DEFINITIONS_MS,
        easing: "linear",
        fill: "forwards",
      });
      timer = setTimeout(() => setShowDefinitions(false), DEFINITIONS_MS);
    }
    function skip() {
      setShowDefinitions(false);
    }
    if (img.complete && img.naturalWidth > 0) {
      start();
    } else {
      img.addEventListener("load", start, { once: true });
      img.addEventListener("error", skip, { once: true });
    }
    return () => {
      clearTimeout(timer);
      barAnimation?.cancel();
      img.removeEventListener("load", start);
      img.removeEventListener("error", skip);
    };
  }, []);

  useEffect(() => {
    if (showDefinitions) return undefined;
    const timer = setTimeout(() => {
      const next = tick + 1;
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
  }, [tick, onDone, showDefinitions]);

  const frameIndex = tick % FRAMES.length;
  const frame = FRAMES[frameIndex];

  const letterImages = FRAMES.map(({ image }, index) => (
    <img
      key={image}
      className="intro-loader__image"
      src={image}
      alt=""
      decoding="sync"
      style={{
        visibility:
          !showDefinitions && index === frameIndex ? "visible" : "hidden",
      }}
    />
  ));

  return (
    <div
      className={`intro-loader${
        showDefinitions ? " intro-loader--definitions" : ""
      }`}
      aria-hidden="true"
    >
      {showDefinitions ? (
        <>
          <div ref={barRef} className="intro-loader__bar" />
          <img
            ref={definitionsRef}
            className="intro-loader__definitions"
            src={DEFINITIONS_SRC}
            alt=""
          />
        </>
      ) : (
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
      )}
      {letterImages}
    </div>
  );
}
