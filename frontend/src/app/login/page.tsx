"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/layout/RoleContext";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useRole();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const responseText = await response.text();
      let result: any = null;
      if (responseText) {
        try { result = JSON.parse(responseText); } catch { /* The API proxy may return a plain-text gateway error. */ }
      }
      if (!response.ok) throw new Error(result?.error || "The CIMS server is unavailable. Start the backend and try again.");
      if (!result?.user) throw new Error("The CIMS server returned an invalid response. Please try again.");
      setCurrentUser(result.user);
      router.push(result.user.role === "PHARMACIST" ? "/pharmacy" : "/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); setSubmitting(false); }
  }

  return <div className="login-page min-h-screen bg-gradient-to-br from-[#F7F6F2] via-[#EAF2EF] to-[#DDE9E6] text-[#172126] flex flex-col p-4">
    <div className="flex flex-1 w-full items-center justify-center py-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className="lf-glass-card login-brand-card rounded-[18px] p-8 lg:p-10 flex flex-col justify-center">
          <div>
            <div className="mb-6 mx-auto h-24 w-24 overflow-hidden rounded-full bg-black shadow-xl"><img src="/clade-analytics-badge.png" alt="Clade Analytics" className="h-full w-full object-cover" /></div>
            <h1 className="login-brand-title text-4xl font-black leading-tight mb-3 text-center">Welcome Back to <span className="text-[#0F766E]">Clade Analytics</span></h1>
            <p className="login-brand-tagline text-center italic text-lg font-semibold tracking-wide text-[#0F766E]">“We build what’s next”</p>
          </div>
        </section>
        <section className="login-form-card lf-glass-pill rounded-[18px] p-8 lg:p-10 border border-white/70 shadow-xl" aria-labelledby="signin-title">
          <div className="mb-8"><p className="login-eyebrow text-xs uppercase tracking-[0.2em] text-[#52615C] mb-2">Staff Login</p><h2 id="signin-title" className="login-title text-2xl font-extrabold text-[#172126]">Sign In</h2></div>
          <form onSubmit={signIn} className="space-y-5">
            <label className="block"><span className="login-label block text-sm font-semibold text-[#45565C] mb-2">Username</span><div className="login-input-wrap"><UserRound size={16} /><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" /></div></label>
            <label className="block"><span className="login-label block text-sm font-semibold text-[#45565C] mb-2">Password</span><div className="login-input-wrap"><LockKeyhole size={16} /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" /></div></label>
            {error && <p className="clade-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full bg-[#0F766E] hover:bg-[#115E59] text-white rounded-[10px] py-3 text-sm font-bold transition">{submitting ? "Signing in…" : <>Sign In to Dashboard <ArrowRight size={16} /></>}</button>
          </form>
          <p className="clade-login-help">Username: <strong>engineer</strong> &nbsp;·&nbsp; Password: <strong>123456</strong></p>
        </section>
      </div>
    </div>
    <footer className="login-footer pb-1 text-center text-xs font-semibold tracking-wide text-[#52615C]">Powered by Clade Analytics</footer>
  </div>;
}
