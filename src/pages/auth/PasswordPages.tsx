import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { homeFor, useAuth } from "../../auth/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { Button, ErrorNote, Input } from "../../components/ui";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-gold-300">{title}</h1>
          <p className="mt-1 text-sm text-stone-400">{subtitle}</p>
        </div>
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">{children}</div>
      </div>
    </div>
  );
}

/** Two steps on one page: ask for a code by email, then set a new password with it. */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post("/auth/request-password-reset", { email: email.trim() });
      setStep("reset");
    });
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post("/auth/reset-password", { email: email.trim(), otp: otp.trim(), newPassword: password });
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true });
    });
  };

  return (
    <Shell title="Reset your password" subtitle={step === "email" ? "We'll email you a 6-digit code." : `Enter the code we sent to ${email}.`}>
      {error && <ErrorNote>{error}</ErrorNote>}
      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy}>Send code</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <Input label="6-digit code" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          <Input label="New password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
      <p className="text-center text-sm"><Link to="/login" className="text-gold-700 hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

/** Shown after first login with a temporary password. */
export function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.patch("/auth/change-password", { currentPassword: current, newPassword: next });
      await refreshUser();
      toast.success("Password changed");
      navigate(user ? homeFor(user.role) : "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Choose a new password" subtitle={user?.mustChangePassword ? "For your security, replace the temporary password." : "Update your password."}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Input label="Current (temporary) password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="New password" type="password" minLength={8} required autoComplete="new-password" hint="At least 8 characters" value={next} onChange={(e) => setNext(e.target.value)} />
        <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy}>Save password</Button>
      </form>
      <button onClick={() => void logout()} className="block w-full text-center text-sm text-stone-500 hover:underline">Sign out</button>
    </Shell>
  );
}
