import { z } from "zod";

// User schema
export const userSchema = z.object({
	id: z.uuid(),
	username: z.string().min(1).max(255),
	passwordHash: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

// User creation input schema
export const createUserSchema = z.object({
	username: z.string().min(1).max(255),
	password: z.string().min(15).max(255),
});

// Login input schema
export const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

// Refresh token input schema
export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1),
});

// Inferred types from schemas
export type UserSchema = z.infer<typeof userSchema>;
export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;
