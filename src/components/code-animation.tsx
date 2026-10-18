"use client";

import { useEffect, useRef, useState } from "react";

import { loginCode as source } from "@/lib/login-code";

const initialCount = source.split("\n").slice(0, 40).join("\n").length;

function highlight(line: string) {
  return line.split(/('.*?'|\/\/.*$|\b(?:const|class|readonly|async|await|return|new|true)\b)/g).map((part, index) => {
    const type = part.startsWith("'") ? "string" : /^(const|class|readonly|async|await|return|new|true)$/.test(part) ? "keyword" : "plain";
    return <span key={index} className={`code-${type}`}>{part}</span>;
  });
}

export function CodeAnimation() {
  const [count, setCount] = useState(initialCount);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let position = initialCount;
    const type = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      if (reduced.matches) { setCount(source.length); return; }
      position = position >= source.length ? initialCount : Math.min(position + 3, source.length);
      setCount(position);
      timer = setTimeout(type, position === source.length ? 3200 : 36);
    };
    // 后台标签暂停输入；减少动态效果时直接展示完整代码。
    type();
    document.addEventListener("visibilitychange", type);
    reduced.addEventListener("change", type);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", type);
      reduced.removeEventListener("change", type);
    };
  }, []);

  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [count]);

  const lines = source.slice(0, count).split("\n");
  return <div className="code-animation" ref={viewport} aria-hidden="true" data-typed={count}>
    <pre>{lines.map((line, index) => <span className="code-line" key={index}>
      <span className="code-number">{index + 1}</span><code>{highlight(line)}{index === lines.length - 1 && <span className="code-cursor" />}</code>
    </span>)}</pre>
  </div>;
}
