import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function Login() {
  const { admin, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm">
        <div className="mb-6 font-serif text-xl font-semibold text-ink">
          DonPion
          <span className="ml-1 text-sm font-normal text-graphite">админ</span>
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Логин</span>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="admin@flowershop.uz"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Пароль</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="mb-4 text-sm text-hermes-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
