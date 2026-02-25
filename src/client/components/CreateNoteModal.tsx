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

interface NoteTypeSummary {
	id: string;
	name: string;
	isReversible: boolean;
}

interface CreateNoteModalProps {
	isOpen: boolean;
	deckId: string;
	defaultNoteTypeId?: string | null;
	onClose: () => void;
	onNoteCreated: () => void;
}

export function CreateNoteModal({
	isOpen,
	deckId,
	defaultNoteTypeId,
	onClose,
	onNoteCreated,
}: CreateNoteModalProps) {
	const [noteTypes, setNoteTypes] = useState<NoteTypeSummary[]>([]);
	const [selectedNoteType, setSelectedNoteType] = useState<NoteType | null>(
		null,
	);
	const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [isLoadingNoteTypes, setIsLoadingNoteTypes] = useState(false);
	const [isLoadingNoteType, setIsLoadingNoteType] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasLoadedNoteTypes, setHasLoadedNoteTypes] = useState(false);

	const fetchNoteTypeDetails = useCallback(async (noteTypeId: string) => {
		setIsLoadingNoteType(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api["note-types"][":id"].$get({
				param: { id: noteTypeId },
			});
			const data = await apiClient.handleResponse<{ noteType: NoteType }>(res);
			setSelectedNoteType(data.noteType);

			// Initialize field values for the new note type
			const initialValues: Record<string, string> = {};
			for (const field of data.noteType.fields) {
				initialValues[field.id] = "";
			}
			setFieldValues(initialValues);
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

	const fetchNoteTypes = useCallback(async () => {
		setIsLoadingNoteTypes(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api["note-types"].$get();
			const data = await apiClient.handleResponse<{
				noteTypes: NoteTypeSummary[];
			}>(res);
			setNoteTypes(data.noteTypes);
			setHasLoadedNoteTypes(true);

			// Auto-select default note type if specified, otherwise first
			const targetNoteType =
				(defaultNoteTypeId &&
					data.noteTypes.find((nt) => nt.id === defaultNoteTypeId)) ||
				data.noteTypes[0];
			if (targetNoteType) {
				await fetchNoteTypeDetails(targetNoteType.id);
			}
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load note types. Please try again.");
			}
		} finally {
			setIsLoadingNoteTypes(false);
		}
	}, [fetchNoteTypeDetails, defaultNoteTypeId]);

	useEffect(() => {
		if (isOpen && !hasLoadedNoteTypes) {
			fetchNoteTypes();
		}
	}, [isOpen, hasLoadedNoteTypes, fetchNoteTypes]);

	const resetForm = () => {
		// Reset field values to empty for current note type
		if (selectedNoteType) {
			const initialValues: Record<string, string> = {};
			for (const field of selectedNoteType.fields) {
				initialValues[field.id] = "";
			}
			setFieldValues(initialValues);
		} else {
			setFieldValues({});
		}
		setError(null);
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	const handleNoteTypeChange = async (noteTypeId: string) => {
		if (noteTypeId !== selectedNoteType?.id) {
			await fetchNoteTypeDetails(noteTypeId);
		}
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

		if (!selectedNoteType) {
			setError("Please select a note type.");
			return;
		}

		setIsSubmitting(true);

		try {
			// Trim all field values
			const trimmedFields: Record<string, string> = {};
			for (const [fieldId, value] of Object.entries(fieldValues)) {
				trimmedFields[fieldId] = value.trim();
			}

			const res = await apiClient.rpc.api.decks[":deckId"].notes.$post({
				param: { deckId },
				json: {
					noteTypeId: selectedNoteType.id,
					fields: trimmedFields,
				},
			});
			await apiClient.handleResponse(res);

			resetForm();
			onNoteCreated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to create note. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	// Check if all required fields have values
	const isFormValid =
		selectedNoteType &&
		selectedNoteType.fields.length > 0 &&
		selectedNoteType.fields.every((field) => fieldValues[field.id]?.trim());

	const isLoading = isLoadingNoteTypes || isLoadingNoteType;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-note-title"
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
						id="create-note-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Create New Note
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

						{/* Note Type Selector */}
						<div>
							<label
								htmlFor="note-type-select"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Note Type
							</label>
							{isLoadingNoteTypes ? (
								<div className="flex items-center gap-2 text-muted text-sm py-2">
									<FontAwesomeIcon
										icon={faSpinner}
										className="h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
									Loading note types...
								</div>
							) : noteTypes.length === 0 ? (
								<div className="text-muted text-sm py-2">
									No note types available. Please create a note type first.
								</div>
							) : (
								<select
									id="note-type-select"
									value={selectedNoteType?.id || ""}
									onChange={(e) => handleNoteTypeChange(e.target.value)}
									disabled={isSubmitting || isLoading}
									className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{noteTypes.map((noteType) => (
										<option key={noteType.id} value={noteType.id}>
											{noteType.name}
											{noteType.isReversible ? " (reversed)" : ""}
										</option>
									))}
								</select>
							)}
						</div>

						{/* Loading indicator for note type details */}
						{isLoadingNoteType && (
							<div className="flex items-center gap-2 text-muted text-sm py-4">
								<FontAwesomeIcon
									icon={faSpinner}
									className="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
								Loading fields...
							</div>
						)}

						{/* Dynamic Field Inputs */}
						{selectedNoteType && !isLoadingNoteType && (
							<>
								{selectedNoteType.fields.length === 0 ? (
									<div className="text-muted text-sm py-2">
										This note type has no fields. Please add fields to the note
										type first.
									</div>
								) : (
									selectedNoteType.fields
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
								)}

								{/* Card Preview Info */}
								{selectedNoteType.fields.length > 0 && (
									<div className="bg-ivory rounded-lg px-4 py-3 text-sm text-muted">
										This will create{" "}
										<span className="font-medium text-slate">
											{selectedNoteType.isReversible ? "2 cards" : "1 card"}
										</span>
										{selectedNoteType.isReversible && " (normal and reversed)"}
									</div>
								)}
							</>
						)}

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
								{isSubmitting ? "Creating..." : "Create Note"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
