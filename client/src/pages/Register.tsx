import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await register(email, username, password);
      nav("/wallet");
    } catch (e: any) {
      setErr(typeof e.message === "string" ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-7">
        <h1 className="text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-400">A custodial wallet address is generated for you automatically.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Password</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required />
          </div>
          {err && <p className="text-sm text-down">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already have an account? <Link to="/login" className="text-pai-cyan">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
