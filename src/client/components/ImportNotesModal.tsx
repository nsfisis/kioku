import {
	faCheck,
	faExclamationTriangle,
	faFileImport,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { ApiClientError, apiClient } from "../api";
import { parseCSV } from "../utils/csvParser";

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

interface ImportNotesModalProps {
	isOpen: boolean;
	deckId: string;
	onClose: () => void;
	onImportComplete: () => void;
}

type ImportPhase =
	| "upload"
	| "validating"
	| "preview"
	| "importing"
	| "complete";

interface ValidationError {
	rowNumber: number;
	message: string;
}

interface ValidatedRow {
	rowNumber: number;
	noteTypeId: string;
	noteTypeName: string;
	fields: Record<string, string>;
	preview: Record<string, string>;
}

interface ImportResult {
	created: number;
	failed: { index: number; error: string }[];
}

export function ImportNotesModal({
	isOpen,
	deckId,
	onClose,
	onImportComplete,
}: ImportNotesModalProps) {
	const [phase, setPhase] = useState<ImportPhase>("upload");
	const [error, setError] = useState<string | null>(null);
	const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
	const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
	const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
		[],
	);
	const [importResult, setImportResult] = useState<ImportResult | null>(null);

	const fetchNoteTypes = useCallback(async () => {
		try {
			const res = await apiClient.rpc.api["note-types"].$get();
			const data = await apiClient.handleResponse<{
				noteTypes: { id: string; name: string }[];
			}>(res);

			// Fetch details for each note type to get fields
			const noteTypesWithFields: NoteType[] = [];
			for (const nt of data.noteTypes) {
				const detailRes = await apiClient.rpc.api["note-types"][":id"].$get({
					param: { id: nt.id },
				});
				if (detailRes.ok) {
					const detailData = await apiClient.handleResponse<{
						noteType: NoteType;
					}>(detailRes);
					noteTypesWithFields.push(detailData.noteType);
				}
			}

			setNoteTypes(noteTypesWithFields);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load note types. Please try again.");
			}
		}
	}, []);

	useEffect(() => {
		if (isOpen && noteTypes.length === 0) {
			fetchNoteTypes();
		}
	}, [isOpen, noteTypes.length, fetchNoteTypes]);

	const resetState = () => {
		setPhase("upload");
		setError(null);
		setValidatedRows([]);
		setValidationErrors([]);
		setImportResult(null);
	};

	const handleClose = () => {
		resetState();
		onClose();
	};

	const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setPhase("validating");
		setError(null);
		setValidationErrors([]);
		setValidatedRows([]);

		try {
			const content = await file.text();
			const parseResult = parseCSV(content);

			if (!parseResult.success) {
				setError(parseResult.error.message);
				setPhase("upload");
				return;
			}

			const { headers, rows } = parseResult.data;

			// Validate headers: must have note_type and at least one field
			if (headers.length < 2) {
				setError("CSV must have at least 2 columns: note_type and field(s)");
				setPhase("upload");
				return;
			}

			if (headers[0] !== "note_type") {
				setError("First column must be 'note_type'");
				setPhase("upload");
				return;
			}

			const fieldNames = headers.slice(1);
			const validated: ValidatedRow[] = [];
			const errors: ValidationError[] = [];

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				if (!row) continue;

				const rowNumber = i + 2; // +2 because 1-indexed and header is row 1

				const noteTypeName = row.note_type ?? "";
				const noteType = noteTypes.find(
					(nt) => nt.name.toLowerCase() === noteTypeName.toLowerCase(),
				);

				if (!noteType) {
					errors.push({
						rowNumber,
						message: `Note type "${noteTypeName}" not found`,
					});
					continue;
				}

				// Map field names to field type IDs
				const fields: Record<string, string> = {};
				const preview: Record<string, string> = {};
				let fieldError = false;

				for (const fieldName of fieldNames) {
					const fieldType = noteType.fields.find(
						(f) => f.name.toLowerCase() === fieldName.toLowerCase(),
					);

					if (!fieldType) {
						errors.push({
							rowNumber,
							message: `Field "${fieldName}" not found in note type "${noteTypeName}"`,
						});
						fieldError = true;
						break;
					}

					const value = row[fieldName] ?? "";
					fields[fieldType.id] = value;
					preview[fieldName] = value;
				}

				if (fieldError) continue;

				validated.push({
					rowNumber,
					noteTypeId: noteType.id,
					noteTypeName: noteType.name,
					fields,
					preview,
				});
			}

			setValidatedRows(validated);
			setValidationErrors(errors);
			setPhase("preview");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to parse CSV");
			setPhase("upload");
		}

		// Reset file input
		e.target.value = "";
	};

	const handleImport = async () => {
		if (validatedRows.length === 0) return;

		setPhase("importing");
		setError(null);

		try {
			const res = await apiClient.rpc.api.decks[":deckId"].notes.import.$post({
				param: { deckId },
				json: {
					notes: validatedRows.map((row) => ({
						noteTypeId: row.noteTypeId,
						fields: row.fields,
					})),
				},
			});
			const result = await apiClient.handleResponse<ImportResult>(res);
			setImportResult(result);
			setPhase("complete");
			onImportComplete();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to import notes. Please try again.");
			}
			setPhase("preview");
		}
	};

	if (!isOpen) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="import-notes-title"
			className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
			onClick={(e) => {
				if (e.target === e.currentTarget && phase !== "importing") {
					handleClose();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape" && phase !== "importing") {
					handleClose();
				}
			}}
		>
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in max-h-[90vh] flex flex-col">
				<div className="p-6 flex-shrink-0">
					<h2
						id="import-notes-title"
						className="font-display text-xl font-medium text-ink mb-4"
					>
						Import Notes from CSV
					</h2>

					{error && (
						<div
							role="alert"
							className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20 mb-4"
						>
							{error}
						</div>
					)}

					{/* Phase: Upload */}
					{phase === "upload" && (
						<div className="space-y-4">
							<div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
								<FontAwesomeIcon
									icon={faFileImport}
									className="w-10 h-10 text-muted mb-4"
								/>
								<p className="text-slate mb-4">Select a CSV file to import</p>
								<label className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg cursor-pointer transition-all duration-200">
									<span>Choose File</span>
									<input
										type="file"
										accept=".csv,text/csv"
										onChange={handleFileChange}
										className="hidden"
									/>
								</label>
							</div>
							<div className="bg-ivory rounded-lg px-4 py-3 text-sm text-muted">
								<p className="font-medium text-slate mb-1">Expected format:</p>
								<code className="text-xs">
									note_type,Front,Back
									<br />
									Basic,hello,world
								</code>
							</div>
						</div>
					)}

					{/* Phase: Validating */}
					{phase === "validating" && (
						<div className="flex items-center justify-center py-8">
							<FontAwesomeIcon
								icon={faSpinner}
								className="w-8 h-8 text-primary animate-spin"
							/>
							<span className="ml-3 text-muted">Validating CSV...</span>
						</div>
					)}
				</div>

				{/* Phase: Preview - scrollable content */}
				{phase === "preview" && (
					<div className="flex-1 overflow-y-auto px-6">
						{validationErrors.length > 0 && (
							<div className="bg-warning/5 border border-warning/20 rounded-lg p-4 mb-4">
								<div className="flex items-center gap-2 text-warning font-medium mb-2">
									<FontAwesomeIcon icon={faExclamationTriangle} />
									{validationErrors.length} error(s) found
								</div>
								<ul className="text-sm text-slate space-y-1 max-h-32 overflow-y-auto">
									{validationErrors.map((err) => (
										<li key={err.rowNumber}>
											Row {err.rowNumber}: {err.message}
										</li>
									))}
								</ul>
							</div>
						)}

						{validatedRows.length > 0 && (
							<div className="space-y-4">
								<p className="text-slate">
									<span className="font-medium">{validatedRows.length}</span>{" "}
									note(s) ready to import
								</p>

								{/* Preview table */}
								<div className="border border-border rounded-lg overflow-hidden">
									<div className="max-h-48 overflow-y-auto">
										<table className="w-full text-sm">
											<thead className="bg-ivory sticky top-0">
												<tr>
													<th className="px-3 py-2 text-left font-medium text-slate">
														#
													</th>
													<th className="px-3 py-2 text-left font-medium text-slate">
														Type
													</th>
													<th className="px-3 py-2 text-left font-medium text-slate">
														Preview
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{validatedRows.slice(0, 10).map((row) => (
													<tr key={row.rowNumber}>
														<td className="px-3 py-2 text-muted">
															{row.rowNumber}
														</td>
														<td className="px-3 py-2 text-slate">
															{row.noteTypeName}
														</td>
														<td className="px-3 py-2 text-slate truncate max-w-[200px]">
															{Object.values(row.preview).join(" | ")}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{validatedRows.length > 10 && (
										<div className="bg-ivory px-3 py-2 text-xs text-muted text-center">
											...and {validatedRows.length - 10} more
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Phase: Importing */}
				{phase === "importing" && (
					<div className="px-6 flex items-center justify-center py-8">
						<FontAwesomeIcon
							icon={faSpinner}
							className="w-8 h-8 text-primary animate-spin"
						/>
						<span className="ml-3 text-muted">Importing notes...</span>
					</div>
				)}

				{/* Phase: Complete */}
				{phase === "complete" && importResult && (
					<div className="px-6">
						<div className="text-center py-4">
							<div className="w-14 h-14 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center">
								<FontAwesomeIcon
									icon={faCheck}
									className="w-7 h-7 text-success"
								/>
							</div>
							<p className="text-lg font-medium text-slate mb-2">
								Import complete!
							</p>
							<p className="text-muted">
								{importResult.created} note(s) imported successfully
							</p>
							{importResult.failed.length > 0 && (
								<div className="mt-4 bg-error/5 border border-error/20 rounded-lg p-4 text-left">
									<p className="text-error font-medium mb-2">
										{importResult.failed.length} failed:
									</p>
									<ul className="text-sm text-slate space-y-1 max-h-24 overflow-y-auto">
										{importResult.failed.map((f) => (
											<li key={f.index}>
												Row {validatedRows[f.index]?.rowNumber ?? f.index + 1}:{" "}
												{f.error}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Footer buttons */}
				<div className="p-6 flex-shrink-0 border-t border-border mt-auto">
					<div className="flex gap-3 justify-end">
						{phase === "upload" && (
							<button
								type="button"
								onClick={handleClose}
								className="px-4 py-2 text-slate hover:bg-ivory rounded-lg transition-colors"
							>
								Cancel
							</button>
						)}

						{phase === "preview" && (
							<>
								<button
									type="button"
									onClick={resetState}
									className="px-4 py-2 text-slate hover:bg-ivory rounded-lg transition-colors"
								>
									Back
								</button>
								<button
									type="button"
									onClick={handleImport}
									disabled={validatedRows.length === 0}
									className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Import {validatedRows.length} Note(s)
								</button>
							</>
						)}

						{phase === "complete" && (
							<button
								type="button"
								onClick={handleClose}
								className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200"
							>
								Done
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
