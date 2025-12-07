import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ApiClientError, useAuth } from "../stores";

export function LoginPage() {
	const [, navigate] = useLocation();
	const { login, isAuthenticated } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate("/", { replace: true });
		}
	}, [isAuthenticated, navigate]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);

		setIsSubmitting(true);

		try {
			await login(username, password);
			navigate("/", { replace: true });
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Login failed. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-12 bg-cream">
			<div className="w-full max-w-sm animate-slide-up">
				{/* Logo/Brand */}
				<div className="text-center mb-10">
					<h1 className="font-display text-4xl font-semibold text-ink tracking-tight">
						Kioku
					</h1>
					<p className="mt-2 text-muted text-sm">Your memory, amplified</p>
				</div>

				{/* Login Card */}
				<div className="bg-white rounded-2xl shadow-lg p-8 border border-border/50">
					<h2 className="font-display text-xl font-medium text-slate mb-6">
						Welcome back
					</h2>

					<form onSubmit={handleSubmit} className="space-y-5">
						{error && (
							<div
								role="alert"
								className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20"
							>
								{error}
							</div>
						)}

						<div>
							<label
								htmlFor="username"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Username
							</label>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								autoComplete="username"
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="Enter your username"
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="Enter your password"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm hover:shadow-md"
						>
							{isSubmitting ? (
								<span className="flex items-center justify-center gap-2">
									<FontAwesomeIcon
										icon={faSpinner}
										className="h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
									Signing in...
								</span>
							) : (
								"Sign in"
							)}
						</button>
					</form>
				</div>

				{/* Footer note */}
				<p className="text-center text-muted text-xs mt-6">
					Spaced repetition learning
				</p>
			</div>
		</div>
	);
}
