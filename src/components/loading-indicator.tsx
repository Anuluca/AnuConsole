/** 统一读取状态：可见区域仅展示图标，具体状态通过无障碍名称传达。 */
export function LoadingIndicator({ label = "正在加载", compact = false, className = "" }: { label?: string; compact?: boolean; className?: string }) {
  return <div className={`loading-indicator${compact ? " loading-indicator-compact" : ""}${className ? ` ${className}` : ""}`} role="status" aria-label={label}>
    <svg className="loading-indicator-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" opacity=".18" />
      <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
    </svg>
  </div>;
}
