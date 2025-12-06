import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Application-specific error with status code and optional details
 */
export class AppError extends Error {
	readonly statusCode: ContentfulStatusCode;
	readonly code: string;

	constructor(
		message: string,
		statusCode: ContentfulStatusCode = 500,
		code = "INTERNAL_ERROR",
	) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.code = code;
	}
}

/**
 * Common error factory functions
 */
export const Errors = {
	badRequest: (message = "Bad request", code = "BAD_REQUEST") =>
		new AppError(message, 400, code),

	unauthorized: (message = "Unauthorized", code = "UNAUTHORIZED") =>
		new AppError(message, 401, code),

	forbidden: (message = "Forbidden", code = "FORBIDDEN") =>
		new AppError(message, 403, code),

	notFound: (message = "Not found", code = "NOT_FOUND") =>
		new AppError(message, 404, code),

	conflict: (message = "Conflict", code = "CONFLICT") =>
		new AppError(message, 409, code),

	validationError: (message = "Validation failed", code = "VALIDATION_ERROR") =>
		new AppError(message, 422, code),

	internal: (message = "Internal server error", code = "INTERNAL_ERROR") =>
		new AppError(message, 500, code),
};

interface ErrorResponse {
	error: {
		message: string;
		code: string;
	};
}

/**
 * Global error handler middleware for Hono
 */
export function errorHandler(err: Error, c: Context): Response {
	// Handle AppError
	if (err instanceof AppError) {
		const response: ErrorResponse = {
			error: {
				message: err.message,
				code: err.code,
			},
		};
		return c.json(response, err.statusCode);
	}

	// Handle Hono's HTTPException
	if (err instanceof HTTPException) {
		const response: ErrorResponse = {
			error: {
				message: err.message,
				code: "HTTP_ERROR",
			},
		};
		return c.json(response, err.status as ContentfulStatusCode);
	}

	// Handle unknown errors
	console.error("Unhandled error:", err);
	const response: ErrorResponse = {
		error: {
			message:
				process.env.NODE_ENV === "production"
					? "Internal server error"
					: err.message,
			code: "INTERNAL_ERROR",
		},
	};
	return c.json(response, 500);
}
