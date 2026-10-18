import Link from "next/link";
export default function NotFound() {
  return <main className="not-found"><span className="eyebrow mono">&#123; 404 / NOT FOUND &#125;</span><h1>页面不存在<span className="title-dot">.</span></h1><Link href="/">返回首页 →</Link></main>;
}
