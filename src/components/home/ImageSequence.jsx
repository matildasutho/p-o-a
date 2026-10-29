"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEP_DURATION_MS = 500;

const SWIPE_THRESHOLD_PX = 40;
const WHEEL_THRESHOLD = 30;
const WHEEL_IDLE_MS = 200;
// firefox can report wheel deltas in lines
const WHEEL_LINE_HEIGHT = 16;

const OVERLAY_OFFSET_RATIO = 0.08;
const NO_OFFSET = { x: 0, y: 0 };

const LABEL_CURSOR_GAP = 16;
const LABEL_SPRING_STIFFNESS = 1;
const LABEL_SPRING_DAMPING = 0.1;

const BLANK = { background: null, overlay: null, side: null, current: null };

function buildStates(total) {
  const states = [{ background: 0, overlay: null, side: null, current: 0 }];
  let side = "left";
  for (let i = 1; i < total; i += 2) {
    side = side === "right" ? "left" : "right";
    const { background } = states[states.length - 1];
    states.push({ background, overlay: i, side, current: i });
    if (i + 1 < total) {
      states.push({ background: i + 1, overlay: i, side, current: i + 1 });
      states.push({
        background: i + 1,
        overlay: null,
        side: null,
        current: i + 1,
      });
    }
  }
  return states;
}

