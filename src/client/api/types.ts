export interface User {
	id: string;
	username: string;
}

export interface AuthResponse {
	accessToken: string;
	refreshToken: string;
	user: User;
}

export interface ApiError {
	error: string;
	code?: string;
}

export interface Tokens {
	accessToken: string;
	refreshToken: string;
}
