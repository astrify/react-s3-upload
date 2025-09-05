import { CloudUpload, Trash2 } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import type { Accept } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/FileUploadContext";
import { cn } from "@/lib/utils";

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
