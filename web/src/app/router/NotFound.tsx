import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-sm text-accent-600 hover:underline">
        Go to the start page
      </Link>
    </main>
  );
}

export function ForbiddenPage() {
  return (
    <div className="py-16 text-center" role="alert">
      <h1 className="text-2xl font-semibold">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-muted">
        Ask an administrator of your organization if you need it.
      </p>
    </div>
  );
}
