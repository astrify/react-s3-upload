"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, useFileUpload } from "@astrify/react-s3-upload";
import { ImageIcon, UploadIcon } from "lucide-react";
import type * as React from "react";
import { type Accept, type FileRejection, useDropzone } from "react-dropzone";

interface FileDropzoneProps {
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

export function FileDropzone({
	onDrop: onDropProp,
	maxSize: maxSizeProp,
	maxFiles: maxFilesProp,
	accept: acceptProp,
	className,
	emptyIcon,
	emptyTitle,
	emptyDescription,
}: FileDropzoneProps) {
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
