"use client";

import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className={isHome ? "header--pinned" : undefined}>
      <p className={isHome ? "header--overlay" : undefined}>
        <a href="/">
          <strong>P-O-A</strong>
        </a>{" "}
        is a research-led design studio based in Naarm, Melbourne. We design
        objects and experiences that are thoughtful, engaging, enduring and
        sensitive to context. <a href="/information">Information</a> / Contact
      </p>
    </header>
  );
}
