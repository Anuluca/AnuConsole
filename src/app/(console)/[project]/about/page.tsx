import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { Brand } from "@/components/brand";

export const metadata = { title: "关于" };

const githubUrl = "https://github.com/Anuluca/AnuConsole";

export default async function AboutPage({ params }: { params: Promise<{ project: string }> }) {
  // 关于页同样先验证登录身份，再读取项目内容。
  await requireUser();
  const project = getProject((await params).project);
  if (!project) notFound();

  const isAnutrium = project.id === "anutrium";

  return <section className="about-page" aria-label="关于内容区">
    <div className="about-intro">
      <h2><Brand href={`/${project.id}`} subtitle="PROJECT BACKEND" /></h2>
      <p>AnuConsole 是 Anutrium 等多个项目的管理后台。</p>
      <div className="about-contact">
        <span>开发者：Anuluca</span>
        <a href="mailto:tilucario@outlook.com">邮件反馈：tilucario@outlook.com</a>
      </div>
      <div className="about-links" aria-label="相关链接">
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 AnuConsole GitHub 仓库">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.07c-3.1.68-3.75-1.32-3.75-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.77 2.08 3.26 1.48.1-.73.4-1.23.72-1.51-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.43-2.22 1.15-3-.11-.28-.5-1.42.11-2.96 0 0 .94-.3 3.06 1.14A10.7 10.7 0 0 1 12 6.12c.94 0 1.88.13 2.76.37 2.12-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.12 2.96.72.78 1.14 1.78 1.14 3 0 4.27-2.6 5.22-5.08 5.5.4.34.76 1.02.76 2.06v3.12c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" /></svg>
          <span>GitHub · AnuConsole</span>
        </a>
        {isAnutrium && project.siteUrl && <a href={project.siteUrl} target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 Anutrium 网站">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9m0-18c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9" /></svg>
          <span>Anutrium</span>
        </a>}
      </div>
    </div>
  </section>;
}
