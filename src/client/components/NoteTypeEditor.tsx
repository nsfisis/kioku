import {
	faChevronDown,
	faChevronUp,
	faGripVertical,
	faPlus,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ApiClientError, apiClient } from "../api";

interface NoteFieldType {
	id: string;
	noteTypeId: string;
	name: string;
	order: number;
	fieldType: string;
}

interface NoteType {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
}

interface NoteTypeWithFields extends NoteType {
	fields: NoteFieldType[];
}

interface NoteTypeEditorProps {
	isOpen: boolean;
	noteTypeId: string | null;
	onClose: () => void;
	onNoteTypeUpdated: () => void;
}

interface DeleteConfirmation {
	fieldId: string;
	cardCount: number;
	step: 1 | 2;
}

export function NoteTypeEditor({
	isOpen,
	noteTypeId,
	onClose,
	onNoteTypeUpdated,
}: NoteTypeEditorProps) {
	const [noteType, setNoteType] = useState<NoteTypeWithFields | null>(null);
	const [name, setName] = useState("");
	const [frontTemplate, setFrontTemplate] = useState("");
	const [backTemplate, setBackTemplate] = useState("");
	const [isReversible, setIsReversible] = useState(false);
	const [fields, setFields] = useState<NoteFieldType[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [newFieldName, setNewFieldName] = useState("");
	const [isAddingField, setIsAddingField] = useState(false);
	const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
	const [editingFieldName, setEditingFieldName] = useState("");
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmation | null>(
		null,
	);
	const editInputRef = useRef<HTMLInputElement>(null);

	const fetchNoteType = useCallback(async () => {
		if (!noteTypeId) return;

		setIsLoading(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api["note-types"][":id"].$get({
				param: { id: noteTypeId },
			});
			const data = await apiClient.handleResponse<{
				noteType: NoteTypeWithFields;
			}>(res);
			const fetchedNoteType = data.noteType;
			setNoteType(fetchedNoteType);
			setName(fetchedNoteType.name);
			setFrontTemplate(fetchedNoteType.frontTemplate);
			setBackTemplate(fetchedNoteType.backTemplate);
			setIsReversible(fetchedNoteType.isReversible);
			setFields(fetchedNoteType.fields.sort((a, b) => a.order - b.order) || []);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load note type. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}, [noteTypeId]);

	useEffect(() => {
		if (isOpen && noteTypeId) {
			fetchNoteType();
		}
	}, [isOpen, noteTypeId, fetchNoteType]);

	useEffect(() => {
		if (editingFieldId && editInputRef.current) {
			editInputRef.current.focus();
		}
	}, [editingFieldId]);

	const handleClose = () => {
		setError(null);
		setFieldError(null);
		setNewFieldName("");
		setIsAddingField(false);
		setEditingFieldId(null);
		setNoteType(null);
		setDeleteConfirm(null);
		onClose();
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!noteType) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const res = await apiClient.rpc.api["note-types"][":id"].$put({
				param: { id: noteType.id },
				json: {
					name: name.trim(),
					frontTemplate: frontTemplate.trim(),
					backTemplate: backTemplate.trim(),
					isReversible,
				},
			});
			await apiClient.handleResponse(res);

			onNoteTypeUpdated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to update note type. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleAddField = async () => {
		if (!noteType || !newFieldName.trim()) return;

		setFieldError(null);
		setIsAddingField(true);

		try {
			const newOrder =
				fields.length > 0 ? Math.max(...fields.map((f) => f.order)) + 1 : 0;

			const res = await apiClient.rpc.api["note-types"][":id"].fields.$post({
				param: { id: noteType.id },
				json: {
					name: newFieldName.trim(),
					order: newOrder,
					fieldType: "text",
				},
			});
			const data = await apiClient.handleResponse<{ field: NoteFieldType }>(
				res,
			);
			setFields([...fields, data.field]);
			setNewFieldName("");
		} catch (err) {
			if (err instanceof ApiClientError) {
				setFieldError(err.message);
			} else {
				setFieldError("Failed to add field. Please try again.");
			}
		} finally {
			setIsAddingField(false);
		}
	};

	const handleUpdateFieldName = async (fieldId: string) => {
		if (!noteType || !editingFieldName.trim()) return;

		setFieldError(null);

		try {
			const res = await apiClient.rpc.api["note-types"][":id"].fields[
				":fieldId"
			].$put({
				param: { id: noteType.id, fieldId },
				json: {
					name: editingFieldName.trim(),
				},
			});
			const data = await apiClient.handleResponse<{ field: NoteFieldType }>(
				res,
			);
			setFields(fields.map((f) => (f.id === fieldId ? data.field : f)));
			setEditingFieldId(null);
			setEditingFieldName("");
		} catch (err) {
			if (err instanceof ApiClientError) {
				setFieldError(err.message);
			} else {
				setFieldError("Failed to update field. Please try again.");
			}
		}
	};

	const handleDeleteField = async (fieldId: string, force = false) => {
		if (!noteType) return;

		setFieldError(null);

		try {
			let res: Response;
			if (force) {
				res = await apiClient.authenticatedFetch(
					`/api/note-types/${noteType.id}/fields/${fieldId}?force=true`,
					{ method: "DELETE" },
				);
			} else {
				res = await apiClient.rpc.api["note-types"][":id"].fields[
					":fieldId"
				].$delete({
					param: { id: noteType.id, fieldId },
				});
			}

			if (res.ok) {
				setFields(fields.filter((f) => f.id !== fieldId));
				setDeleteConfirm(null);
				return;
			}

			const body = (await res.json()) as {
				error?: { message?: string; code?: string };
				cardCount?: number;
			};
			if (
				res.status === 409 &&
				body.error?.code === "FIELD_HAS_VALUES" &&
				body.cardCount !== undefined
			) {
				setDeleteConfirm({ fieldId, cardCount: body.cardCount, step: 1 });
				return;
			}

			throw new ApiClientError(
				body.error?.message || `Request failed with status ${res.status}`,
				res.status,
				body.error?.code,
			);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setFieldError(err.message);
			} else {
				setFieldError("Failed to delete field. Please try again.");
			}
		}
	};

	const handleMoveField = async (fieldId: string, direction: "up" | "down") => {
		if (!noteType) return;

		const fieldIndex = fields.findIndex((f) => f.id === fieldId);
		if (fieldIndex === -1) return;

		const newIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
		if (newIndex < 0 || newIndex >= fields.length) return;

		const newFields = [...fields];
		const temp = newFields[fieldIndex];
		newFields[fieldIndex] = newFields[newIndex] as NoteFieldType;
		newFields[newIndex] = temp as NoteFieldType;

		const fieldIds = newFields.map((f) => f.id);

		setFieldError(null);

		try {
			const res = await apiClient.rpc.api["note-types"][
				":id"
			].fields.reorder.$put({
				param: { id: noteType.id },
				json: { fieldIds },
			});
			const data = await apiClient.handleResponse<{ fields: NoteFieldType[] }>(
				res,
			);
			setFields(
				data.fields.sort(
					(a: NoteFieldType, b: NoteFieldType) => a.order - b.order,
				),
			);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setFieldError(err.message);
			} else {
				setFieldError("Failed to reorder fields. Please try again.");
			}
		}
	};

	const startEditingField = (field: NoteFieldType) => {
		setEditingFieldId(field.id);
		setEditingFieldName(field.name);
	};

	const cancelEditingField = () => {
		setEditingFieldId(null);
		setEditingFieldName("");
	};

	if (!isOpen) {
		return null;
	}

	const confirmFieldName = deleteConfirm
		? fields.find((f) => f.id === deleteConfirm.fieldId)?.name
		: null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="note-type-editor-title"
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
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
				<div className="p-6 border-b border-border/50">
					<h2
						id="note-type-editor-title"
						className="font-display text-xl font-medium text-ink"
					>
						Edit Note Type
					</h2>
				</div>

				<div className="p-6 overflow-y-auto flex-1">
					{isLoading && (
						<div className="flex items-center justify-center py-12">
							<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
						</div>
					)}

					{error && !isLoading && (
						<div
							role="alert"
							className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20 mb-4"
						>
							{error}
						</div>
					)}

					{noteType && !isLoading && (
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Basic Info Section */}
							<div className="space-y-4">
								<div>
									<label
										htmlFor="note-type-name"
										className="block text-sm font-medium text-slate mb-1.5"
									>
										Name
									</label>
									<input
										id="note-type-name"
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										required
										maxLength={255}
										disabled={isSubmitting}
										className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
									/>
								</div>

								<div className="flex items-center gap-3">
									<input
										id="is-reversible"
										type="checkbox"
										checked={isReversible}
										onChange={(e) => setIsReversible(e.target.checked)}
										disabled={isSubmitting}
										className="w-4 h-4 text-primary bg-ivory border-border rounded focus:ring-primary/20 focus:ring-2 disabled:opacity-50"
									/>
									<label
										htmlFor="is-reversible"
										className="text-sm font-medium text-slate"
									>
										Create reversed cards
									</label>
								</div>
								<p className="text-muted text-xs -mt-2 ml-7">
									Only affects new notes; existing cards are not modified
								</p>
							</div>

							{/* Fields Section */}
							<div className="border-t border-border/50 pt-6">
								<h3 className="text-sm font-medium text-slate mb-3">Fields</h3>

								{fieldError && (
									<div
										role="alert"
										className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20 mb-3"
									>
										{fieldError}
									</div>
								)}

								{deleteConfirm && (
									<div
										role="alert"
										className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg border border-amber-200 mb-3"
									>
										{deleteConfirm.step === 1 ? (
											<>
												<p>
													This note type has{" "}
													<strong>{deleteConfirm.cardCount} card(s)</strong>.
													Deleting the field &ldquo;{confirmFieldName}
													&rdquo; will remove its values from all cards.
												</p>
												<div className="flex gap-2 mt-2">
													<button
														type="button"
														onClick={() =>
															setDeleteConfirm({
																...deleteConfirm,
																step: 2,
															})
														}
														className="px-3 py-1.5 bg-error hover:bg-error/90 text-white text-xs font-medium rounded-lg transition-colors"
													>
														Delete
													</button>
													<button
														type="button"
														onClick={() => setDeleteConfirm(null)}
														className="px-3 py-1.5 text-slate hover:bg-ivory text-xs font-medium rounded-lg transition-colors"
													>
														Cancel
													</button>
												</div>
											</>
										) : (
											<>
												<p>
													This action cannot be undone. Are you sure you want to
													delete the field &ldquo;{confirmFieldName}&rdquo;?
												</p>
												<div className="flex gap-2 mt-2">
													<button
														type="button"
														onClick={() =>
															handleDeleteField(deleteConfirm.fieldId, true)
														}
														className="px-3 py-1.5 bg-error hover:bg-error/90 text-white text-xs font-medium rounded-lg transition-colors"
													>
														Delete
													</button>
													<button
														type="button"
														onClick={() => setDeleteConfirm(null)}
														className="px-3 py-1.5 text-slate hover:bg-ivory text-xs font-medium rounded-lg transition-colors"
													>
														Cancel
													</button>
												</div>
											</>
										)}
									</div>
								)}

								<div className="space-y-2 mb-4">
									{fields.map((field, index) => (
										<div
											key={field.id}
											className="flex items-center gap-2 p-3 bg-ivory rounded-lg border border-border/50 group"
										>
											<FontAwesomeIcon
												icon={faGripVertical}
												className="w-3 h-3 text-muted"
												aria-hidden="true"
											/>

											{editingFieldId === field.id ? (
												<input
													type="text"
													value={editingFieldName}
													onChange={(e) => setEditingFieldName(e.target.value)}
													onBlur={() => handleUpdateFieldName(field.id)}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															handleUpdateFieldName(field.id);
														} else if (e.key === "Escape") {
															cancelEditingField();
														}
													}}
													ref={editInputRef}
													className="flex-1 px-2 py-1 bg-white border border-primary rounded text-sm text-slate focus:outline-none focus:ring-2 focus:ring-primary/20"
												/>
											) : (
												<button
													type="button"
													onClick={() => startEditingField(field)}
													className="flex-1 text-left text-sm text-slate hover:text-ink"
												>
													{field.name}
												</button>
											)}

											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => handleMoveField(field.id, "up")}
													disabled={index === 0}
													className="p-1.5 text-muted hover:text-slate hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
													title="Move up"
												>
													<FontAwesomeIcon
														icon={faChevronUp}
														className="w-3 h-3"
														aria-hidden="true"
													/>
												</button>
												<button
													type="button"
													onClick={() => handleMoveField(field.id, "down")}
													disabled={index === fields.length - 1}
													className="p-1.5 text-muted hover:text-slate hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
													title="Move down"
												>
													<FontAwesomeIcon
														icon={faChevronDown}
														className="w-3 h-3"
														aria-hidden="true"
													/>
												</button>
												<button
													type="button"
													onClick={() => handleDeleteField(field.id)}
													className="p-1.5 text-muted hover:text-error hover:bg-error/5 rounded transition-colors"
													title="Delete field"
												>
													<FontAwesomeIcon
														icon={faTrash}
														className="w-3 h-3"
														aria-hidden="true"
													/>
												</button>
											</div>
										</div>
									))}
								</div>

								{/* Add Field */}
								<div className="flex items-center gap-2">
									<input
										type="text"
										value={newFieldName}
										onChange={(e) => setNewFieldName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddField();
											}
										}}
										placeholder="New field name"
										disabled={isAddingField}
										className="flex-1 px-3 py-2 bg-white border border-border rounded-lg text-sm text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
									/>
									<button
										type="button"
										onClick={handleAddField}
										disabled={isAddingField || !newFieldName.trim()}
										className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<FontAwesomeIcon
											icon={faPlus}
											className="w-3 h-3"
											aria-hidden="true"
										/>
										Add
									</button>
								</div>
							</div>

							{/* Templates Section */}
							<div className="border-t border-border/50 pt-6">
								<h3 className="text-sm font-medium text-slate mb-3">
									Templates
								</h3>
								<p className="text-muted text-xs mb-4">
									Use {"{{FieldName}}"} to insert field values. Available
									fields:{" "}
									{fields.length > 0
										? fields.map((f) => `{{${f.name}}}`).join(", ")
										: "(no fields yet)"}
								</p>

								<div className="space-y-4">
									<div>
										<label
											htmlFor="front-template"
											className="block text-sm font-medium text-slate mb-1.5"
										>
											Front Template
										</label>
										<textarea
											id="front-template"
											value={frontTemplate}
											onChange={(e) => setFrontTemplate(e.target.value)}
											required
											maxLength={1000}
											disabled={isSubmitting}
											rows={3}
											className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
										/>
									</div>

									<div>
										<label
											htmlFor="back-template"
											className="block text-sm font-medium text-slate mb-1.5"
										>
											Back Template
										</label>
										<textarea
											id="back-template"
											value={backTemplate}
											onChange={(e) => setBackTemplate(e.target.value)}
											required
											maxLength={1000}
											disabled={isSubmitting}
											rows={3}
											className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
										/>
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-3 justify-end pt-2 border-t border-border/50">
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
									disabled={isSubmitting || !name.trim()}
									className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSubmitting ? "Saving..." : "Save Changes"}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}
