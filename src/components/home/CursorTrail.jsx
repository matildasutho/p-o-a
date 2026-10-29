"use client";

import { useEffect, useRef } from "react";

const TRAIL_LIFETIME_MS = 15000;
const TRAIL_WIDTH = 0.5;

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

      for (let i = 1; i < points.length; i += 1) {
        const from = points[i - 1];
        const to = points[i];
        if (to.isBreak) continue;
        const life = 1 - (now - to.time) / TRAIL_LIFETIME_MS;
        context.strokeStyle = `rgba(255, 255, 255, ${life})`;
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
