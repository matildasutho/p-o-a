"use client";

import { useEffect } from "react";

import IdleScreen from "./IdleScreen";
import ImageSequence from "./ImageSequence";

export default function HomeExperience({ assets }) {
  // warm the cache so later steps in the sequence don't stall
  useEffect(() => {
    const videos = [];

    assets
      .flatMap((asset) => [asset, ...asset.layers])
      .forEach((asset) => {
        if (asset.type === "video") {
          const video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.src = asset.src;
          video.load();
          videos.push(video);
          return;
        }

        const img = new Image();
        img.src = asset.src;
      });

    return () => {
      videos.forEach((video) => {
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [assets]);

  return (
    <>
      <ImageSequence assets={assets} />
      <IdleScreen />
    </>
  );
}
