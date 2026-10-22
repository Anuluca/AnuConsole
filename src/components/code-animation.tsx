"use client";

import { memo, useEffect, useState } from "react";

import { loginCode as source } from "@/lib/login-code";

const initialCount = source.split("\n").slice(0, 40).join("\n").length;

function highlight(line: string) {
  return line
    .split(
      /('.*?'|\/\/.*$|\b(?:const|class|readonly|async|await|return|new|true)\b)/g,
    )
    .map((part, index) => {
      const type = part.startsWith("'")
        ? "string"
        : /^(const|class|readonly|async|await|return|new|true)$/.test(part)
          ? "keyword"
          : "plain";
      return (
        <span key={index} className={`code-${type}`}>
          {part}
        </span>
      );
    });
}

// 输入只改变末行；已完成的行不再每 36ms 重复分词、创建高亮节点。
const CodeLine = memo(function CodeLine({
  line,
  number,
  cursor,
}: {
  line: string;
  number: number;
  cursor: boolean;
}) {
  return (
    <span className="code-line">
      <span className="code-number">{number}</span>
      <code>
        {highlight(line)}
        {cursor && <span className="code-cursor" />}
      </code>
    </span>
  );
});

export function CodeAnimation() {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let position = initialCount;
    const type = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      if (reduced.matches) {
        setCount(source.length);
        return;
      }
      position =
        position >= source.length
          ? initialCount
          : Math.min(position + 3, source.length);
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

  const lines = source.slice(0, count).split("\n");
  return (
    <div
      className="code-animation"
      aria-hidden="true"
      data-typed={count}
    >
      <pre>
        {lines.map((line, index) => (
          <CodeLine
            key={index}
            line={line}
            number={index + 1}
            cursor={index === lines.length - 1}
          />
        ))}
      </pre>
    </div>
  );
}
