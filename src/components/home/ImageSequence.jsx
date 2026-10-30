"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEP_DURATION_MS = 500;

// keep in sync with the mobile breakpoint in globals.css
const MOBILE_QUERY = "(max-width: 768px)";

const SWIPE_THRESHOLD_PX = 40;
const WHEEL_THRESHOLD = 30;
const WHEEL_IDLE_MS = 200;
// firefox can report wheel deltas in lines
const WHEEL_LINE_HEIGHT = 16;

const OVERLAY_OFFSET_RATIO = 0.08;
const NO_OFFSET = { x: 0, y: 0 };

const LABEL_CURSOR_GAP = 16;

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

  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState(null);
  const [offsets, setOffsets] = useState({});

  const [hoverLabel, setHoverLabel] = useState(null);
  // last label shown, so the text stays put while the label blurs out
  const [labelText, setLabelText] = useState(null);
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
    const label = media?.dataset.label || null;
    setHoverLabel(label);
    if (label) setLabelText(label);
  }, []);

  useEffect(() => {
    function handlePointerMove(event) {
      if (event.pointerType !== "mouse") return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (labelRef.current) {
        labelRef.current.style.transform = `translate(${
          event.clientX + LABEL_CURSOR_GAP
        }px, ${event.clientY + LABEL_CURSOR_GAP}px)`;
      }
      updateHoverLabel();
    }

    function handlePointerLeave() {
      pointerRef.current = null;
      setHoverLabel(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    document.documentElement.addEventListener(
      "pointerleave",
      handlePointerLeave,
    );
    return () => {
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
    let from = 0;
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
      const next = (from + direction + states.length) % states.length;
      const current = states[from];
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

  const fromState = states[index];
  const toState = transition ? states[transition.to] : null;
  const progress = transition?.progress ?? 0;

  const counterLabel = `${String(fromState.current + 1).padStart(2, "0")} / ${String(
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
      if (firstHalf) {
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

  const bgAsset = assets[background];
  const overlayAsset = overlay == null ? null : assets[overlay];
  const overlayOffset = offsets[overlay] ?? NO_OFFSET;

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
      <div
        ref={labelRef}
        className={`sequence-hover-label${
          hoverLabel ? " sequence-hover-label--visible" : ""
        }`}
        aria-hidden="true"
      >
        {labelText}
      </div>
      <div className="sequence-stage">
        <div className="sequence-slot sequence-slot--background">
          <SequenceMedia
            key={bgAsset.src}
            asset={bgAsset}
            style={{ opacity: bgOpacity }}
          />
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

  const image = (
    <img
      className={className}
      style={style}
      src={asset.src}
      alt={asset.alt}
      data-label={asset.label}
    />
  );

  if (!asset.mobileSrc) return image;

  return (
    <picture className="sequence-picture">
      <source media={MOBILE_QUERY} srcSet={asset.mobileSrc} />
      {image}
    </picture>
  );
}
