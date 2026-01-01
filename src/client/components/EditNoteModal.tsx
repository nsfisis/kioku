import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface NoteField {
	id: string;
	name: string;
	order: number;
}

interface NoteType {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	fields: NoteField[];
}

interface NoteFieldValue {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
}

interface NoteWithFieldValues {
	id: string;
	deckId: string;
	noteTypeId: string;
	fieldValues: NoteFieldValue[];
}

interface EditNoteModalProps {
	isOpen: boolean;
	deckId: string;
	noteId: string | null;
	onClose: () => void;
	onNoteUpdated: () => void;
}

export function EditNoteModal({
	isOpen,
	deckId,
	noteId,
	onClose,
	onNoteUpdated,
}: EditNoteModalProps) {
	const [note, setNote] = useState<NoteWithFieldValues | null>(null);
	const [noteType, setNoteType] = useState<NoteType | null>(null);
	const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [isLoadingNote, setIsLoadingNote] = useState(false);
	const [isLoadingNoteType, setIsLoadingNoteType] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const fetchNoteTypeDetails = useCallback(async (noteTypeId: string) => {
		setIsLoadingNoteType(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api["note-types"][":id"].$get({
				param: { id: noteTypeId },
			});
			const data = await apiClient.handleResponse<{ noteType: NoteType }>(res);
			setNoteType(data.noteType);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load note type details. Please try again.");
			}
		} finally {
			setIsLoadingNoteType(false);
		}
	}, []);

	const fetchNote = useCallback(async () => {
		if (!noteId) return;

		setIsLoadingNote(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api.decks[":deckId"].notes[
				":noteId"
			].$get({
				param: { deckId, noteId },
			});
			const data = await apiClient.handleResponse<{
				note: NoteWithFieldValues;
			}>(res);
			setNote(data.note);

			// Initialize field values from note
			const initialValues: Record<string, string> = {};
			for (const fv of data.note.fieldValues) {
				initialValues[fv.noteFieldTypeId] = fv.value;
			}
			setFieldValues(initialValues);

			// Fetch note type details
			await fetchNoteTypeDetails(data.note.noteTypeId);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load note. Please try again.");
			}
		} finally {
			setIsLoadingNote(false);
		}
	}, [noteId, deckId, fetchNoteTypeDetails]);

	useEffect(() => {
		if (isOpen && noteId) {
			fetchNote();
		}
	}, [isOpen, noteId, fetchNote]);

	const resetForm = () => {
		setNote(null);
		setNoteType(null);
		setFieldValues({});
		setError(null);
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	const handleFieldChange = (fieldId: string, value: string) => {
		setFieldValues((prev) => ({
			...prev,
			[fieldId]: value,
		}));
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!note) {
			setError("Note data is not loaded.");
			return;
		}

		setIsSubmitting(true);

		try {
			// Trim all field values
			const trimmedFields: Record<string, string> = {};
			for (const [fieldId, value] of Object.entries(fieldValues)) {
				trimmedFields[fieldId] = value.trim();
			}

			const res = await apiClient.rpc.api.decks[":deckId"].notes[
				":noteId"
			].$put({
				param: { deckId, noteId: note.id },
				json: {
					fields: trimmedFields,
				},
			});
			await apiClient.handleResponse(res);

			onNoteUpdated();
			handleClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to update note. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen || !noteId) {
		return null;
	}

	// Check if all required fields have values
	const isFormValid =
		noteType &&
		noteType.fields.length > 0 &&
		noteType.fields.every((field) => fieldValues[field.id]?.trim());

	const isLoading = isLoadingNote || isLoadingNoteType;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-note-title"
			className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					handleClose();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					handleClose();
				}
			}}
		>
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in">
				<div className="p-6">
					<h2
						id="edit-note-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Edit Note
					</h2>

					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<div
								role="alert"
								className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20"
							>
								{error}
							</div>
						)}

						{/* Loading indicator */}
						{isLoading && (
							<div className="flex items-center gap-2 text-muted text-sm py-4">
								<FontAwesomeIcon
									icon={faSpinner}
									className="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
								Loading note...
							</div>
						)}

						{/* Note Type Display (read-only) */}
						{noteType && !isLoading && (
							<div>
								<span className="block text-sm font-medium text-slate mb-1.5">
									Note Type
								</span>
								<div className="px-4 py-2.5 bg-ivory border border-border rounded-lg text-muted">
									{noteType.name}
									{noteType.isReversible ? " (reversed)" : ""}
								</div>
							</div>
						)}

						{/* Dynamic Field Inputs */}
						{noteType &&
							!isLoading &&
							(noteType.fields.length === 0 ? (
								<div className="text-muted text-sm py-2">
									This note type has no fields.
								</div>
							) : (
								noteType.fields
									.sort((a, b) => a.order - b.order)
									.map((field) => (
										<div key={field.id}>
											<label
												htmlFor={`field-${field.id}`}
												className="block text-sm font-medium text-slate mb-1.5"
											>
												{field.name}
											</label>
											<textarea
												id={`field-${field.id}`}
												value={fieldValues[field.id] || ""}
												onChange={(e) =>
													handleFieldChange(field.id, e.target.value)
												}
												required
												disabled={isSubmitting}
												rows={3}
												placeholder={`Enter ${field.name.toLowerCase()}`}
												className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
											/>
										</div>
									))
							))}

						<div className="flex gap-3 justify-end pt-2">
							<button
								type="button"
								onClick={handleClose}
								disabled={isSubmitting}
								className="px-4 py-2 text-slate hover:bg-ivory rounded-lg transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isSubmitting || !isFormValid || isLoading}
								className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isSubmitting ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
