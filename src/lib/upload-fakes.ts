import type {
	SignedUrlResponse,
	UploadError,
	UploadLib,
} from "@/types/file-upload";

/**
 * Helper to simulate upload progress over time
 */
const simulateProgress = async (
	onProgress?: (progress: number) => void,
	duration = 2000,
): Promise<void> => {
	const steps = 20;
	const stepDuration = duration / steps;

	for (let i = 0; i <= steps; i++) {
		const progress = i / steps;
		onProgress?.(progress);
		if (i < steps) {
			await new Promise((resolve) => setTimeout(resolve, stepDuration));
		}
	}
};

/**
 * Helper to create mock file hash
 */
const createMockHash = (file: File): string => {
	return `mock-hash-${file.name}-${file.size}`;
};

// Default retry pattern for failure scenarios
const DEFAULT_FAILURE_PATTERN = /retry-me/;

/**
 * Upload fake that simulates successful uploads with progress (for Storybook demos)
 */
export const createUploadSuccessFake = (): UploadLib => ({
	calculateSHA256: async (file: File): Promise<string> => {
		// Simulate processing time
		await new Promise((resolve) => setTimeout(resolve, 100));
		return createMockHash(file);
	},

	requestBatchSignedUrls: async (
		files: Array<{ file: File; sha256: string }>,
	): Promise<SignedUrlResponse[]> => {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 200));

		return files.map((fileData) => ({
			sha256: fileData.sha256,
			bucket: "demo-bucket",
			key: `uploads/${fileData.file.name}`,
			url: `https://demo-s3.amazonaws.com/demo-bucket/uploads/${fileData.file.name}?signature=demo`,
		}));
	},

	uploadFile: async ({ file, sha256, onProgress }) => {
		// Variable duration based on file type for visual variety
		const duration = file.type.includes("image") ? 3000 : 2000;
		await simulateProgress((progress) => {
			onProgress?.(sha256, progress);
		}, duration);
	},
});

/**
 * Upload fake that simulates failures for specific files (for Storybook retry demos)
 */
export const createUploadFailureFake = (
	failurePattern = DEFAULT_FAILURE_PATTERN,
): UploadLib => {
	let retryCount = 0;

	return {
		calculateSHA256: async (file: File): Promise<string> => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return createMockHash(file);
		},

		requestBatchSignedUrls: async (
			files: Array<{ file: File; sha256: string }>,
		): Promise<SignedUrlResponse[]> => {
			await new Promise((resolve) => setTimeout(resolve, 200));

			return files.map((fileData) => ({
				sha256: fileData.sha256,
				bucket: "demo-bucket",
				key: `uploads/${fileData.file.name}`,
				url: `https://demo-s3.amazonaws.com/demo-bucket/uploads/${fileData.file.name}?signature=demo`,
			}));
		},

		uploadFile: async ({ file, sha256, onProgress }) => {
			// Fail first attempt for files matching pattern
			if (failurePattern.test(file.name) && retryCount === 0) {
				retryCount++;
				const error: UploadError = {
					type: "network_error",
					message:
						"Failed to connect to storage service. Please check your connection and try again.",
				};
				throw error;
			}

			const duration = file.type.includes("image") ? 1500 : 1000;
			await simulateProgress((progress) => {
				onProgress?.(sha256, progress);
			}, duration);
		},
	};
};

/**
 * Upload fake that simulates validation errors (for Storybook error demos)
 */
export const createUploadValidationErrorFake = (): UploadLib => ({
	calculateSHA256: async (file: File): Promise<string> => {
		await new Promise((resolve) => setTimeout(resolve, 100));
		return createMockHash(file);
	},

	requestBatchSignedUrls: async (): Promise<SignedUrlResponse[]> => {
		await new Promise((resolve) => setTimeout(resolve, 200));

		const error: UploadError = {
			type: "validation_error",
			message: "File size exceeds maximum allowed (50 MB)",
		};
		throw error;
	},

	uploadFile: async () => {
		const error: UploadError = {
			type: "validation_error",
			message: "File size exceeds maximum allowed (50 MB)",
		};
		throw error;
	},
});

/**
 * Upload fake that simulates duplicate file errors (for Storybook duplicate demos)
 */