export default function ImageSequence({ assets }) {
  const total = assets.length;
  const states = useMemo(() => buildStates(total), [total]);

  const [index, setIndex] = useState(-1);
  const [transition, setTransition] = useState(null);
  const [offsets, setOffsets] = useState({});

  const [hoverLabel, setHoverLabel] = useState(null);
  const [pointerInside, setPointerInside] = useState(false);
  const labelRef = useRef(null);
  const pointerRef = useRef(null);

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

  useEffect(() => {
    updateHoverLabel();
  });

  useEffect(() => {
    if (total === 0) return undefined;

    let frame = null;
    let startTime = 0;
    let from = -1;
    let to = null;

    function finishStep() {
      cancelAnimationFrame(frame);
      frame = null;
      from = to;
      to = null;
      setIndex(from);
      setTransition(null);
    }

    function tick(now) {
      const progress = Math.min((now - startTime) / STEP_DURATION_MS, 1);
      if (progress >= 1) {
        finishStep();
        return;
      }
      setTransition({ to, progress });
      frame = requestAnimationFrame(tick);
    }

    function step(direction, point) {
      if (frame !== null) finishStep();
      if (from < 0 && direction < 0) return;
      const next =
        from < 0 ? 0 : (from + direction + states.length) % states.length;
      const current = from < 0 ? BLANK : states[from];
      const target = states[next];

      if (target.overlay != null && target.overlay !== current.overlay) {
        const offset = point
          ? {
              x: 0,
              y: (point.y - window.innerHeight / 2) * OVERLAY_OFFSET_RATIO,
            }
          : NO_OFFSET;
        setOffsets((prev) => ({ ...prev, [target.overlay]: offset }));
      }

      to = next;
      startTime = performance.now();
      setTransition({ to, progress: 0 });
      frame = requestAnimationFrame(tick);
    }

    function handleClick(event) {
      if (event.target instanceof Element && event.target.closest("a, button"))
        return;
      step(1, { x: event.clientX, y: event.clientY });
    }

    let touchStart = null;

    function handleTouchStart(event) {
      touchStart =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    }

    function handleTouchMove(event) {
      if (event.touches.length === 1) event.preventDefault();
    }

    function handleTouchEnd(event) {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      step(delta < 0 ? 1 : -1, { x: touch.clientX, y: touch.clientY });
    }

    let wheelDistance = 0;
    let wheelLocked = false;
    let wheelTimer = null;

    function handleWheel(event) {
      if (event.ctrlKey) return; // trackpad pinch-zoom
      event.preventDefault();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelLocked = false;
        wheelDistance = 0;
      }, WHEEL_IDLE_MS);
      if (wheelLocked) return;

      const scale = event.deltaMode === 1 ? WHEEL_LINE_HEIGHT : 1;
      wheelDistance +=
        (Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY) * scale;
      if (Math.abs(wheelDistance) < WHEEL_THRESHOLD) return;
      wheelLocked = true;
      step(wheelDistance > 0 ? 1 : -1, pointerRef.current);
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(frame);
      clearTimeout(wheelTimer);
    };
  }, [total, states]);

  if (total === 0) {
    return <div className="sequence-stage" />;
  }

  const fromState = index < 0 ? BLANK : states[index];
  const toState = transition ? states[transition.to] : null;
  const progress = transition?.progress ?? 0;

  const currentAssetNumber = fromState.current == null ? 0 : fromState.current + 1;
  const counterLabel = `${String(currentAssetNumber).padStart(2, "0")} / ${String(
    total,
  ).padStart(2, "0")}`;

  let background = fromState.background;
  let bgOpacity = 1;
  let overlay = fromState.overlay;
  let overlaySide = fromState.side;
  let overlayOpacity = 1;

  if (toState) {
    const bgChanges = toState.background !== fromState.background;
    const overlayChanges = toState.overlay !== fromState.overlay;
    const firstHalf = progress < 0.5;
    const fadeOut = 1 - progress / 0.5;
    const fadeIn = (progress - 0.5) / 0.5;

    if (bgChanges && overlayChanges) {
      if (firstHalf) {
        bgOpacity = fadeOut;
        overlayOpacity = fadeOut;
      } else {
        background = toState.background;
        overlay = toState.overlay;
        overlaySide = toState.side;
        bgOpacity = fadeIn;
        overlayOpacity = fadeIn;
      }
    } else if (bgChanges) {
      if (background == null) {
        background = toState.background;
        bgOpacity = progress;
      } else if (firstHalf) {
        bgOpacity = fadeOut;
      } else {
        background = toState.background;
        bgOpacity = fadeIn;
      }
    } else if (overlayChanges) {
      if (overlay == null) {
        overlay = toState.overlay;
        overlaySide = toState.side;
        overlayOpacity = progress;
      } else if (toState.overlay == null) {
        overlayOpacity = 1 - progress;
      } else if (firstHalf) {
        overlayOpacity = fadeOut;
      } else {
        overlay = toState.overlay;
        overlaySide = toState.side;
        overlayOpacity = fadeIn;
      }
    }
  }

  const bgAsset = background == null ? null : assets[background];
  const overlayAsset = overlay == null ? null : assets[overlay];
  const overlayOffset = offsets[overlay] ?? NO_OFFSET;

  const hasStarted = index >= 0 || transition != null;
  const tooltip = !hasStarted && pointerInside ? "click to start" : null;

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
      {/* <div
        ref={labelRef}
        className="sequence-hover-label"
        style={{ opacity: tooltip ? 1 : 0 }}
        aria-hidden="true"
      >
        {tooltip}
      </div> */}
      <div className="sequence-stage">
        <div className="sequence-slot sequence-slot--background">
          {bgAsset && (
            <SequenceMedia
              key={bgAsset.src}
              asset={bgAsset}
              style={{ opacity: bgOpacity }}
            />
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
              key={overlayAsset.src}
              asset={overlayAsset}
              style={{ opacity: overlayOpacity }}
            />
          </div>
        )}
      </div>
    </>
  );
}

function SequenceMedia({ asset, style }) {
  const cropStyle = asset.position ? { objectPosition: asset.position } : null;

  if (asset.layers.length === 0) {
    return (
      <MediaElement
        asset={asset}
        className="sequence-media"
        style={{ ...style, ...cropStyle }}
      />
    );
  }

  return (
    <div
      className="sequence-media sequence-media--layered"
      style={style}
      data-label={asset.label}
    >
      <MediaElement
        asset={asset}
        className="sequence-layer-base"
        style={cropStyle}
      />
      {asset.layers.map((layer) => (
        <MediaElement
          key={layer.src}
          asset={layer}
          className="sequence-layer"
        />
      ))}
    </div>
  );
}

function MediaElement({ asset, className, style }) {
  if (asset.type === "video") {
    return (
      <video
        className={className}
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
      className={className}
      style={style}
      src={asset.src}
      alt={asset.alt}
      data-label={asset.label}
    />
  );
}
