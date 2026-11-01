import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../../auth/AuthContext";
import { errorMessage } from "../../lib/api";
import { Button, ErrorNote, Input } from "../../components/ui";
import BrandMark from "../../components/BrandMark";
import { useBrand } from "../../layouts/StaffLayout";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: brand } = useBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && !user.mustChangePassword) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(u.mustChangePassword ? "/change-password" : from?.startsWith("/app") ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto mb-4 size-20" />
          <h1 className="font-display text-3xl font-semibold text-gold-300">{brand?.name ?? "Welcome"}</h1>
          <p className="mt-1 text-sm tracking-widest text-stone-400 uppercase">Staff sign in</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          {error && <ErrorNote>{error}</ErrorNote>}
          <Input label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" className="w-full" variant="gold" loading={busy}>
            Sign in
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-gold-700 hover:underline">Forgot your password?</Link>
          </p>
        </form>
        <p className="mt-6 text-center text-sm text-stone-400">
          <Link to="/" className="hover:text-white">← Back to booking site</Link>
        </p>
      </div>
    </div>
  );
}
