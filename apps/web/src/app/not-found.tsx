import Link from "next/link";

export default function NotFound() {
  return (
    <div className="nf-page">
      <p className="nf-code">404</p>
      <h1 className="nf-heading">Page not found</h1>
      <p className="nf-body">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link href="/" className="nf-link">
        Back to home
      </Link>
    </div>
  );
}
