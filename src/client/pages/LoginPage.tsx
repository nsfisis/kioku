import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
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
		<div>
			<h1>Login</h1>
			<form onSubmit={handleSubmit}>
				{error && (
					<div role="alert" style={{ color: "red" }}>
						{error}
					</div>
				)}
				<div>
					<label htmlFor="username">Username</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
						autoComplete="username"
						disabled={isSubmitting}
					/>
				</div>
				<div>
					<label htmlFor="password">Password</label>
					<input
						id="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
						disabled={isSubmitting}
					/>
				</div>
				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Logging in..." : "Login"}
				</button>
			</form>
			<p>
				Don't have an account? <Link href="/register">Register</Link>
			</p>
		</div>
	);
}
