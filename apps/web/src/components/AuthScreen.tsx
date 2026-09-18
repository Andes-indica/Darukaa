import { type FormEvent, useState } from "react";

import { ApiError, login, register } from "../lib/api";
import type { AuthResponse } from "../types";

interface AuthScreenProps {
  onAuthenticated: (response: AuthResponse) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response =
        mode === "login"
          ? await login(email, password)
          : await register(email, fullName, password);
      onAuthenticated(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to reach the server",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>
            Darukaa<span>.Earth</span>
          </span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow light">Geospatial intelligence</span>
          <h1>Turn environmental data into measurable action.</h1>
          <p>
            Map projects, monitor restoration sites, and communicate carbon and
            biodiversity outcomes from one workspace.
          </p>
        </div>
        <div className="auth-proof">
          <span>
            <b>PostGIS</b> spatial analysis
          </span>
          <span>
            <b>Secure</b> project workspace
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">Administrator access</span>
          <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p>
            {mode === "login"
              ? "Sign in to manage your environmental portfolio."
              : "Set up the administrator account for your portfolio."}
          </p>

          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => changeMode("login")}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => changeMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
