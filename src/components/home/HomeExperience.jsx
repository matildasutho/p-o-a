"use client";

import { useCallback, useEffect, useState } from "react";
import CursorTrail from "./CursorTrail";
import ImageSequence from "./ImageSequence";
import IntroLoader from "./IntroLoader";
import { INTRO_SEEN_COOKIE } from "@/lib/intro";

// iOS Safari won't buffer video before a tap
const VIDEO_PRELOAD_TIMEOUT_MS = 15000;

let homeShownThisDocument = false;

function isDocumentEntryPage() {
  const [entry] = performance.getEntriesByType("navigation");
  if (!entry) return true;
  return new URL(entry.name).pathname === window.location.pathname;
}

function shouldSkipIntro() {
  if (typeof window === "undefined") return false;
  return homeShownThisDocument || !isDocumentEntryPage();
}

export default function HomeExperience({ assets, introSeen = false }) {
  const [assetsReady, setAssetsReady] = useState(assets.length === 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assets.length === 0) return undefined;

    const files = assets.flatMap((asset) => [asset, ...asset.layers]);
    let remaining = files.length;
    let cancelled = false;
    const videos = [];
    const timers = [];

    files.forEach((asset) => {
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

  const [introSkipped] = useState(() => introSeen || shouldSkipIntro());

  useEffect(() => {
    homeShownThisDocument = true;
  }, []);

  const showIntro = loading && !introSkipped;

  const handleIntroDone = useCallback(() => {
    document.cookie = `${INTRO_SEEN_COOKIE}=1; path=/; SameSite=Lax`;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;
    document.body.classList.add("loading-active");
    return () => document.body.classList.remove("loading-active");
  }, [showIntro]);

  return (
    <>
      {showIntro && <IntroLoader ready={assetsReady} onDone={handleIntroDone} />}
      <ImageSequence assets={assets} />
      {!showIntro && <CursorTrail />}
    </>
  );
}
