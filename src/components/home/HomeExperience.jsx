"use client";

import { useCallback, useEffect, useState } from "react";
import ImageSequence from "./ImageSequence";
import IntroLoader from "./IntroLoader";

// Some browsers (notably iOS Safari) won't fully buffer a video before a user
// gesture, so a video that hasn't settled by then stops holding up the intro.
const VIDEO_PRELOAD_TIMEOUT_MS = 15000;

export default function HomeExperience({ assets }) {
  const [assetsReady, setAssetsReady] = useState(assets.length === 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assets.length === 0) return undefined;

    let remaining = assets.length;
    let cancelled = false;
    const videos = [];
    const timers = [];

    assets.forEach((asset) => {
      // A video can both time out and later load, so only count it once.
      let settled = false;
      function handleSettled() {
        if (settled) return;
        settled = true;
        remaining -= 1;
        if (!cancelled && remaining <= 0) setAssetsReady(true);
      }

      if (asset.type === "video") {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.addEventListener("canplaythrough", handleSettled, { once: true });
        video.addEventListener("error", handleSettled, { once: true });
        video.src = asset.src;
        video.load();
        videos.push(video);
        timers.push(setTimeout(handleSettled, VIDEO_PRELOAD_TIMEOUT_MS));
        return;
      }

      const img = new Image();
      img.onload = handleSettled;
      img.onerror = handleSettled;
      img.src = asset.src;
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      videos.forEach((video) => {
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [assets]);

  const handleIntroDone = useCallback(() => setLoading(false), []);

  useEffect(() => {
    if (!loading) return undefined;
    document.body.classList.add("loading-active");
    return () => document.body.classList.remove("loading-active");
  }, [loading]);

  return (
    <>
      {loading && <IntroLoader ready={assetsReady} onDone={handleIntroDone} />}
      <ImageSequence assets={assets} />
    </>
  );
}
