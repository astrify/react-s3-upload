import type { FileType, FileUpload } from "@astrify/react-s3-upload";
import {
	formatBytes,
	useFileErrors,
	useFileUpload,
} from "@astrify/react-s3-upload";
import {
	CloudUpload,
	FileArchiveIcon,
	FileIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	HeadphonesIcon,
	ImageIcon,
	RefreshCwIcon,
	Trash2,
	UploadIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { type Accept, type FileRejection, useDropzone } from "react-dropzone";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// DROPZONE COMPONENT
// ============================================================================

interface DropzoneProps {
	onDrop?: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void;
	maxSize?: number;
	maxFiles?: number;
	accept?: Accept;
	className?: string;
	children?: React.ReactNode;
	hideDefaultContent?: boolean;
	emptyIcon?: React.ReactNode;
	emptyTitle?: string;
	emptyDescription?: string;
}

// Helper function to format rejection error messages
function formatRejectionError(
	file: File,
	errorCode: string,
	errorMessage: string,
	_maxSize: number,
	_maxFiles: number,
): { message: string; details: string } {
	switch (errorCode) {
		case "file-too-large":
			return {
				message: "File size exceeded",
				details: file.name,
			};
		case "file-invalid-type":
			return {
				message: "Invalid file type",
				details: file.name,
			};
		case "too-many-files":
			return {
				message: "Too many files",
				details: file.name,
			};
		default:
			return {
				message: errorMessage,
				details: file.name,
			};
	}
}

// Helper function to check if accept only allows images
function isImageOnlyAccept(accept: Accept | undefined): boolean {
	if (!accept) {
		return false;
	}
	const mimeTypes = Object.keys(accept);
	return (
		mimeTypes.length > 0 && mimeTypes.every((type) => type.startsWith("image/"))
	);
}

// Helper function to get dropzone icon
function getDropzoneIcon(
	accept: Accept | undefined,
	emptyIcon: React.ReactNode | undefined,
): React.ReactNode {
	if (emptyIcon) {
		return emptyIcon;
	}

	const isImageOnly = isImageOnlyAccept(accept);
	if (isImageOnly) {
		return <ImageIcon className="size-4 opacity-60" />;
	}
	return <UploadIcon className="size-4 opacity-60" />;
}

// Helper function to generate file type description from Accept object
function getAcceptDescription(accept: Accept | undefined): string {
	if (!accept || Object.keys(accept).length === 0) {
		return "Any file type";
	}

	const allExtensions: string[] = [];

	for (const extensions of Object.values(accept)) {
		if (extensions && extensions.length > 0) {
			allExtensions.push(
				...extensions.map((ext) => ext.toUpperCase().replace(".", "")),
			);
		}
	}

	return allExtensions.length > 0 ? allExtensions.join(", ") : "Any file type";
}

// Helper function to get dropzone text content
function getDropzoneText(
	accept: Accept | undefined,
	emptyTitle: string | undefined,
	emptyDescription: string | undefined,
	maxSize: number,
	maxFiles: number,
	currentFileCount: number,
) {
	const isImageOnly = isImageOnlyAccept(accept);

	const title =
		emptyTitle ||
		(isImageOnly
			? maxFiles === 1
				? "Drop your image here"
				: "Drop your images here"
			: maxFiles === 1
				? "Drop file here"
				: "Drop files here");

	let description = emptyDescription;
	let fileCountText = "";

	if (!description) {
		const sizeText = `max. ${formatBytes(maxSize, { si: false, decimalPlaces: 0 })}`;
		const fileTypes = getAcceptDescription(accept);
		description = `${fileTypes} (${sizeText})`;
	}

	// Add file count on separate line if maxFiles > 1
	if (maxFiles > 1) {
		fileCountText = `${currentFileCount}/${maxFiles}`;
	}

	return { title, description, fileCountText, isImageOnly };
}

export function Dropzone({
	onDrop: onDropProp,
	maxSize: maxSizeProp,
	maxFiles: maxFilesProp,
	accept: acceptProp,
	className,
	emptyIcon,
	emptyTitle,
	emptyDescription,
}: DropzoneProps) {
	// Get config from context (required)
	const context = useFileUpload();

	const maxSize = maxSizeProp ?? context.maxFileSize ?? 50 * 1024 * 1024;
	const maxFiles = maxFilesProp ?? context.config.maxFiles ?? 10;
	const accept = acceptProp ?? context.acceptedFileTypes;
	const multiple = maxFiles > 1;
	const remainingSlots = context.remainingSlots ?? maxFiles;

	// Handle file rejections and format error messages
	const handleRejections = (fileRejections: FileRejection[]) => {
		const errorMessages: Array<{
			type: "validation_error";
			message: string;
			details: string;
		}> = [];

		for (const rejection of fileRejections) {
			const { file, errors } = rejection;
			for (const error of errors) {
				const formatted = formatRejectionError(
					file,
					error.code,
					error.message,
					maxSize,
					maxFiles,
				);
				errorMessages.push({
					type: "validation_error",
					message: formatted.message,
					details: formatted.details,
				});
			}
		}

		// Push errors to context
		if (errorMessages.length > 0) {
			context.addErrors(errorMessages);
		}

		return errorMessages;
	};

	// Use context addFiles and optional custom onDrop
	const handleDrop =
		onDropProp ||
		(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
			// Clear any existing errors at the start of a new drop
			context.clearErrors();

			// Handle rejections with a small delay to trigger re-animation
			if (fileRejections.length > 0) {
				setTimeout(() => {
					handleRejections(fileRejections);
				}, 50);
			}

			// Then handle accepted files
			if (acceptedFiles.length > 0) {
				await context.addFiles(acceptedFiles);
			}
		});

	const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
		onDrop: handleDrop,
		accept,
		maxSize,
		maxFiles: remainingSlots,
		multiple,
		noClick: true, // We'll handle click manually
	});

	const currentFileCount = maxFiles - remainingSlots;

	const icon = getDropzoneIcon(accept, emptyIcon);

	const { title, description, fileCountText, isImageOnly } = getDropzoneText(
		accept,
		emptyTitle,
		emptyDescription,
		maxSize,
		maxFiles,
		currentFileCount,
	);

	return (
		<div
			{...getRootProps({
				className: cn(
					"relative rounded-lg border border-dashed p-6 text-center transition-colors",
					isDragActive
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-muted-foreground/50",
					className,
				),
			})}
		>
			<input
				{...getInputProps()}
				className="sr-only"
				aria-label="Upload file"
			/>

			<div className="flex flex-col items-center justify-center px-4 py-3 text-center">
				<div
					className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background"
					aria-hidden="true"
				>
					{icon}
				</div>

				<p className="mb-1.5 font-medium text-sm">{title}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
				<Button
					variant="outline"
					className="mt-4"
					onClick={(e) => {
						e.stopPropagation();
						open();
					}}
				>
					<UploadIcon className="-ms-1 size-4 opacity-60" aria-hidden="true" />
					Select{" "}
					{isImageOnly
						? maxFiles === 1
							? "image"
							: "images"
						: maxFiles === 1
							? "file"
							: "files"}
				</Button>
			</div>

			{fileCountText && (
				<div className="absolute right-3 bottom-4 text-muted-foreground text-xs">
					{fileCountText}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// ERRORS COMPONENT
// ============================================================================

export function Errors() {
	const errors = useFileErrors();
	const { clearErrors } = useFileUpload();

	// Show errors as toasts
	useEffect(() => {
		if (errors.length > 0) {
			// Show toasts for all errors
			errors.forEach((error) => {
				toast.error(error.message, {
					description:
						typeof error.details === "string" ? error.details : undefined,
					richColors: true,
				});
			});

			// Clear errors immediately after showing toasts
			clearErrors();
		}
	}, [errors, clearErrors]);

	// Replace with null if you're loading the Toaster in a different component
	return <Toaster expand={true} />;
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

// Convert Accept object to HTML input accept string
function acceptToString(accept: Accept | undefined): string | undefined {
	if (!accept) {
		return undefined;
	}

	const parts: string[] = [];
	for (const [mimeType, extensions] of Object.entries(accept)) {
		parts.push(mimeType);
		if (extensions && extensions.length > 0) {
			parts.push(...extensions);
		}
	}
	return parts.join(",");
}

interface HeaderProps {
	className?: string;
	title?: string;
	showAddButton?: boolean;
	showClearButton?: boolean;
	addButtonText?: string;
	clearButtonText?: string;
}

export function Header({
	className,
	title = "Files",
	showAddButton = true,
	showClearButton = true,
	addButtonText = "Add files",
	clearButtonText = "Remove all",
}: HeaderProps) {
	const { files, removeAll, addFiles, canAcceptMore, config } = useFileUpload();
	const fileInputRef = useRef<HTMLInputElement>(null);

	if (files.length === 0) {
		return null;
	}

	const openFileDialog = () => {
		fileInputRef.current?.click();
	};

	const handleFileInputChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const newFiles = Array.from(e.target.files || []);
		if (newFiles.length > 0) {
			await addFiles(newFiles);
		}
		e.target.value = "";
	};

	return (
		<div className={cn("flex items-center justify-between gap-2", className)}>
			<input
				ref={fileInputRef}
				type="file"
				multiple={(config.maxFiles ?? 10) > 1}
				accept={acceptToString(config.accept)}
				onChange={handleFileInputChange}
				className="sr-only"
				aria-label="Upload file"
			/>

			<h3 className="truncate font-medium text-sm">
				{title} ({files.length})
			</h3>

			<div className="flex gap-2">
				{showAddButton && (
					<Button
						variant="outline"
						size="sm"
						onClick={openFileDialog}
						disabled={!canAcceptMore}
					>
						<CloudUpload
							className="-ms-0.5 size-3.5 opacity-60"
							aria-hidden="true"
						/>
						{addButtonText}
					</Button>
				)}

				{showClearButton && files.length > 0 && (
					<Button variant="outline" size="sm" onClick={removeAll}>
						<Trash2
							className="-ms-0.5 size-3.5 opacity-60"
							aria-hidden="true"
						/>
						{clearButtonText}
					</Button>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// LIST COMPONENT
// ============================================================================

function FilePreviewWithProgress({
	file,
	showPreview,
}: {
	file: FileUpload;
	showPreview: boolean;
}) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewFailed, setPreviewFailed] = useState(false);

	useEffect(() => {
		// Create preview URL if it's an image and we have the file or a preview URL
		if (showPreview && file.type.startsWith("image/")) {
			if (file.preview) {
				// For provided preview URLs, test if they work
				const img = new Image();
				const previewSrc = file.preview;
				img.onload = () => {
					setPreviewUrl(previewSrc);
					setPreviewFailed(false);
				};
				img.onerror = () => {
					setPreviewFailed(true);
					setPreviewUrl(null);
				};
				img.src = previewSrc;
			} else if (file.file instanceof File) {
				const url = URL.createObjectURL(file.file);

				// Test if the browser can actually render this image
				const img = new Image();
				img.onload = () => {
					setPreviewUrl(url);
					setPreviewFailed(false);
				};
				img.onerror = () => {
					setPreviewFailed(true);
					setPreviewUrl(null);
					URL.revokeObjectURL(url);
				};
				img.src = url;

				return () => {
					if (previewUrl === url) {
						URL.revokeObjectURL(url);
					}
				};
			}
		}
	}, [file, showPreview, previewUrl]);

	// For images with preview enabled, show with circular progress indicator
	// Only show image preview if we have a valid preview URL and it didn't fail to load
	if (
		showPreview &&
		previewUrl &&
		!previewFailed &&
		file.type.startsWith("image/")
	) {
		if (file.status === "pending" || file.status === "uploading") {
			const progress = file.status === "pending" ? 0 : file.progress || 0;
			return (
				<div className="relative size-10 overflow-hidden rounded">
					{/* Dimmed preview image */}
					<img
						src={previewUrl}
						alt={file.name}
						className="size-10 object-cover opacity-40"
					/>
					{/* Circular progress indicator */}
					<svg
						className="-rotate-90 absolute inset-0 size-10"
						viewBox="0 0 40 40"
						aria-label={
							file.status === "pending" ? "Pending upload" : "Upload progress"
						}
					>
						<title>
							{file.status === "pending" ? "Pending upload" : "Upload progress"}
						</title>
						{/* Background circle */}
						<circle
							cx="20"
							cy="20"
							r="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className="text-background/60"
						/>
						{/* Progress circle */}
						<circle
							cx="20"
							cy="20"
							r="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeDasharray={`${2 * Math.PI * 18}`}
							strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
							className="text-primary transition-all duration-300"
							strokeLinecap="round"
						/>
					</svg>
				</div>
			);
		}
		// Completed or error state - show full image
		return (
			<img
				src={previewUrl}
				alt={file.name}
				className="size-10 rounded object-cover"
			/>
		);
	}

	// For non-image files, use the circular progress indicator
	const iconContent = (
		<div className="flex size-10 items-center justify-center">
			{getFileIcon(file)}
		</div>
	);

	if (file.status === "pending") {
		return (
			<div className="relative size-10">
				{iconContent}
				<svg
					className="absolute inset-0 size-10"
					viewBox="0 0 40 40"
					aria-label="Pending upload"
				>
					<title>Pending upload</title>
					<circle
						cx="20"
						cy="20"
						r="18"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeDasharray="4 3"
						className="text-muted-foreground/40"
					/>
				</svg>
			</div>
		);
	}

	if (file.status === "uploading" && file.progress > 0) {
		return (
			<div className="relative size-10">
				{iconContent}
				<svg
					className="-rotate-90 absolute inset-0 size-10"
					viewBox="0 0 40 40"
					aria-label="Upload progress"
				>
					<title>Upload progress</title>
					<circle
						cx="20"
						cy="20"
						r="18"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						className="text-muted-foreground/20"
					/>
					<circle
						cx="20"
						cy="20"
						r="18"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeDasharray={`${2 * Math.PI * 18}`}
						strokeDashoffset={`${2 * Math.PI * 18 * (1 - file.progress / 100)}`}
						className="text-primary transition-all duration-300"
						strokeLinecap="round"
					/>
				</svg>
			</div>
		);
	}

	return iconContent;
}

export function getFileIcon(file: FileType) {
	const type = file instanceof File ? file.type : file.type;
	const name = file instanceof File ? file.name : file.name;

	if (
		type.includes("pdf") ||
		name.endsWith(".pdf") ||
		type.includes("word") ||
		name.endsWith(".doc") ||
		name.endsWith(".docx")
	) {
		return <FileTextIcon className="size-4 opacity-60" />;
	}
	if (
		type.includes("zip") ||
		type.includes("archive") ||
		name.endsWith(".zip") ||
		name.endsWith(".rar")
	) {
		return <FileArchiveIcon className="size-4 opacity-60" />;
	}
	if (
		type.includes("excel") ||
		name.endsWith(".xls") ||
		name.endsWith(".xlsx")
	) {
		return <FileSpreadsheetIcon className="size-4 opacity-60" />;
	}
	if (type.includes("video/")) {
		return <VideoIcon className="size-4 opacity-60" />;
	}
	if (type.includes("audio/")) {
		return <HeadphonesIcon className="size-4 opacity-60" />;
	}
	if (type.startsWith("image/")) {
		return <ImageIcon className="size-4 opacity-60" />;
	}
	return <FileIcon className="size-4 opacity-60" />;
}

function getStatusDisplay(file: FileUpload) {
	switch (file.status) {
		case "pending":
			return <p className="text-muted-foreground text-xs">Queued</p>;
		case "uploading":
			return (
				<p className="text-muted-foreground text-xs">
					Uploading {file.progress ? `${Math.round(file.progress)}%` : ""}
				</p>
			);
		case "complete":
			return (
				<p className="text-muted-foreground text-xs">
					{formatBytes(file.size)}
				</p>
			);
		case "error":
			return (
				<p className="text-destructive text-xs">
					{file.error || "Upload failed"}
				</p>
			);
		default:
			return null;
	}
}

interface ListProps {
	showActions?: boolean;
	showImagePreviews?: boolean;
	className?: string;
}

export function List({
	showActions = true,
	showImagePreviews = false,
	className,
}: ListProps) {
	const { files, removeFile, retryUpload } = useFileUpload();

	if (files.length === 0) {
		return null;
	}

	return (
		<div className={cn("space-y-2", className)}>
			{files.map((file) => (
				<div
					key={file.sha256}
					className={cn(
						"flex items-center justify-between gap-2 rounded-lg border bg-background p-2 pe-3",
						file.status === "pending" && "opacity-60",
						file.duplicateAlert && "bg-primary/10",
					)}
				>
					<div className="flex items-center gap-3 overflow-hidden">
						<div className="shrink-0">
							<FilePreviewWithProgress
								file={file}
								showPreview={showImagePreviews}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-0.5">
							<p className="truncate font-medium text-[13px]">{file.name}</p>
							{getStatusDisplay(file)}
						</div>
					</div>

					{showActions && (
						<div className="flex items-center">
							{file.status === "error" && (
								<Button
									size="icon"
									variant="ghost"
									className="size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
									onClick={() => retryUpload(file.sha256)}
									aria-label="Retry upload"
								>
									<RefreshCwIcon className="size-4" aria-hidden="true" />
								</Button>
							)}
							<Button
								size="icon"
								variant="ghost"
								className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
								onClick={() => removeFile(file.sha256)}
								aria-label="Remove file"
							>
								<XIcon className="size-4" aria-hidden="true" />
							</Button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
