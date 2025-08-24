export interface FileUpload {
	id: string; // same as sha256 for continuity
	name: string;
	size: number;
	type: string;
	sha256: string;
	url: string; // pre-signed URL returned from server
	status: UploadStatus; // lifecycle status
	progress: number; // 0–100 (% uploaded)
	error?: string; // error message if status === 'error'
	preview?: string; // preview URL for images
	duplicateAlert?: boolean; // Trigger pulse animation when duplicate detected
	file?: File; // Keep original File object for operations
}

/**
 * Payload for Signed URL endpoint
 */
export interface SignedUrlRequest {
	name: string; // original filename
	size: number; // in bytes
	type: string; // MIME type
	sha256: string; // unique hash (used as an id to dedupe + match retries)
	preview?: string; // optional preview URL for images
}

/**
 * Response from signed URL endpoint
 */
export interface SignedUrlResponse {
	sha256: string; // SHA-256 hash as identifier
	bucket: string;
	key: string;
	url: string;
	extension?: string;
	filename?: string; // Added for batch response reference
}

/**
 * File upload status
 */
export type UploadStatus = "pending" | "uploading" | "complete" | "error";

/**
 * Error types for upload failures
 */
export type UploadErrorType =
	| "no_files"
	| "server_error"
	| "network_error"
	| "s3_upload"
	| "invalid_response"
	| "validation_error"
	| "duplicate_file"
	| "unknown";

/**
 * Upload error structure
 */
export interface UploadError {
	type: UploadErrorType;
	message: string;
	details?: unknown;
}

export type FileType = File | { name: string; size: number; type: string };

// Import Accept type from react-dropzone for FileUploadConfig
import type { Accept } from "react-dropzone";

/**
 * Configuration options for the FileUploadProvider
 */
export interface FileUploadConfig {
	maxFiles?: number;
	maxSize?: number;
	accept?: Accept;
	signedUrlEndpoint?: string;
	signedUrlHeaders?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>);
	onUploadComplete?: (files: FileUpload[]) => void;
	onUploadError?: (errors: Array<{ file: File; error: unknown }>) => void;
	onFilesChange?: (files: File[]) => void;
}

/**
 * Return type for the useFileUpload hook
 */
export interface UseFileUploadResult {
	// State
	files: FileUpload[];
	errors: UploadError[];
	isUploading: boolean;
	remainingSlots: number;
	config: FileUploadConfig;

	// Status flags
	hasPending: boolean;
	hasUploading: boolean;
	hasErrors: boolean;
	hasComplete: boolean;

	// Actions
	addFiles: (files: File[]) => Promise<void>;
	removeFile: (fileId: string) => void;
	removeAll: () => void;
	retryUpload: (fileId: string) => Promise<void>;
	reset: () => void;
	addErrors: (errors: UploadError[]) => void;
	clearErrors: () => void;

	// Utilities
	canAcceptMore: boolean;
	acceptedFileTypes: Accept | undefined;
	maxFileSize: number;
}
