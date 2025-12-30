import * as readline from "node:readline/promises";
import * as argon2 from "argon2";
import { userRepository } from "../repositories/index.js";

async function main() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const username = await rl.question("Username: ");
	const password = await rl.question("Password: ");
	rl.close();

	if (!username || !password) {
		console.error("Error: Username and password are required");
		process.exit(1);
	}

	if (password.length < 15) {
		console.error("Error: Password must be at least 15 characters");
		process.exit(1);
	}

	// Check if username already exists
	const exists = await userRepository.existsByUsername(username);
	if (exists) {
		console.error(`Error: Username "${username}" already exists`);
		process.exit(1);
	}

	// Hash password with Argon2
	const passwordHash = await argon2.hash(password);

	// Create user
	const newUser = await userRepository.create({ username, passwordHash });

	console.log(`User created successfully:`);
	console.log(`  ID: ${newUser.id}`);
	console.log(`  Username: ${newUser.username}`);

	process.exit(0);
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
