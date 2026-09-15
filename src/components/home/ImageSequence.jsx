"use client";

import { useEffect, useRef, useState } from "react";

const SLOTS = ["background", "right", "left"];

// Scroll travel (px) needed to fully fade the next image in. Its opacity is
// set directly from scroll distance every scroll event (no CSS animation),
// so the image visibly scrolls in rather than popping in and animating on
// a timer. Scrolling further/faster covers this faster; direction doesn't
// matter, so scrolling up still advances the sequence — never reverses it.
const REVEAL_DISTANCE = 300;

export default function ImageSequence({ assets }) {
  const total = assets.length;

  const [committed, setCommitted] = useState(() => ({
    background: total > 0 ? 0 : null,
    right: null,
    left: null,
  }));
  const [pendingProgress, setPendingProgress] = useState(0);

  // The commit index about to happen (0 is the pre-filled background, so
  // this starts at 1). Position within the current pass through the whole
  // asset list is `i % total`; when that wraps to 0 it's not a "clean loop"
  // — everything on screen fades out together first, then only the
  // background fades the first image back in, exactly like the initial load.
  const revealedCount = useRef(total > 0 ? 1 : 0);
  const totalDistance = useRef(0);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (total === 0) return undefined;

    lastScrollY.current = window.scrollY;

    function handleScroll() {
      const scrollY = window.scrollY;
      totalDistance.current += Math.abs(scrollY - lastScrollY.current);
      lastScrollY.current = scrollY;

      const units = totalDistance.current / REVEAL_DISTANCE;
      const targetRevealedCount = 1 + Math.floor(units);

      if (targetRevealedCount > revealedCount.current) {
        const startIndex = revealedCount.current;
        setCommitted((prev) => {
          let next = prev;
          for (let i = startIndex; i < targetRevealedCount; i += 1) {
            const posInLoop = i % total;
            if (posInLoop === 0) {
              next = { background: 0, right: null, left: null };
            } else {
              const slot = SLOTS[posInLoop % SLOTS.length];
              next = { ...next, [slot]: posInLoop };
            }
          }
          return next;
        });
        revealedCount.current = targetRevealedCount;
      }

      setPendingProgress(units - Math.floor(units));
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [total]);

  if (total === 0) {
    return <div className="sequence-stage" />;
  }

  const posInLoop = revealedCount.current % total;
  const isResetTransition = posInLoop === 0;
  const pendingSlot = isResetTransition ? "background" : SLOTS[posInLoop % SLOTS.length];
  const pendingAssetIndex = isResetTransition ? 0 : posInLoop;
  const pendingAsset = assets[pendingAssetIndex];

  // Ticks up once an image has fully settled, not mid-fade — the most
  // recently committed image, wrapping (with the reset above) as the
  // sequence completes a pass through every image.
  const currentAssetNumber = ((revealedCount.current - 1) % total) + 1;
  const counterLabel = String(currentAssetNumber).padStart(2, "0");

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
      <div className="sequence-stage">
        {SLOTS.map((slot) => {
          const committedIndex = committed[slot];
          const committedAsset =
            committedIndex == null ? null : assets[committedIndex];

          if (isResetTransition) {
            if (pendingProgress < 0.5) {
              // Everything currently visible fades out together.
              if (!committedAsset) return null;
              return (
                <div key={slot} className={`sequence-slot sequence-slot--${slot}`}>
                  <SequenceMedia
                    asset={committedAsset}
                    style={{ opacity: 1 - pendingProgress / 0.5 }}
                  />
                </div>
              );
            }
            // Then only the background fades the first image back in.
            if (slot !== "background") return null;
            return (
              <div key={slot} className="sequence-slot sequence-slot--background">
                <SequenceMedia
                  asset={assets[0]}
                  style={{ opacity: (pendingProgress - 0.5) / 0.5 }}
                />
              </div>
            );
          }

          const isTransitioning =
            slot === pendingSlot && pendingAssetIndex !== committedIndex;

          if (!committedAsset && !isTransitioning) return null;

          let asset = committedAsset;
          let opacity = 1;

          if (isTransitioning) {
            if (!committedAsset) {
              // Nothing occupying this slot yet — fade the first image in
              // across the whole window instead of wasting half of it.
              asset = pendingAsset;
              opacity = pendingProgress;
            } else if (pendingProgress < 0.5) {
              // First half: the outgoing image fades away to nothing.
              asset = committedAsset;
              opacity = 1 - pendingProgress / 0.5;
            } else {
              // Second half: the incoming image fades in from nothing.
              asset = pendingAsset;
              opacity = (pendingProgress - 0.5) / 0.5;
            }
          }

          return (
            <div key={slot} className={`sequence-slot sequence-slot--${slot}`}>
              <SequenceMedia asset={asset} style={{ opacity }} />
            </div>
          );
        })}
      </div>
      <div className="sequence-scroll-spacer" aria-hidden="true" />
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
    />
  );
}
