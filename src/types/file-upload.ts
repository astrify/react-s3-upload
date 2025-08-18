// New state architecture types
export interface FileRequest {
	name: string; // original filename
	size: number; // in bytes
	type: string; // MIME type
	sha256: string; // unique hash (used as an id to dedupe + match retries)
	preview?: string; // optional preview URL for images
}

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

// FileMetadata removed - use FileRequest with optional sha256 instead

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
