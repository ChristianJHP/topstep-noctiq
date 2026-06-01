"use client";

import { useState } from "react";

const MAX_LEN = 500;

export function FeedbackBox() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;

    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Could not send.");
        return;
      }
      setMessage("");
      setStatus("sent");
      window.setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setError("Network error — try again.");
    }
  }

  return (
    <section className="feedback-box" aria-label="Feedback">
      <header className="feedback-box-head">
        <h2 className="feedback-box-title">Things to fix or add</h2>
        <p className="feedback-box-sub">
          Goes straight to the dev — bugs, ideas, whatever.
        </p>
      </header>
      <form className="feedback-box-form" onSubmit={(e) => void handleSubmit(e)}>
        <textarea
          className="feedback-box-input"
          name="message"
          rows={3}
          maxLength={MAX_LEN}
          placeholder="e.g. session highs not showing on 4H chart…"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          disabled={status === "sending"}
          aria-label="Feedback message"
        />
        <div className="feedback-box-foot">
          <span className="feedback-box-count" aria-live="polite">
            {status === "sent" ? (
              <span className="feedback-box-ok">Sent — thanks.</span>
            ) : status === "error" && error ? (
              <span className="feedback-box-err">{error}</span>
            ) : (
              `${message.length}/${MAX_LEN}`
            )}
          </span>
          <button
            type="submit"
            className="feedback-box-send"
            disabled={!message.trim() || status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
