type RelatedLink = { label: string; href: string };

export function RelatedLinks({ label, links }: { label: string; links: readonly RelatedLink[] }) {
  return <nav className="monitor-related-links" aria-label={label}>
    <ul>{links.map(link => <li key={link.href}>
      <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${link.label}（在新标签页打开）`}>
        <span>{link.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
      </a>
    </li>)}</ul>
  </nav>;
}
