import type { SignedUrlResponse, UploadError } from "@/types/file-upload";

// Type for server error response
interface ServerErrorResponse {
	errors?: Record<string, string[]>;
	message?: string;
}

/**
 * Uploads a single file to S3-compatible storage
 * Returns void on success, throws error on failure
 */
export async function uploadFile({
	file,
	signedUrl,
	sha256,
	onProgress,
	signal,
}: {
	file: File;
	signedUrl: SignedUrlResponse;
	sha256: string;
	onProgress?: (sha256: string, progress: number) => void;
	signal?: AbortSignal;
}): Promise<void> {
	try {
		await uploadToS3Storage({
			file,
			signedUrl: signedUrl.url,
			onProgress: (progress) => onProgress?.(sha256, progress),
			signal,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Upload failed to S3";
		const details = (error as { details?: string })?.details || error;
		throw createError("s3_upload", message, details);
	}
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateSHA256(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return hashHex;
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken(): string | null {
	const csrfToken = document.cookie
		.split("; ")
		.find((row) => row.startsWith("XSRF-TOKEN="))
		?.split("=")[1];
	return csrfToken ? decodeURIComponent(csrfToken) : null;
}

/**
 * Build request headers with CSRF token and custom headers
 */
async function buildRequestHeaders(
	customHeaders?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>),
): Promise<Headers> {
	const headers = new Headers();
	headers.set("Content-Type", "application/json");
	headers.set("X-Requested-With", "XMLHttpRequest");
	headers.set("Accept", "application/json");

	// Add CSRF token if available
	const csrfToken = getCsrfToken();
	if (csrfToken) {
		headers.set("X-XSRF-TOKEN", csrfToken);
	}

	// Apply custom headers
	if (customHeaders) {
		const resolvedHeaders =
			typeof customHeaders === "function"
				? await customHeaders()
				: customHeaders;

		for (const [key, value] of Object.entries(resolvedHeaders)) {
			// Don't override critical headers
			if (
				key.toLowerCase() !== "content-type" &&
				key.toLowerCase() !== "accept" &&
				key.toLowerCase() !== "x-requested-with"
			) {
				headers.set(key, value);
			}
		}
	}

	return headers;
}

/**
 * Parse validation errors from server response
 */
function parseValidationErrors(errorData: ServerErrorResponse): string | null {
	if (!errorData.errors) {
		return null;
	}

	const fileErrors = Object.keys(errorData.errors)
		.filter((key) => key.startsWith("files."))
		.flatMap((key) => errorData.errors?.[key]);

	return fileErrors.length > 0 ? fileErrors.join(", ") : null;
}

/**
 * Handle specific HTTP status codes
 */
function getErrorDetailByStatus(status: number): string {
	switch (status) {
		case 401:
			return "User not authenticated";
		case 403:
			return "User not authorized";
		case 404:
			return "Upload endpoint not found";
		case 419:
			return "Session expired. Please refresh the page";
		case 429:
			return "Too many requests. Please try again later";
		case 500:
		case 502:
		case 503:
		case 504:
			return "Server error. Please try again later";
		default:
			return `Server responded with status ${status}`;
	}
}

/**
 * Handle 422 validation error response
 */
async function handle422Error(response: Response): Promise<UploadError> {
	try {
		const errorData = (await response.json()) as ServerErrorResponse;
		const validationMessage = parseValidationErrors(errorData);

		if (validationMessage) {
			return createError("validation_error", validationMessage, errorData);
		}

		// Fallback for 422 without specific errors
		const message = errorData.message || "Invalid file parameters";
		return createError("validation_error", message, errorData);
	} catch {
		return createError("validation_error", "Invalid file parameters");
	}
}

/**
 * Handle non-OK response from server
 */
async function handleErrorResponse(
	response: Response,
	errorMessage: string,
): Promise<never> {
	// Handle 422 specially
	if (response.status === 422) {
		const error = await handle422Error(response);
		throw error;
	}

	// Get error detail by status code
	const errorDetail = getErrorDetailByStatus(response.status);

	// Try to get additional error data from response
	let errorData = {};
	try {
		errorData = await response.json();
	} catch {
		// Ignore JSON parse errors
	}

	throw createError("server_error", errorMessage, {
		...errorData,
		status: response.status,
		details: errorDetail,
	});
}

/**
 * Request signed URLs for multiple files from Laravel in a single batch request
 */
export async function requestBatchSignedUrls(
	files: Array<{ file: File; sha256: string }>,
	presignEndpoint?: string,
	presignHeaders?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>),
): Promise<SignedUrlResponse[]> {
	const endpoint = presignEndpoint || "/signed-storage-url";

	const requestData = {
		files: files.map(({ file, sha256 }) => ({
			contentType: file.type || "application/octet-stream",
			filename: file.name,
			filesize: file.size,
			sha256: sha256,
		})),
	};

	const headers = await buildRequestHeaders(presignHeaders);

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(requestData),
			credentials: "same-origin",
		});

		if (!response.ok) {
			await handleErrorResponse(response, "Unable to obtain upload URL");
		}

		const responseData = await response.json();

		if (!(responseData.files && Array.isArray(responseData.files))) {
			throw createError(
				"invalid_response",
				"Invalid response from server",
				"Expected array of signed URLs",
			);
		}

		return responseData.files as SignedUrlResponse[];
	} catch (error) {
		if ((error as UploadError).type) {
			throw error;
		}

		// Handle network errors
		let details = "";
		if (!navigator.onLine) {
			details = "No internet connection";
		} else if (
			error instanceof TypeError &&
			error.message.includes("Failed to fetch")
		) {
			details = "Unable to reach server";
		} else {
			details =
				error instanceof Error ? error.message : "Network request failed";
		}

		throw createError("network_error", "Unable to obtain upload URL", details);
	}
}

