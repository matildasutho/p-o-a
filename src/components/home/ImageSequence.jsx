"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// How long one step's fade takes.
const STEP_DURATION_MS = 500;

// How far a finger has to travel before it counts as a swipe rather than a
// tap. Taps go through the click handler like a mouse click.
const SWIPE_THRESHOLD_PX = 40;
// Trackpad/wheel distance that counts as one swipe. Trackpads keep sending
// momentum events after the fingers lift, so once a step fires the wheel is
// ignored until it has gone quiet for WHEEL_IDLE_MS.
const WHEEL_THRESHOLD = 30;
const WHEEL_IDLE_MS = 200;
// Firefox can report wheel deltas in lines rather than pixels.
const WHEEL_LINE_HEIGHT = 16;

// Each overlay image is placed once, when it appears, nudged up or down from
// its usual spot by this fraction of the cursor's vertical distance from the
// screen centre. It then stays put until it clears.
const OVERLAY_OFFSET_RATIO = 0.08;
const NO_OFFSET = { x: 0, y: 0 };

// Gap between the cursor and the floating asset label.
const LABEL_CURSOR_GAP = 16;
// Spring the label uses to chase the cursor. Lower stiffness trails further
// behind. Damping is how much speed the label keeps each frame: lower values
// settle sooner with less overshoot, higher values wobble more.
const LABEL_SPRING_STIFFNESS = 1;
const LABEL_SPRING_DAMPING = 0.1;

const BLANK = { background: null, overlay: null, side: null, current: null };

// The states the sequence steps through, following
// SEQUENCING_TRANSITION_Oct26.pdf: a small asset fades in over the full-screen
// one, the full-screen asset changes underneath it, then the small asset
// clears so the new full-screen one is seen on its own. Small assets alternate
// sides, starting on the right. After the last state it loops back to the
// first. `current` is the asset the counter shows.
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

  // -1 is the bare page before the first click.
  const [index, setIndex] = useState(-1);
  // The step currently fading in, if any: { to, progress }.
  const [transition, setTransition] = useState(null);
  // Where each overlay asset was placed, keyed by its index in `assets`.
  const [offsets, setOffsets] = useState({});

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

  useEffect(() => {
    if (total === 0) return undefined;

    let frame = null;
    let startTime = 0;
    // Local copies of `index` and `transition.to`, so handlers don't need to
    // re-subscribe every frame.
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

    // Moves one state forward (1) or back (-1). `point` is where the gesture
    // happened, used to nudge a newly appearing overlay.
    function step(direction, point) {
      // A gesture mid-fade snaps the current step to its end first.
      if (frame !== null) finishStep();
      if (from < 0 && direction < 0) return;
      const next =
        from < 0 ? 0 : (from + direction + states.length) % states.length;
      const current = from < 0 ? BLANK : states[from];
      const target = states[next];

      if (target.overlay != null && target.overlay !== current.overlay) {
        // Vertical only, so the gap to the screen edge is always the grid
        // margin on both sides.
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

    // Swipe left or up for the next step, right or down to go back.
    let touchStart = null;

    function handleTouchStart(event) {
      touchStart =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    }

    function handleTouchMove(event) {
      // Stops the page bouncing or pull-to-refresh fighting the swipe, while
      // leaving pinch-zoom alone.
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

    // Trackpad swipes and mouse wheels: right or down for the next step, left
    // or up to go back.
    let wheelDistance = 0;
    let wheelLocked = false;
    let wheelTimer = null;

    function handleWheel(event) {
      // Pinch-to-zoom on a trackpad arrives as a wheel event with ctrlKey.
      if (event.ctrlKey) return;
      // Otherwise a sideways swipe would also trigger the browser's back/
      // forward navigation.
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

  // Work out what the background layer and the single overlay layer should
  // render this frame, as plain values, before turning them into markup.
  // Anything being replaced fades out over the first half of the step and its
  // replacement fades in over the second, so the two are never both visible.
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
      // Looping back to the start: everything visible fades out together,
      // then the first state fades in.
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
        // Nothing to fade out yet, so the first asset fades straight in.
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
        // Clearing to the full-screen asset on its own.
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

  // Before the first click the tooltip prompts to start. Asset labels are
  // switched off for now, so once the sequence starts it stays hidden.
  const hasStarted = index >= 0 || transition != null;
  const tooltip = !hasStarted && pointerInside ? "click to start" : null;

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
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

  // Layers (e.g. the Post Hoc gif) fade with their base as one, and multiply
  // over it so their white background drops out.
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
