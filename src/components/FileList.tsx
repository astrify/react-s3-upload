import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, useFileUpload } from "@astrify/react-s3-upload";
import type { FileType, FileUpload } from "@astrify/react-s3-upload";
import {
	FileArchiveIcon,
	FileIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	HeadphonesIcon,
	ImageIcon,
	RefreshCwIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

function FilePreviewWithProgress({
	file,
	showPreview,
}: { file: FileUpload; showPreview: boolean }) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		// Create preview URL if it's an image and we have the file or a preview URL
		if (showPreview && file.type.startsWith("image/")) {
			if (file.preview) {
				setPreviewUrl(file.preview);
			} else if (file.file instanceof File) {
				const url = URL.createObjectURL(file.file);
				setPreviewUrl(url);
				return () => URL.revokeObjectURL(url);
			}
		}
	}, [file, showPreview]);

	// For images with preview enabled, use progressive reveal effect
	if (showPreview && previewUrl && file.type.startsWith("image/")) {
		if (file.status === "pending" || file.status === "uploading") {
			const progress = file.status === "pending" ? 0 : file.progress || 0;
			return (
				<div className="relative size-10 overflow-hidden rounded">
					{/* Dimmed base image */}
					<img
						src={previewUrl}
						alt={file.name}
						className="absolute inset-0 size-10 object-cover opacity-30"
					/>
					{/* Progressive reveal overlay */}
					<div
						className="absolute inset-0 overflow-hidden"
						style={{ width: `${progress}%` }}
					>
						<img
							src={previewUrl}
							alt={file.name}
							className="size-10 object-cover"
						/>
					</div>
					{/* Optional: Add a subtle progress line */}
					{file.status === "uploading" && progress > 0 && progress < 100 && (
						<div
							className="absolute inset-y-0 w-0.5 bg-primary/50"
							style={{ left: `${progress}%` }}
						/>
					)}
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

interface FileListProps {
	showActions?: boolean;
	showImagePreviews?: boolean;
	className?: string;
}

export function FileList({
	showActions = true,
	showImagePreviews = false,
	className,
}: FileListProps) {
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
