export interface ApiError {
	error: {
		message: string;
		code: string;
	};
}

export interface Tokens {
	accessToken: string;
	refreshToken: string;
}
