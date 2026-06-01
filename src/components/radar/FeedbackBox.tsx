"use client";

import { memo, useRef, useState } from "react";

const MAX_LEN = 280;

export const FeedbackBox = memo(function FeedbackBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputRef.current?.value.replace(/\s+/g, " ").trim() ?? "";
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
      if (inputRef.current) inputRef.current.value = "";
      setStatus("sent");
      window.setTimeout(() => {
        setStatus("idle");
        setOpen(false);
      }, 1800);
    } catch {
      setStatus("error");
      setError("Network error.");
    }
  }

  if (!open) {
    return (
      <div className="feedback-nudge-wrap">
        <button
          type="button"
          className="feedback-nudge"
          onClick={() => setOpen(true)}
        >
          Fix or add something?
        </button>
      </div>
    );
  }

  return (
    <div className="feedback-nudge-wrap">
      <form
        className="feedback-inline"
        onSubmit={(e) => void handleSubmit(e)}
        aria-label="Feedback"
      >
        <input
          ref={inputRef}
          type="text"
          className="feedback-inline-input"
          name="message"
          maxLength={MAX_LEN}
          placeholder="bug or idea…"
          autoFocus
          disabled={status === "sending"}
          aria-label="Feedback"
        />
        <button
          type="submit"
          className="feedback-inline-send"
          disabled={status === "sending"}
        >
          {status === "sending" ? "…" : "Send"}
        </button>
        <button
          type="button"
          className="feedback-inline-close"
          onClick={() => {
            setOpen(false);
            setStatus("idle");
            setError(null);
          }}
          aria-label="Close"
        >
          ×
        </button>
      </form>
      {status === "sent" ? (
        <p className="feedback-inline-note feedback-inline-note--ok">Sent</p>
      ) : status === "error" && error ? (
        <p className="feedback-inline-note feedback-inline-note--err">{error}</p>
      ) : null}
    </div>
  );
});
