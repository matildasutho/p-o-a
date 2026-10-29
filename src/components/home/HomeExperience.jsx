"use client";

import { useCallback, useEffect, useState } from "react";
import CursorTrail from "./CursorTrail";
import ImageSequence from "./ImageSequence";
import IntroLoader from "./IntroLoader";
import { INTRO_SEEN_COOKIE } from "@/lib/intro";

// Some browsers (notably iOS Safari) won't fully buffer a video before a user
// gesture, so a video that hasn't settled by then stops holding up the intro.
const VIDEO_PRELOAD_TIMEOUT_MS = 15000;

// The splash plays once per browser session. Once it has finished, a session
// cookie tells the server to render home without it, which covers refreshes
// and typed URLs.

// Within a single page load it also never plays when arriving by a link from
// another page of the site, or on coming back to home later in the same
// visit. A client-side navigation keeps this module alive, so the flag
// survives it.
let homeShownThisDocument = false;

function isDocumentEntryPage() {
  const [entry] = performance.getEntriesByType("navigation");
  if (!entry) return true;
  return new URL(entry.name).pathname === window.location.pathname;
}

function shouldSkipIntro() {
  // On the server, and while hydrating a full page load, this is always false.
  if (typeof window === "undefined") return false;
  return homeShownThisDocument || !isDocumentEntryPage();
}

export default function HomeExperience({ assets, introSeen = false }) {
  const [assetsReady, setAssetsReady] = useState(assets.length === 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assets.length === 0) return undefined;

    // Layered assets (e.g. the Post Hoc gif) need loading too.
    const files = assets.flatMap((asset) => [asset, ...asset.layers]);
    let remaining = files.length;
    let cancelled = false;
    const videos = [];
    const timers = [];

    files.forEach((asset) => {
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

  const [introSkipped] = useState(() => introSeen || shouldSkipIntro());

  useEffect(() => {
    homeShownThisDocument = true;
  }, []);

  const showIntro = loading && !introSkipped;

  const handleIntroDone = useCallback(() => {
    document.cookie = `${INTRO_SEEN_COOKIE}=1; path=/; SameSite=Lax`;
    setLoading(false);
  }, []);

  // Hides the page text under the loader; removing the class blurs it in.
  useEffect(() => {
    if (!showIntro) return undefined;
    document.body.classList.add("loading-active");
    return () => document.body.classList.remove("loading-active");
  }, [showIntro]);

  return (
    <>
      {showIntro && <IntroLoader ready={assetsReady} onDone={handleIntroDone} />}
      <ImageSequence assets={assets} />
      {/* Held back until the intro has finished so it only draws over the sequence. */}
      {!showIntro && <CursorTrail />}
    </>
  );
}
