"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const result = await signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message ?? "Sign up failed");
          return;
        }
      } else {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message ?? "Sign in failed");
          return;
        }
      }
      router.push("/decks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card login-card" style={{ maxWidth: 420, margin: "4rem auto" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Kiri</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          STEM flashcards for pre-med and science coursework
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input
              className="input"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: "1.5rem", textAlign: "center" }}>
          {mode === "signin" ? "No account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.5rem", marginLeft: "0.5rem" }}
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
