import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state not-found">
      <span className="eyebrow">404 · REQUEST NOT FOUND</span>
      <h1>This request isn’t available.</h1>
      <p>It may not exist, or you may be signed in to a different account.</p>
      <Link className="primary-button" href="/">
        Back to your requests
      </Link>
    </div>
  );
}
