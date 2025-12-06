import { Link } from "wouter";

export function NotFoundPage() {
	return (
		<div>
			<h1>404 - Not Found</h1>
			<p>The page you're looking for doesn't exist.</p>
			<Link href="/">Go to Home</Link>
		</div>
	);
}
