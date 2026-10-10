"use client";

import { useEffect, useRef } from "react";

// How long each bit of the line stays on screen before it has fully faded.
const TRAIL_LIFETIME_MS = 15000;
// Line thickness in CSS pixels. Drawn at device resolution, so 0.5 is a
// single hairline pixel on retina screens.
const TRAIL_WIDTH = 0.5;

// A very fine white line that follows the mouse and fades away behind it.
// Uses the same difference blend as the label so it reads on any image.
export default function CursorTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;

    const context = canvas.getContext("2d");
    let points = [];
    let frame = null;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(now) {
      points = points.filter((point) => now - point.time < TRAIL_LIFETIME_MS);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.lineWidth = TRAIL_WIDTH;
      context.lineCap = "round";
      context.lineJoin = "round";

      // Each segment fades on its own, so the tail dissolves while the
      // newest part of the line stays crisp.
      for (let i = 1; i < points.length; i += 1) {
        const from = points[i - 1];
        const to = points[i];
        if (to.isBreak) continue;
        const life = 1 - (now - to.time) / TRAIL_LIFETIME_MS;
        context.strokeStyle = `rgba(0, 0, 0, ${life})`;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }

      frame = points.length > 0 ? requestAnimationFrame(draw) : null;
    }

    let isOutside = true;

    function handlePointerMove(event) {
      if (event.pointerType !== "mouse") return;
      points.push({
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        // Don't join the line across a jump in and out of the window.
        isBreak: isOutside,
      });
      isOutside = false;
      if (frame === null) frame = requestAnimationFrame(draw);
    }

    function handlePointerLeave() {
      isOutside = true;
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    document.documentElement.addEventListener(
      "pointerleave",
      handlePointerLeave,
    );
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        handlePointerLeave,
      );
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" />;
}
