"use client";

import { useCallback, useEffect, useState } from "react";
import ImageSequence from "./ImageSequence";
import IntroLoader from "./IntroLoader";
import LoadingScreen from "./LoadingScreen";

const CLOSE_TRANSITION_MS = 600;

// How long the page must sit untouched (no mouse, scroll, key, or touch)
// before the phrase screen reappears as an idle overlay.
const IDLE_DELAY_MS = 15000;
// Once the user starts wiping words away, how long they can keep moving
// before the overlay fades out again (resets on every activity event, so
// it only starts counting down once they pause).
const IDLE_DISMISS_MS = 1000;

export default function HomeExperience({ assets }) {
  const [imagesReady, setImagesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [idleShown, setIdleShown] = useState(false);
  const [idleClosing, setIdleClosing] = useState(false);
  const [idleKey, setIdleKey] = useState(0);

  useEffect(() => {
    const images = assets.filter((asset) => asset.type === "image");
    if (images.length === 0) {
      setImagesReady(true);
      return undefined;
    }

    let remaining = images.length;
    let cancelled = false;

    function handleSettled() {
      remaining -= 1;
      if (!cancelled && remaining <= 0) setImagesReady(true);
    }

    images.forEach((asset) => {
      const img = new Image();
      img.onload = handleSettled;
      img.onerror = handleSettled;
      img.src = asset.src;
    });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  const handleIntroDone = useCallback(() => setLoading(false), []);

  useEffect(() => {
    if (!loading) return undefined;
    document.body.classList.add("loading-active");
    return () => document.body.classList.remove("loading-active");
  }, [loading]);

  useEffect(() => {
    if (loading) return undefined;

    let idleTimer;
    let dismissTimer;

    function scheduleIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIdleKey((key) => key + 1);
        setIdleClosing(false);
        setIdleShown(true);
      }, IDLE_DELAY_MS);
    }

    function handleActivity() {
      scheduleIdle();
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => setIdleClosing(true), IDLE_DISMISS_MS);
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    scheduleIdle();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(dismissTimer);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [loading]);

  useEffect(() => {
    if (!idleClosing) return undefined;
    const timer = setTimeout(() => setIdleShown(false), CLOSE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [idleClosing]);

  return (
    <>
      {loading && <IntroLoader ready={imagesReady} onDone={handleIntroDone} />}
      {idleShown && (
        <LoadingScreen key={idleKey} closing={idleClosing} variant="idle" />
      )}
      <ImageSequence assets={assets} />
    </>
  );
}