export const createUploadDuplicateErrorFake = (): UploadLib => ({
	calculateSHA256: async (file: File): Promise<string> => {
		await new Promise((resolve) => setTimeout(resolve, 100));
		return createMockHash(file);
	},

	requestBatchSignedUrls: async (
		files: Array<{ file: File; sha256: string }>,
	): Promise<SignedUrlResponse[]> => {
		await new Promise((resolve) => setTimeout(resolve, 200));

		return files.map((fileData) => ({
			sha256: fileData.sha256,
			bucket: "demo-bucket",
			key: `uploads/${fileData.file.name}`,
			url: `https://demo-s3.amazonaws.com/demo-bucket/uploads/${fileData.file.name}?signature=demo`,
		}));
	},

	uploadFile: async () => {
		const error: UploadError = {
			type: "duplicate_file",
			message: "This file already exists on the server",
		};
		throw error;
	},
});

/**
 * Fast upload fake for testing - simulates instant successful uploads (no delays)
 */
export const createFastUploadFake = (): UploadLib => ({
	calculateSHA256: (file: File): Promise<string> => {
		return Promise.resolve(createMockHash(file));
	},

	requestBatchSignedUrls: (
		files: Array<{ file: File; sha256: string }>,
	): Promise<SignedUrlResponse[]> => {
		return Promise.resolve(
			files.map((fileData) => ({
				sha256: fileData.sha256,
				bucket: "test-bucket",
				key: `uploads/${fileData.file.name}`,
				url: `https://test-s3.amazonaws.com/test-bucket/uploads/${fileData.file.name}?signature=test`,
			})),
		);
	},

	uploadFile: ({ sha256, onProgress }) => {
		// Simulate instant progress updates for testing
		onProgress?.(sha256, 0.25);
		onProgress?.(sha256, 0.5);
		onProgress?.(sha256, 0.75);
		onProgress?.(sha256, 1);
		return Promise.resolve();
	},
});

/**
 * Fast upload error fake for testing - simulates instant errors (no delays)
 */
export const createFastUploadErrorFake = (
	errorType:
		| "network_error"
		| "validation_error"
		| "duplicate_file" = "network_error",
): UploadLib => ({
	calculateSHA256: (file: File): Promise<string> => {
		return Promise.resolve(createMockHash(file));
	},

	requestBatchSignedUrls: (
		files: Array<{ file: File; sha256: string }>,
	): Promise<SignedUrlResponse[]> => {
		if (errorType === "validation_error") {
			const error: UploadError = {
				type: "validation_error",
				message: "File size exceeds maximum allowed (50 MB)",
			};
			return Promise.reject(error);
		}

		return Promise.resolve(
			files.map((fileData) => ({
				sha256: fileData.sha256,
				bucket: "test-bucket",
				key: `uploads/${fileData.file.name}`,
				url: `https://test-s3.amazonaws.com/test-bucket/uploads/${fileData.file.name}?signature=test`,
			})),
		);
	},

	uploadFile: () => {
		const error: UploadError = {
			type: errorType,
			message:
				errorType === "duplicate_file"
					? "This file already exists on the server"
					: errorType === "validation_error"
						? "File size exceeds maximum allowed (50 MB)"
						: "Upload failed",
		};
		return Promise.reject(error);
	},
});

/**
 * Fast upload retry fake for testing - fails first attempt, succeeds on retry (no delays)
 */
export const createFastUploadRetryFake = (): UploadLib => {
	const attemptCount = new Map<string, number>();

	return {
		calculateSHA256: (file: File): Promise<string> => {
			return Promise.resolve(createMockHash(file));
		},

		requestBatchSignedUrls: (
			files: Array<{ file: File; sha256: string }>,
		): Promise<SignedUrlResponse[]> => {
			return Promise.resolve(
				files.map((fileData) => ({
					sha256: fileData.sha256,
					bucket: "test-bucket",
					key: `uploads/${fileData.file.name}`,
					url: `https://test-s3.amazonaws.com/test-bucket/uploads/${fileData.file.name}?signature=test`,
				})),
			);
		},

		uploadFile: ({ sha256, onProgress }) => {
			const attempts = attemptCount.get(sha256) || 0;
			attemptCount.set(sha256, attempts + 1);

			if (attempts === 0) {
				// Fail first attempt
				const error: UploadError = {
					type: "network_error",
					message: "Network error",
				};
				return Promise.reject(error);
			}

			// Succeed on retry
			onProgress?.(sha256, 1);
			return Promise.resolve();
		},
	};
};

/**
 * Default upload fake for general use - successful uploads with progress
 */
export const defaultUploadFake = createUploadSuccessFake();
