"use client";

import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className={isHome ? "header--pinned" : undefined}>
      <nav className={`site-nav${isHome ? " header--overlay" : ""}`}>
        {pathname === "/information" ? (
          <a href="/">P-O-A</a>
        ) : (
          <a href="/information">Information</a>
        )}
      </nav>
      {isHome && (
        <p className="site-intro header--overlay">
          <a href="/">P-O-A</a> is a research-led design studio.
        </p>
      )}
    </header>
  );
}
