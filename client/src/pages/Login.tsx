import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email, password); nav("/portfolio"); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/images/pai-logo.png" alt="PaiPalace" className="h-12 w-12 rounded-full" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your PaiPalace account</p>
        </div>

        <div className="card p-7">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required autoFocus />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
            </div>
            {err && <p className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{err}</p>}
            <button className="btn-primary w-full !py-2.5" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          New to PaiPalace? <Link to="/register" className="font-medium text-brand-light hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
