import { redirect } from "next/navigation";
import { authConfigured, isAuthenticated } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { CodeAnimation } from "@/components/code-animation";
import { LoginForm } from "@/components/login-form";
import { ThemeSwitch } from "@/components/theme-provider";

export const metadata = { title: "管理员登录" };

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/");
  return <main className="login-page">
    <section className="login-art" aria-label="AnuConsole">
      <Brand light />
      <CodeAnimation />
    </section>
    <section className="login-panel">
      <div className="login-tools"><ThemeSwitch /></div>
      <div className="login-panel-inner">
        <h1 className="login-title"><span>DRIVEN BY</span>{" "}<span>CONSOLE.</span></h1>
        <LoginForm configured={authConfigured()} />
      </div>
      <footer className="login-footer mono"><span>© {new Date().getFullYear()} ANUCONSOLE</span></footer>
    </section>
  </main>;
}
