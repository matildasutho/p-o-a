"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CursorTrail from "./CursorTrail";

const TURNS = ["background", "overlay"];

// "click" advances one step per click with a timed fade; "scroll" ties the
// fade to scroll distance.
const NAV_MODE = "click";

const REVEAL_DISTANCE = 200;
// How long one click-triggered fade takes.
const STEP_DURATION_MS = 500;

// Each overlay image is placed once, when it appears, offset from its usual
// spot by this fraction of the cursor's distance from the screen centre. It
// then stays put until the next overlay replaces it.
const OVERLAY_OFFSET_RATIO = 0.08;
const NO_OFFSET = { x: 0, y: 0 };

// Gap between the cursor and the floating asset label.
const LABEL_CURSOR_GAP = 16;
// Spring the label uses to chase the cursor. Lower stiffness trails further
// behind. Damping is how much speed the label keeps each frame: lower values
// settle sooner with less overshoot, higher values wobble more.
const LABEL_SPRING_STIFFNESS = 1;
const LABEL_SPRING_DAMPING = 0.1;

export default function ImageSequence({ assets }) {
  const total = assets.length;

  const [committed, setCommitted] = useState(() => ({
    background: null,
    overlaySide: null,
    overlayAsset: null,
    overlayOffset: NO_OFFSET,
  }));
  const [pendingOffset, setPendingOffset] = useState(NO_OFFSET);
  const [pendingProgress, setPendingProgress] = useState(0);

  // Starts on the bare background; the first click brings in the first asset.
  const revealedCount = useRef(0);
  const totalDistance = useRef(0);
  const lastScrollY = useRef(0);
  const pendingOffsetRef = useRef(NO_OFFSET);

  const [hoverLabel, setHoverLabel] = useState(null);
  const [pointerInside, setPointerInside] = useState(false);
  const labelRef = useRef(null);
  const pointerRef = useRef(null);

  // Finds the topmost visible asset under the last known cursor position.
  // Media that's mostly faded out is skipped, so the label switches over
  // halfway through a crossfade rather than at the end.
  const updateHoverLabel = useCallback(() => {
    const pointer = pointerRef.current;
    if (!pointer) {
      setHoverLabel(null);
      return;
    }
    const media = document
      .elementsFromPoint(pointer.x, pointer.y)
      .find(
        (el) =>
          el.classList.contains("sequence-media") &&
          parseFloat(el.style.opacity || "1") >= 0.5,
      );
    setHoverLabel(media?.dataset.label || null);
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // The label's own sprung position, separate from the real cursor.
    const spring = { x: 0, y: 0, vx: 0, vy: 0 };
    let frame = null;
    let lastTime = 0;

    function placeLabel() {
      if (!labelRef.current) return;
      labelRef.current.style.transform = `translate(${
        spring.x + LABEL_CURSOR_GAP
      }px, ${spring.y + LABEL_CURSOR_GAP}px)`;
    }

    function tick(now) {
      const pointer = pointerRef.current;
      if (!pointer) {
        frame = null;
        return;
      }
      // Scale each step by elapsed time so the spring feels the same on
      // 60Hz and 120Hz screens.
      const steps = Math.min((now - lastTime) / (1000 / 60), 4);
      lastTime = now;
      for (const [axis, velocity] of [
        ["x", "vx"],
        ["y", "vy"],
      ]) {
        spring[velocity] +=
          (pointer[axis] - spring[axis]) * LABEL_SPRING_STIFFNESS * steps;
        spring[velocity] *= LABEL_SPRING_DAMPING ** steps;
        spring[axis] += spring[velocity] * steps;
      }
      placeLabel();

      const settled =
        Math.abs(pointer.x - spring.x) < 0.1 &&
        Math.abs(pointer.y - spring.y) < 0.1 &&
        Math.abs(spring.vx) < 0.1 &&
        Math.abs(spring.vy) < 0.1;
      frame = settled ? null : requestAnimationFrame(tick);
    }

    function handlePointerMove(event) {
      if (event.pointerType !== "mouse") return;
      const isEntering = pointerRef.current === null;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      // Arriving from outside the window, start at the cursor rather than
      // flying in from wherever the label was last left.
      if (isEntering) setPointerInside(true);
      if (isEntering || reduceMotion) {
        Object.assign(spring, {
          x: event.clientX,
          y: event.clientY,
          vx: 0,
          vy: 0,
        });
        placeLabel();
      }
      if (!reduceMotion && frame === null) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
      updateHoverLabel();
    }

    function handlePointerLeave() {
      pointerRef.current = null;
      setPointerInside(false);
      setHoverLabel(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    document.documentElement.addEventListener(
      "pointerleave",
      handlePointerLeave,
    );
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        handlePointerLeave,
      );
    };
  }, [updateHoverLabel]);

  // The assets change under a still cursor as the sequence advances, so
  // re-check what's being hovered after every render too.
  useEffect(() => {
    updateHoverLabel();
  });

  const commitSteps = useCallback(
    (targetRevealedCount) => {
      if (targetRevealedCount <= revealedCount.current) return;
      const startIndex = revealedCount.current;
      setCommitted((prev) => {
        let next = prev;
        for (let i = startIndex; i < targetRevealedCount; i += 1) {
          const posInLoop = i % total;
          if (posInLoop === 0) {
            next = {
              background: 0,
              overlaySide: null,
              overlayAsset: null,
              overlayOffset: NO_OFFSET,
            };
            continue;
          }
          const turn = TURNS[i % TURNS.length];
          if (turn === "background") {
            next = { ...next, background: posInLoop };
          } else {
            const side = next.overlaySide === "right" ? "left" : "right";
            next = {
              ...next,
              overlaySide: side,
              overlayAsset: posInLoop,
              overlayOffset: pendingOffsetRef.current,
            };
          }
        }
        return next;
      });
      revealedCount.current = targetRevealedCount;
    },
    [total],
  );

  useEffect(() => {
    if (total === 0 || NAV_MODE !== "click") return undefined;

    let frame = null;
    let startTime = 0;

    function finishStep() {
      cancelAnimationFrame(frame);
      frame = null;
      commitSteps(revealedCount.current + 1);
      setPendingProgress(0);
    }

    function tick(now) {
      const progress = Math.min((now - startTime) / STEP_DURATION_MS, 1);
      if (progress >= 1) {
        finishStep();
        return;
      }
      setPendingProgress(progress);
      frame = requestAnimationFrame(tick);
    }

    function handleClick(event) {
      if (event.target instanceof Element && event.target.closest("a, button"))
        return;
      // A click mid-fade snaps the current step to its end and starts the next.
      if (frame !== null) finishStep();
      const offset = {
        x: (event.clientX - window.innerWidth / 2) * OVERLAY_OFFSET_RATIO,
        y: (event.clientY - window.innerHeight / 2) * OVERLAY_OFFSET_RATIO,
      };
      pendingOffsetRef.current = offset;
      setPendingOffset(offset);
      startTime = performance.now();
      frame = requestAnimationFrame(tick);
    }

    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
      cancelAnimationFrame(frame);
    };
  }, [total, commitSteps]);

  useEffect(() => {
    if (total === 0 || NAV_MODE !== "scroll") return undefined;

    lastScrollY.current = window.scrollY;

    function handleScroll() {
      const scrollY = window.scrollY;
      totalDistance.current += Math.abs(scrollY - lastScrollY.current);
      lastScrollY.current = scrollY;

      const units = totalDistance.current / REVEAL_DISTANCE;
      const targetRevealedCount = Math.floor(units);

      commitSteps(targetRevealedCount);

      setPendingProgress(units - Math.floor(units));

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const margin = window.innerHeight * 2;
      if (
        maxScroll > margin * 2 &&
        (scrollY < margin || scrollY > maxScroll - margin)
      ) {
        const target = maxScroll / 2;
        window.scrollTo(0, target);
        lastScrollY.current = target;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [total, commitSteps]);

  if (total === 0) {
    return <div className="sequence-stage" />;
  }

  const posInLoop = revealedCount.current % total;
  const isResetTransition = posInLoop === 0 && revealedCount.current > 0;
  const pendingTurn = TURNS[revealedCount.current % TURNS.length];
  const pendingAssetIndex = isResetTransition ? 0 : posInLoop;
  const pendingAsset = assets[pendingAssetIndex];
  const pendingSide = committed.overlaySide === "right" ? "left" : "right";

  const currentAssetNumber = ((revealedCount.current - 1) % total) + 1;
  const counterLabel = `${String(currentAssetNumber).padStart(2, "0")} / ${String(
    total,
  ).padStart(2, "0")}`;

  // Work out what the background layer and the single overlay layer should
  // render this frame, as plain values, before turning them into markup.
  let bgAsset =
    committed.background == null ? null : assets[committed.background];
  let bgOpacity = 1;
  let overlaySide = committed.overlaySide;
  let overlayAsset =
    committed.overlayAsset == null ? null : assets[committed.overlayAsset];
  let overlayOpacity = overlayAsset ? 1 : 0;
  let overlayOffset = committed.overlayOffset;

  if (isResetTransition) {
    if (pendingProgress < 0.5) {
      // Everything currently visible fades out together.
      const opacity = 1 - pendingProgress / 0.5;
      bgOpacity = opacity;
      overlayOpacity = overlayAsset ? opacity : 0;
    } else {
      // Then only the background fades the first image back in.
      bgAsset = assets[0];
      bgOpacity = (pendingProgress - 0.5) / 0.5;
      overlayAsset = null;
      overlayOpacity = 0;
    }
  } else if (pendingTurn === "background") {
    if (bgAsset == null) {
      // Nothing to fade out yet, so the first asset fades straight in.
      bgAsset = pendingAsset;
      bgOpacity = pendingProgress;
    } else if (pendingProgress < 0.5) {
      bgOpacity = 1 - pendingProgress / 0.5;
    } else {
      bgAsset = pendingAsset;
      bgOpacity = (pendingProgress - 0.5) / 0.5;
    }
  } else {
    // An overlay turn: the previous overlay (if any) fades away, then the
    // next one fades in on the opposite side — the two are never both
    // visible at once.
    if (committed.overlayAsset == null) {
      overlaySide = pendingSide;
      overlayAsset = pendingAsset;
      overlayOffset = pendingOffset;
      overlayOpacity = pendingProgress;
    } else if (pendingProgress < 0.5) {
      overlayOpacity = 1 - pendingProgress / 0.5;
    } else {
      overlaySide = pendingSide;
      overlayAsset = pendingAsset;
      overlayOffset = pendingOffset;
      overlayOpacity = (pendingProgress - 0.5) / 0.5;
    }
  }

  // Before the first click the tooltip prompts to start. Asset labels are
  // switched off for now, so once the sequence starts it stays hidden.
  const hasStarted = committed.background != null || pendingProgress > 0;
  const tooltip = !hasStarted && pointerInside ? "click to start" : null;

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
      <CursorTrail />
      {/* <div
        ref={labelRef}
        className="sequence-hover-label"
        // Its position is set straight on the element by the pointermove
        // handler, so following the cursor doesn't re-render the sequence.
        style={{ opacity: tooltip ? 1 : 0 }}
        aria-hidden="true"
      >
        {tooltip}
      </div> */}
      <div className="sequence-stage">
        <div className="sequence-slot sequence-slot--background">
          {bgAsset && (
            <SequenceMedia asset={bgAsset} style={{ opacity: bgOpacity }} />
          )}
        </div>
        {overlayAsset && (
          <div
            className={`sequence-slot sequence-slot--${overlaySide}`}
            style={{
              transform: `translate(${overlayOffset.x}px, ${overlayOffset.y}px)`,
            }}
          >
            <SequenceMedia
              asset={overlayAsset}
              style={{ opacity: overlayOpacity }}
            />
          </div>
        )}
      </div>
      {NAV_MODE === "scroll" && (
        <div className="sequence-scroll-spacer" aria-hidden="true" />
      )}
    </>
  );
}

function SequenceMedia({ asset, style }) {
  if (asset.type === "video") {
    return (
      <video
        key={asset.src}
        className="sequence-media"
        style={style}
        src={asset.src}
        data-label={asset.label}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <img
      key={asset.src}
      className="sequence-media"
      style={style}
      src={asset.src}
      alt={asset.alt}
      data-label={asset.label}
    />
  );
}
