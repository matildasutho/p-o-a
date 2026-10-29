"use client";

import { useEffect } from "react";

const LEAVE_MS = 80;

export default function PageTransitions() {
  useEffect(() => {
    let timer = null;

    function handleClick(event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search)
      )
        return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      event.preventDefault();
      document.body.classList.add("page-leaving");
      clearTimeout(timer);
      timer = setTimeout(() => window.location.assign(url.href), LEAVE_MS);
    }

    function handlePageShow(event) {
      // restored from back/forward cache
      if (event.persisted) document.body.classList.remove("page-leaving");
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
