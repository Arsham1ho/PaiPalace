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
    try {
      await login(email, password);
      nav("/portfolio");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-7">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to your PaiPalace account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Password</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
          {err && <p className="text-sm text-down">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          No account? <Link to="/register" className="text-pai-cyan">Create one</Link>
        </p>
      </div>
    </div>
  );
}
