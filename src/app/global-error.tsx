"use client";

// Last-resort boundary for errors in the root layout itself. It replaces the whole
// document, so it can't rely on the app's providers or stylesheet.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#18181b" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", color: "#52525b", fontSize: 14 }}>
            The app hit an unexpected error. Try again, and if it keeps happening, share the reference below with your administrator.
          </p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d4d4d8", background: "#fff", cursor: "pointer", fontSize: 14 }}>
            Try again
          </button>
          {error.digest ? <p style={{ marginTop: 16, fontSize: 12, color: "#71717a" }}>Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
