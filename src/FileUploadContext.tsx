import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as defaultUploadLib from "@/lib/upload";
import type {
	FileUpload,
	FileUploadConfig,
	SignedUrlRequest,
	UploadError,
	UploadLib,
	UploadStatus,
	UseFileUploadResult,
} from "@/types/file-upload";

const FileUploadContext = createContext<UseFileUploadResult | undefined>(
	undefined,
);

export interface FileUploadProviderProps {
	children: ReactNode;
	config?: FileUploadConfig;
	defaultFiles?: FileUpload[];
}

export function FileUploadProvider({
	children,
	config = {},
	defaultFiles = [],
}: FileUploadProviderProps) {
	// Default configuration - memoized to avoid re-renders
	const mergedConfig = useMemo<FileUploadConfig>(
		() => ({
			maxFiles: config.maxFiles ?? 10,
			maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50MB default
			accept: config.accept,
			signedUrlEndpoint: config.signedUrlEndpoint ?? "/upload/signed-url",
			signedUrlHeaders: config.signedUrlHeaders,
			onUploadComplete: config.onUploadComplete,
			onUploadError: config.onUploadError,
			onFilesChange: config.onFilesChange,
			uploadLib: config.uploadLib,
		}),
		[
			config.maxFiles,
			config.maxSize,
			config.accept,
			config.signedUrlEndpoint,
			config.signedUrlHeaders,
			config.onUploadComplete,
			config.onUploadError,
			config.onFilesChange,
			config.uploadLib,
		],
	);

	// Upload library - use injected or default to real implementation
	const uploadLib = useMemo<UploadLib>(
		() => ({
			calculateSHA256:
				mergedConfig.uploadLib?.calculateSHA256 ??
				defaultUploadLib.calculateSHA256,
			requestBatchSignedUrls:
				mergedConfig.uploadLib?.requestBatchSignedUrls ??
				defaultUploadLib.requestBatchSignedUrls,
			uploadFile:
				mergedConfig.uploadLib?.uploadFile ?? defaultUploadLib.uploadFile,
		}),
		[mergedConfig.uploadLib],
	);

	// Initialize with default files - validate they have status 'complete'
	const defaultUploadFiles = useMemo(
		() =>
			defaultFiles.map((file) => {
				// Ensure default files have complete status

				return {
					...file,
					id: file.sha256, // Ensure id matches sha256
					status: "complete" as UploadStatus,
					progress: 100,
				};
			}),
		[defaultFiles],
	);

	// State
	const [fileUploads, setFileUploads] = useState<Map<string, FileUpload>>(
		new Map(defaultUploadFiles.map((f) => [f.sha256, f])),
	);
	const [errors, setErrors] = useState<UploadError[]>([]);
	const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
	const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
	const fileRefs = useRef<Map<string, File>>(new Map()); // Store File objects
	const maxConcurrency = 3;

	// Convert Map to array for consumers
	const files = useMemo(() => Array.from(fileUploads.values()), [fileUploads]);

	// Computed values
	const isUploading = activeUploads.size > 0;
	const remainingSlots = (mergedConfig.maxFiles ?? 10) - files.length;
	const canAcceptMore = remainingSlots > 0;

	// Status flags
	const hasPending = useMemo(
		() => files.some((f) => f.status === "pending"),
		[files],
	);
	const hasUploading = useMemo(
		() => files.some((f) => f.status === "uploading"),
		[files],
	);
	const hasErrors = useMemo(
		() => files.some((f) => f.status === "error") || errors.length > 0,
		[files, errors],
	);
	const hasComplete = useMemo(
		() => files.some((f) => f.status === "complete"),
		[files],
	);

	// Helper: Update a file upload
	const updateFileUpload = useCallback(
		(sha256: string, updates: Partial<FileUpload>) => {
			setFileUploads((prev) => {
				const next = new Map(prev);
				const existing = next.get(sha256);
				if (existing) {
					next.set(sha256, { ...existing, ...updates });
				}
				return next;
			});
		},
		[],
	);

	// Helper: Send file request for signed URLs
	const sendFileRequest = useCallback(
		async (
			fileRequests: SignedUrlRequest[],
		): Promise<{
			success: SignedUrlRequest[];
			errors: UploadError[];
		}> => {
			const success: SignedUrlRequest[] = [];
			const errorMessages: UploadError[] = [];

			try {
				// Request signed URLs from server
				const signedUrls = await uploadLib.requestBatchSignedUrls(
					fileRequests.map((req) => ({
						file: fileRefs.current.get(req.sha256) || new File([], req.name),
						sha256: req.sha256,
					})),
					mergedConfig.signedUrlEndpoint,
					mergedConfig.signedUrlHeaders,
				);

				// Map signed URLs to file requests
				fileRequests.forEach((req, index) => {
					const signedUrl = signedUrls[index];
					if (signedUrl) {
						// Create or update FileUpload in collection
						const fileUpload: FileUpload = {
							id: req.sha256,
							name: req.name,
							size: req.size,
							type: req.type,
							sha256: req.sha256,
							url: signedUrl.url,
							status: "pending",
							progress: 0,
							preview: req.preview,
							file: fileRefs.current.get(req.sha256),
						};

						setFileUploads((prev) => {
							const next = new Map(prev);
							next.set(req.sha256, fileUpload);
							return next;
						});

						success.push(req);
					}
				});
			} catch (error) {
				const uploadError = error as UploadError;
				errorMessages.push(uploadError);

				// If retrying (file already exists), update error
				fileRequests.forEach((req) => {
					if (fileUploads.has(req.sha256)) {
						updateFileUpload(req.sha256, {
							status: "error",
							error: uploadError.message,
						});
					}
				});
			}

			return { success, errors: errorMessages };
		},
		[
			mergedConfig.signedUrlEndpoint,
			mergedConfig.signedUrlHeaders,
			fileUploads,
			updateFileUpload,
			uploadLib,
		],
	);

	// Remove a file
	const removeFile = useCallback((fileId: string) => {
		// fileId is sha256 hash
		setFileUploads((prev) => {
			const next = new Map(prev);
			const file = next.get(fileId);

			if (file) {
				// Cleanup preview
				if (file.preview) {
					URL.revokeObjectURL(file.preview);
				}

				// Cancel upload if in progress
				const controller = abortControllersRef.current.get(fileId);
				if (controller) {
					controller.abort();
					abortControllersRef.current.delete(fileId);
				}

				// Remove from state
				next.delete(fileId);
				fileRefs.current.delete(fileId);
			}

			return next;
		});

		setActiveUploads((prev) => {
			const next = new Set(prev);
			next.delete(fileId);
			return next;
		});
	}, []);

	// Remove all files
	const removeAll = useCallback(() => {
		// Cancel all uploads
		for (const controller of Array.from(abortControllersRef.current.values())) {
			controller.abort();
		}
		abortControllersRef.current.clear();
		setActiveUploads(new Set());

		// Cleanup previews
		fileUploads.forEach((file) => {
			if (file.preview) {
				URL.revokeObjectURL(file.preview);
			}
		});

		// Clear state
		setFileUploads(new Map());
		fileRefs.current.clear();
		setErrors([]);
	}, [fileUploads]);

	// Upload files one at a time
	const uploadSingleFile = useCallback(
		async (fileUpload: FileUpload): Promise<void> => {
			const file = fileRefs.current.get(fileUpload.sha256);
			if (!file) {
				return;
			}

			const abortController = new AbortController();
			abortControllersRef.current.set(fileUpload.sha256, abortController);
			setActiveUploads((prev) => new Set(prev).add(fileUpload.sha256));

			try {
				updateFileUpload(fileUpload.sha256, { status: "uploading" });

				await uploadLib.uploadFile({
					file,
					sha256: fileUpload.sha256,
					signal: abortController.signal,
					signedUrl: {
						sha256: fileUpload.sha256,
						bucket: "",
						key: "",
						url: fileUpload.url,
					},
					onProgress: (_sha256, progress) => {
						updateFileUpload(fileUpload.sha256, { progress: progress * 100 });
					},
				});

				// Upload successful - update status
				updateFileUpload(fileUpload.sha256, {
					status: "complete",
					progress: 100,
				});

				// Notify about successful upload using the FileUpload object
				const completedFile = fileUploads.get(fileUpload.sha256);
				if (completedFile) {
					mergedConfig.onUploadComplete?.([completedFile]);
				}
			} catch (error) {
				const uploadError = error as UploadError;

				if (uploadError.type === "duplicate_file") {
					// Remove duplicate file
					setFileUploads((prev) => {
						const next = new Map(prev);
						next.delete(fileUpload.sha256);
						return next;
					});
					setErrors((prev) => [
						...prev,
						{
							type: "duplicate_file" as const,
							message: `${fileUpload.name} was not uploaded`,
							details: "This file already exists on the server",
						},
					]);
				} else {
					updateFileUpload(fileUpload.sha256, {
						status: "error",
						error: uploadError.message,
					});
					mergedConfig.onUploadError?.([{ file, error: uploadError }]);
				}
			} finally {
				abortControllersRef.current.delete(fileUpload.sha256);
				setActiveUploads((prev) => {
					const next = new Set(prev);
					next.delete(fileUpload.sha256);
					return next;
				});
			}
		},
		[
			mergedConfig.onUploadComplete,
			mergedConfig.onUploadError,
			updateFileUpload,
			fileUploads,
			uploadLib,
		],
	);

	// Process upload queue - pulls from FileUploadCollection with status === 'pending'
	useEffect(() => {
		if (activeUploads.size >= maxConcurrency) {
			return;
		}

		// Find pending files to upload directly from the FileUploadCollection
		const pendingFiles = files.filter(
			(f) => f.status === "pending" && !activeUploads.has(f.sha256),
		);

		const slotsAvailable = maxConcurrency - activeUploads.size;
		const filesToUpload = pendingFiles.slice(0, slotsAvailable);

		filesToUpload.forEach((file) => {
			uploadSingleFile(file);
		});
	}, [files, activeUploads, uploadSingleFile]);

	// Helper: Process single file into SignedUrlRequest
	const processFileToRequest = useCallback(
		async (file: File): Promise<SignedUrlRequest | null> => {
			try {
				const hash = await uploadLib.calculateSHA256(file);
				fileRefs.current.set(hash, file);

				return {
					name: file.name,
					size: file.size,
					type: file.type,
					sha256: hash,
					preview: file.type.startsWith("image/")
						? URL.createObjectURL(file)
						: undefined,
				};
			} catch {
				return null;
			}
		},
		[uploadLib],
	);

	// Helper: Handle duplicate file
	const handleDuplicateFile = useCallback(
		(hash: string) => {
			updateFileUpload(hash, { duplicateAlert: true });
			setTimeout(() => {
				updateFileUpload(hash, { duplicateAlert: false });
			}, 1000);
		},
		[updateFileUpload],
	);

	// Add files
	const addFiles = useCallback(
		async (newFiles: File[]) => {
			setErrors([]);

			// Check available slots
			const maxFiles = mergedConfig.maxFiles ?? 10;
			const currentFileCount = fileUploads.size;
			const availableSlots = maxFiles - currentFileCount;

			if (availableSlots <= 0) {
				setErrors([
					{
						type: "validation_error",
						message: "Maximum files reached",
						details: `Maximum ${maxFiles} files allowed`,
					},
				]);
				return;
			}

			const filesToProcess = newFiles.slice(0, availableSlots);
			if (newFiles.length > filesToProcess.length) {
				setErrors((prev) => [
					...prev,
					{
						type: "validation_error",
						message: "File limit exceeded",
						details: `Only ${availableSlots} more file(s) can be added`,
					},
				]);
			}

			// Process files into requests
			const fileRequests: SignedUrlRequest[] = [];
			const processingErrors: UploadError[] = [];

			for (const file of filesToProcess) {
				const fileRequest = await processFileToRequest(file);

				if (!fileRequest) {
					processingErrors.push({
						type: "validation_error",
						message: "Failed to process file",
						details: file.name,
					});
					continue;
				}

				// Check for duplicates
				if (fileUploads.has(fileRequest.sha256)) {
					handleDuplicateFile(fileRequest.sha256);
				} else {
					fileRequests.push(fileRequest);
				}
			}

			if (processingErrors.length > 0) {
				setErrors((prev) => [...prev, ...processingErrors]);
			}

			// Send file requests if we have any
			if (fileRequests.length > 0) {
				const { success, errors: requestErrors } =
					await sendFileRequest(fileRequests);

				if (requestErrors.length > 0) {
					setErrors((prev) => [...prev, ...requestErrors]);
				}

				// Trigger callback
				if (success.length > 0 && mergedConfig.onFilesChange) {
					const successFiles = success
						.map((req) => fileRefs.current.get(req.sha256))
						.filter((file): file is File => file !== undefined);
					mergedConfig.onFilesChange(successFiles);
				}
			}
		},
		[
			fileUploads,
			mergedConfig.maxFiles,
			mergedConfig.onFilesChange,
			sendFileRequest,
			handleDuplicateFile,
			processFileToRequest,
		],
	);

	// Retry upload
	const retryUpload = useCallback(
		async (fileId: string) => {
			const fileUpload = fileUploads.get(fileId);
			const file = fileRefs.current.get(fileId);

			if (!(fileUpload && file) || activeUploads.has(fileId)) {
				return;
			}

			// Create SignedUrlRequest for retry
			const fileRequest: SignedUrlRequest = {
				name: fileUpload.name,
				size: fileUpload.size,
				type: fileUpload.type,
				sha256: fileUpload.sha256,
				preview: fileUpload.preview,
			};

			// Send request for new signed URL
			const { errors: requestErrors } = await sendFileRequest([fileRequest]);

			if (requestErrors.length > 0) {
				setErrors((prev) => [...prev, ...requestErrors]);
			}
		},
		[fileUploads, activeUploads, sendFileRequest],
	);

	// Reset everything
	const reset = useCallback(() => {
		removeAll();
	}, [removeAll]);

	// Add errors from external sources (like client-side validation)
	const addErrors = useCallback((newErrors: UploadError[]) => {
		if (newErrors.length > 0) {
			setErrors((prev) => [...prev, ...newErrors]);
		}
	}, []);

	// Clear all errors
	const clearErrors = useCallback(() => {
		setErrors([]);
	}, []);

	const contextValue: UseFileUploadResult = {
		files,
		errors,
		isUploading,
		remainingSlots,
		config: mergedConfig,
		hasPending,
		hasUploading,
		hasErrors,
		hasComplete,
		addFiles,
		removeFile,
		removeAll,
		retryUpload,
		reset,
		addErrors,
		clearErrors,
		canAcceptMore,
		acceptedFileTypes: mergedConfig.accept,
		maxFileSize: mergedConfig.maxSize ?? 50 * 1024 * 1024,
	};

	return (
		<FileUploadContext.Provider value={contextValue}>
			{children}
		</FileUploadContext.Provider>
	);
}

export function useFileUpload() {
	const context = useContext(FileUploadContext);
	if (!context) {
		throw new Error("useFileUpload must be used within FileUploadProvider");
	}
	return context;
}

export function useFileErrors() {
	const { errors } = useFileUpload();
	return errors;
}
