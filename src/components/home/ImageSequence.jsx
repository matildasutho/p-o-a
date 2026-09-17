"use client";

import { useEffect, useRef, useState } from "react";

const TURNS = ["background", "overlay"];

const REVEAL_DISTANCE = 500;

export default function ImageSequence({ assets }) {
  const total = assets.length;

  const [committed, setCommitted] = useState(() => ({
    background: total > 0 ? 0 : null,
    overlaySide: null,
    overlayAsset: null,
  }));
  const [pendingProgress, setPendingProgress] = useState(0);

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
              next = { background: 0, overlaySide: null, overlayAsset: null };
              continue;
            }
            const turn = TURNS[i % TURNS.length];
            if (turn === "background") {
              next = { ...next, background: posInLoop };
            } else {
              const side = next.overlaySide === "right" ? "left" : "right";
              next = { ...next, overlaySide: side, overlayAsset: posInLoop };
            }
          }
          return next;
        });
        revealedCount.current = targetRevealedCount;
      }

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
  }, [total]);

  if (total === 0) {
    return <div className="sequence-stage" />;
  }

  const posInLoop = revealedCount.current % total;
  const isResetTransition = posInLoop === 0;
  const pendingTurn = TURNS[revealedCount.current % TURNS.length];
  const pendingAssetIndex = isResetTransition ? 0 : posInLoop;
  const pendingAsset = assets[pendingAssetIndex];
  const pendingSide = committed.overlaySide === "right" ? "left" : "right";

  const currentAssetNumber = ((revealedCount.current - 1) % total) + 1;
  const counterLabel = String(currentAssetNumber).padStart(2, "0");

  // Work out what the background layer and the single overlay layer should
  // render this frame, as plain values, before turning them into markup.
  let bgAsset = assets[committed.background];
  let bgOpacity = 1;
  let overlaySide = committed.overlaySide;
  let overlayAsset =
    committed.overlayAsset == null ? null : assets[committed.overlayAsset];
  let overlayOpacity = overlayAsset ? 1 : 0;

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
    if (pendingProgress < 0.5) {
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
      overlayOpacity = pendingProgress;
    } else if (pendingProgress < 0.5) {
      overlayOpacity = 1 - pendingProgress / 0.5;
    } else {
      overlaySide = pendingSide;
      overlayAsset = pendingAsset;
      overlayOpacity = (pendingProgress - 0.5) / 0.5;
    }
  }

  return (
    <>
      <div className="sequence-counter">{counterLabel}</div>
      <div className="sequence-stage">
        <div className="sequence-slot sequence-slot--background">
          <SequenceMedia asset={bgAsset} style={{ opacity: bgOpacity }} />
        </div>
        {overlayAsset && (
          <div className={`sequence-slot sequence-slot--${overlaySide}`}>
            <SequenceMedia
              asset={overlayAsset}
              style={{ opacity: overlayOpacity }}
            />
          </div>
        )}
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
