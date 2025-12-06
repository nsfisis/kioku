import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ApiClientError, useAuth } from "../stores";

export function RegisterPage() {
	const [, navigate] = useLocation();
	const { register, isAuthenticated } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
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

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setIsSubmitting(true);

		try {
			await register(username, password);
			navigate("/", { replace: true });
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Registration failed. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div>
			<h1>Register</h1>
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
						autoComplete="new-password"
						disabled={isSubmitting}
					/>
				</div>
				<div>
					<label htmlFor="confirmPassword">Confirm Password</label>
					<input
						id="confirmPassword"
						type="password"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						required
						autoComplete="new-password"
						disabled={isSubmitting}
					/>
				</div>
				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Registering..." : "Register"}
				</button>
			</form>
			<p>
				Already have an account? <Link href="/login">Login</Link>
			</p>
		</div>
	);
}
