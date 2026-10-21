"use client";
export default function RequestError({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h2>Something interrupted your workspace.</h2>
      <p>Please try again. Your saved requests are still in your account.</p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
