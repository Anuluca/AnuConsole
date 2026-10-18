import Link from "next/link";

export function ConsoleIcon() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M8 39 18 13h7l10 26h-7l-2-6h-9l-2 6H8Zm11-12h5l-2.5-8L19 27Z" fill="currentColor" fillRule="evenodd" />
    <path d="M55 18c-3-4-6-5-10-5-7 0-11 5-11 13s4 13 11 13c4 0 7-1 10-5l-4-4c-2 3-3 4-6 4-4 0-5-3-5-8s1-8 5-8c3 0 4 1 6 4l4-4Z" fill="currentColor" />
    <path d="M9 46h46M9 51h32" stroke="currentColor" strokeWidth="2" />
  </svg>;
}

export function Brand({ light = false, href = "/", subtitle = "ANUTRIUM BACKEND" }: { light?: boolean; href?: string; subtitle?: string }) {
  return <Link className={`brand${light ? " brand-light" : ""}`} href={href} aria-label="AnuConsole 首页">
    <span className="brand-symbol" aria-hidden="true"><ConsoleIcon /></span>
    <span className="brand-wordmark">AnuConsole<span aria-label={subtitle}>{Array.from(subtitle, (letter, index) => <span key={index} aria-hidden="true">{letter === " " ? "\u00a0" : letter}</span>)}</span></span>
  </Link>;
}

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={diagonal ? "arrow-diagonal" : undefined}>
    <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" />
  </svg>;
}
