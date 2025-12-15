import * as readline from "node:readline/promises";
import { mapAnkiToKioku, parseAnkiPackage } from "../anki/index.js";
import { db } from "../db/index.js";
import { cards, decks } from "../db/schema.js";
import { userRepository } from "../repositories/index.js";

async function main() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	// Get file path from command line argument or prompt
	let filePath = process.argv[2];
	if (!filePath) {
		filePath = await rl.question("Anki package path (.apkg): ");
	}

	if (!filePath) {
		console.error("Error: File path is required");
		process.exit(1);
	}

	// Get username
	const username = await rl.question("Username: ");
	rl.close();

	if (!username) {
		console.error("Error: Username is required");
		process.exit(1);
	}

	// Find user
	const user = await userRepository.findByUsername(username);
	if (!user) {
		console.error(`Error: User "${username}" not found`);
		process.exit(1);
	}

	console.log(`\nParsing Anki package: ${filePath}`);

	// Parse the Anki package
	const ankiPackage = await parseAnkiPackage(filePath);

	console.log(`Found ${ankiPackage.decks.length} deck(s)`);
	console.log(`Found ${ankiPackage.notes.length} note(s)`);
	console.log(`Found ${ankiPackage.cards.length} card(s)`);

	// Convert to Kioku format
	const importData = mapAnkiToKioku(ankiPackage);

	if (importData.length === 0) {
		console.log("\nNo decks to import (all decks may be empty or skipped)");
		process.exit(0);
	}

	console.log(`\nImporting ${importData.length} deck(s):`);
	for (const { deck, cards: deckCards } of importData) {
		console.log(`  - ${deck.name}: ${deckCards.length} card(s)`);
	}

	// Import decks and cards
	let totalCards = 0;
	for (const { deck, cards: kiokuCards } of importData) {
		// Create deck
		const [newDeck] = await db
			.insert(decks)
			.values({
				userId: user.id,
				name: deck.name,
				description: deck.description,
				newCardsPerDay: 20,
			})
			.returning();

		if (!newDeck) {
			console.error(`Error: Failed to create deck "${deck.name}"`);
			continue;
		}

		// Create cards in batches
		if (kiokuCards.length > 0) {
			const cardValues = kiokuCards.map((card) => ({
				deckId: newDeck.id,
				front: card.front,
				back: card.back,
				state: card.state,
				due: card.due,
				stability: card.stability,
				difficulty: card.difficulty,
				elapsedDays: card.elapsedDays,
				scheduledDays: card.scheduledDays,
				reps: card.reps,
				lapses: card.lapses,
				lastReview: card.lastReview,
			}));

			await db.insert(cards).values(cardValues);
			totalCards += kiokuCards.length;
		}

		console.log(
			`  Created deck "${deck.name}" with ${kiokuCards.length} cards`,
		);
	}

	console.log(`\nImport complete!`);
	console.log(`  Decks: ${importData.length}`);
	console.log(`  Cards: ${totalCards}`);

	process.exit(0);
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
