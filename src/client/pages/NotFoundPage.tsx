import { faFaceSadTear, faHouse } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "wouter";

export function NotFoundPage() {
	return (
		<div className="min-h-screen bg-cream flex items-center justify-center px-4">
			<div className="text-center animate-fade-in">
				<div className="w-20 h-20 mx-auto mb-6 bg-ivory rounded-2xl flex items-center justify-center">
					<FontAwesomeIcon
						icon={faFaceSadTear}
						className="w-10 h-10 text-muted"
						aria-hidden="true"
					/>
				</div>
				<h1 className="font-display text-6xl font-bold text-ink mb-2">404</h1>
				<h2 className="font-display text-xl font-medium text-slate mb-4">
					Page Not Found
				</h2>
				<p className="text-muted mb-8 max-w-sm mx-auto">
					The page you're looking for doesn't exist or has been moved.
				</p>
				<Link
					href="/"
					className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
				>
					<FontAwesomeIcon
						icon={faHouse}
						className="w-5 h-5"
						aria-hidden="true"
					/>
					Go Home
				</Link>
			</div>
		</div>
	);
}
