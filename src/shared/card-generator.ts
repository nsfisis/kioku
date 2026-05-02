/**
 * Shared card generation logic used by both server (note repository) and client
 * (offline-first IndexedDB writes). Pure functions: produces card payloads from
 * a note type and field values without touching any storage layer.
 */

const NEW_CARD_STATE = 0;

export interface NoteTypeForGeneration {
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
}

export interface FieldTypeForGeneration {
	id: string;
	name: string;
}

export interface FieldValueForGeneration {
	noteFieldTypeId: string;
	value: string;
}

export interface GeneratedCard {
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: Date;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
}

export function renderCardTemplate(
	template: string,
	fields: Map<string, string>,
): string {
	let result = template;
	for (const [name, value] of fields) {
		result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, "g"), value);
	}
	return result;
}

export function generateCardsForNote(input: {
	noteType: NoteTypeForGeneration;
	fieldTypes: FieldTypeForGeneration[];
	fieldValues: FieldValueForGeneration[];
	now?: Date;
}): GeneratedCard[] {
	const { noteType, fieldTypes, fieldValues, now = new Date() } = input;

	const fieldMap = new Map<string, string>();
	for (const fv of fieldValues) {
		const ft = fieldTypes.find((f) => f.id === fv.noteFieldTypeId);
		if (ft) {
			fieldMap.set(ft.name, fv.value);
		}
	}

	const generated: GeneratedCard[] = [
		buildCard(noteType, fieldMap, false, now),
	];
	if (noteType.isReversible) {
		generated.push(buildCard(noteType, fieldMap, true, now));
	}
	return generated;
}

function buildCard(
	noteType: NoteTypeForGeneration,
	fields: Map<string, string>,
	isReversed: boolean,
	now: Date,
): GeneratedCard {
	const frontTemplate = isReversed
		? noteType.backTemplate
		: noteType.frontTemplate;
	const backTemplate = isReversed
		? noteType.frontTemplate
		: noteType.backTemplate;

	return {
		isReversed,
		front: renderCardTemplate(frontTemplate, fields),
		back: renderCardTemplate(backTemplate, fields),
		state: NEW_CARD_STATE,
		due: new Date(now),
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
	};
}
