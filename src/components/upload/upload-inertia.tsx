"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropzone } from "@/components/upload/dropzone";
import { Errors } from "@/components/upload/errors";
import { Header } from "@/components/upload/header";
import { List } from "@/components/upload/list";
import { FileUploadProvider, useFileUpload } from "@astrify/react-s3-upload";
import { useForm } from "@inertiajs/react";
import { LoaderCircle } from "lucide-react";
import type { FormEventHandler } from "react";

type UploadForm = {
	name: string;
	uploadedFiles: Array<{
		id: string;
		name: string;
		sha256: string;
		size: number;
		type: string;
	}>;
};

interface UploadInertiaProps {
	/**
	 * The endpoint URL for signed storage URLs (e.g., '/signed-storage-url')
	 */
	presignEndpoint?: string;
	/**
	 * The form submission endpoint URL (e.g., '/documents')
	 */
	submitEndpoint?: string;
	/**
	 * Maximum number of files allowed
	 */
	maxFiles?: number;
	/**
	 * Maximum file size in bytes
	 */
	maxSize?: number;
	/**
	 * Accepted file types
	 */
	accept?: string;
	/**
	 * Additional CSS class for the component
	 */
	className?: string;
}

function FormContent({
	submitEndpoint = "/documents",
}: { submitEndpoint: string }) {
	const { files, hasComplete, hasPending, hasUploading, hasErrors, removeAll } =
		useFileUpload();

	const { data, setData, post, processing, errors, reset } =
		useForm<UploadForm>({
			name: "",
			uploadedFiles: [],
		});

	const submitForm: FormEventHandler = (e) => {
		e.preventDefault();

		// Extract only completed files for submission
		const completedFiles = files.filter((f) => f.status === "complete");

		// Update the form data with completed files
		const formData = {
			...data,
			uploadedFiles: completedFiles.map((f) => ({
				id: f.id,
				name: f.name,
				sha256: f.sha256,
				size: f.size,
				type: f.type,
			})),
		};

		// Submit using Inertia
		post("/documents", {
			onFinish: () => {
				// Reset the name field after successful submission
				reset("name");
				removeAll(); // Clear all files from the upload context
				console.log("Form submitted successfully");
			},
		});
	};

	// Enable submit only when all uploads are complete and form has a name
	const canSubmit =
		hasComplete &&
		!hasPending &&
		!hasUploading &&
		!hasErrors &&
		data.name.length > 0;

	return (
		<form onSubmit={submitForm} className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					type="text"
					id="name"
					name="name"
					placeholder="Enter your name"
					required={true}
					value={data.name}
					onChange={(e) => setData("name", e.target.value)}
				/>
				{errors.name && (
					<p className="text-destructive text-sm">{errors.name}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label>Attachments</Label>
				<div className="space-y-4">
					<Dropzone />
					<Header />
					<Errors />
					<List showImagePreviews={false} />
				</div>
				{errors.uploadedFiles && (
					<p className="text-destructive text-sm">{errors.uploadedFiles}</p>
				)}
			</div>

			<Button
				type="submit"
				disabled={!canSubmit || processing}
				className="w-full sm:w-auto"
			>
				{processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
				Submit with {files.filter((f) => f.status === "complete").length} files
			</Button>
		</form>
	);
}

export function UploadInertia({
	presignEndpoint = "/signed-storage-url",
	submitEndpoint = "/documents",
	maxFiles = 10,
	maxSize = 10 * 1024 * 1024, // 10MB
	className,
}: UploadInertiaProps) {
	return (
		<div className={className}>
			<FileUploadProvider
				config={{
					presignEndpoint,
					maxFiles,
					maxSize,
					accept: {
						"image/*": [".png", ".jpeg", ".jpg"],
						"application/pdf": [".pdf"],
					},
				}}
			>
				<FormContent submitEndpoint={submitEndpoint} />
			</FileUploadProvider>
		</div>
	);
}