/**
 * Upload a file to S3-compatible storage using a presigned URL
 * Supports any S3-compatible service: AWS S3, DigitalOcean Spaces,
 * Cloudflare R2, MinIO, Wasabi, Backblaze B2, etc.
 */
export async function uploadToS3Storage(params: {
	file: File;
	signedUrl: string;
	headers?: Record<string, string>;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		// Handle abort signal
		const abortHandler = () => {
			xhr.abort();
			reject(new Error("Upload aborted"));
		};

		if (params.signal?.aborted) {
			abortHandler();
			return;
		}

		params.signal?.addEventListener("abort", abortHandler);

		// Handle upload completion
		xhr.onloadend = () => {
			params.signal?.removeEventListener("abort", abortHandler);

			if (xhr.readyState === 4 && xhr.status === 200) {
				params.onProgress?.(1);
				resolve();
			} else {
				let errorMessage = "Upload failed";
				let errorDetail = "";
				if (xhr.status === 403) {
					errorMessage = "Upload unauthorized";
					errorDetail = "Signed URL may have expired";
				} else if (xhr.status === 0) {
					errorMessage = "Upload failed";
					errorDetail = "Network error or CORS issue";
				} else {
					errorMessage = "Upload failed";
					errorDetail = `Status ${xhr.status}`;
				}
				const err = new Error(errorMessage) as Error & { details?: string };
				err.details = errorDetail;
				reject(err);
			}
		};

		// Handle upload progress
		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable) {
				const progress = e.loaded / e.total;
				params.onProgress?.(progress);
			}
		});

		// Handle errors
		xhr.onerror = () => {
			params.signal?.removeEventListener("abort", abortHandler);
			reject(new Error("Network error during upload"));
		};

		// Open connection
		xhr.open("PUT", params.signedUrl);

		// Set headers
		if (params.headers) {
			for (const [key, value] of Object.entries(params.headers)) {
				xhr.setRequestHeader(key, value);
			}
		}

		// Send the file
		xhr.send(params.file);
	});
}

/**
 * Create an upload error object
 */
function createError(
	type: UploadError["type"],
	message: string,
	details?: unknown,
): UploadError {
	return { type, message, details };
}

/**
 * Format bytes as human-readable text
 */
export function formatBytes(
	bytes: number,
	options: { si?: boolean; decimalPlaces?: number } = {},
): string {
	const { si = true, decimalPlaces = 0 } = options;

	if (bytes === 0) {
		return "0 B";
	}

	const k = si ? 1000 : 1024;
	const dm = decimalPlaces < 0 ? 0 : decimalPlaces;
	const sizes = si
		? ["B", "kB", "MB", "GB", "TB", "PB"]
		: ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	if (i === 0) {
		return `${bytes} B`;
	}

	const value = bytes / k ** i;
	// Round based on decimal places
	const rounded =
		dm === 0 ? Math.round(value) : Number.parseFloat(value.toFixed(dm));

	// Format with correct decimal places
	const formatted = dm === 0 ? rounded.toString() : rounded.toFixed(dm);

	return `${formatted} ${sizes[i]}`;
}
