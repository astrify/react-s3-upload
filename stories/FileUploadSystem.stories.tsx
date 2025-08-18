import { FileUploadProvider, useFileUpload } from "@/FileUploadContext";
import { FileDropzone } from "@/components/FileDropzone";
import { FileErrors } from "@/components/FileErrors";
import { FileHeader } from "@/components/FileHeader";
import { FileList } from "@/components/FileList";
import {
	calculateSHA256,
	requestBatchSignedUrls,
	uploadFile,
	uploadToS3Storage,
} from "@/lib/upload";
import type { SignedUrlResponse, UploadError } from "@/types/file-upload";
import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@storybook/test";
import { Toaster } from "sonner";
import { mocked } from "storybook/test";

// Component that composes all file upload components
function FileUploadSystem() {
	return (
		<>
			<FileUploadProvider
				config={{
					maxFiles: 10,
					maxSize: 50 * 1024 * 1024, // 50MB
					presignEndpoint: "/api/signed-url",
				}}
			>
				<div className="space-y-4">
					<FileDropzone />
					<FileErrors />
					<FileHeader />
					<FileList />
				</div>
			</FileUploadProvider>
			<Toaster position="bottom-right" richColors />
		</>
	);
}


const meta = {
	title: "System/FileUploadSystem",
	component: FileUploadSystem,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<div className="min-h-[600px] p-4">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FileUploadSystem>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create mock files
const createMockFile = (
	name: string,
	size: number,
	type = "text/plain",
): File => {
	const content = new Array(size).fill("a").join("");
	return new File([content], name, { type });
};

// Helper to simulate upload progress
const simulateUploadProgress = async (
	onProgress?: (progress: number) => void,
	duration = 2000,
) => {
	const steps = 20;
	const stepDuration = duration / steps;

	for (let i = 0; i <= steps; i++) {
		const progress = i / steps;
		if (onProgress) {
			onProgress(progress);
		}
		if (i < steps) {
			await new Promise((resolve) => setTimeout(resolve, stepDuration));
		}
	}
};

// Shows various file types being uploaded
export const MultipleFileTypes: Story = {
	beforeEach: async () => {
		mocked(calculateSHA256).mockImplementation(async (file: File) => {
			return `mock-hash-${file.name}`;
		});

		mocked(requestBatchSignedUrls).mockImplementation(async (files) => {
			const mockResponses: SignedUrlResponse[] = files.map((fileData) => ({
				sha256: fileData.sha256,
				bucket: "mock-bucket",
				key: `uploads/${fileData.file.name}`,
				url: `https://mock-s3.amazonaws.com/mock-bucket/uploads/${fileData.file.name}?signature=mock`,
			}));
			await new Promise((resolve) => setTimeout(resolve, 200));
			return mockResponses;
		});

		mocked(uploadToS3Storage).mockImplementation(
			async ({ file, onProgress }) => {
				// Variable speed based on file type for visual variety
				const duration = file.type.includes("image") ? 3000 : 2000;
				await simulateUploadProgress(onProgress, duration);
				return Promise.resolve();
			},
		);

		mocked(uploadFile).mockImplementation(async ({ file, sha256, onProgress }) => {
			await new Promise((resolve) => setTimeout(resolve, 200));
			const duration = file.type.includes("image") ? 3000 : 2000;
			await simulateUploadProgress((progress) => {
				onProgress?.(sha256, progress);
			}, duration);
			return Promise.resolve();
		});
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Create various file types
		const mockFiles = [
			createMockFile("document.pdf", 1024 * 1024, "application/pdf"),
			createMockFile("photo.jpg", 2 * 1024 * 1024, "image/jpeg"),
			createMockFile("spreadsheet.xlsx", 512 * 1024, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
			createMockFile("video.mp4", 5 * 1024 * 1024, "video/mp4"),
			createMockFile("archive.zip", 3 * 1024 * 1024, "application/zip"),
		];

		const dropzone = canvas.getByText(/Drop files here/i).closest("div");
		if (!dropzone) throw new Error("Dropzone not found");

		const dataTransfer = new DataTransfer();
		mockFiles.forEach((file) => dataTransfer.items.add(file));

		const dropEvent = new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer,
		});

		dropzone.dispatchEvent(dropEvent);
	},
};

// Shows retry functionality
export const WithRetry: Story = {
	beforeEach: async () => {
		let retryCount = 0;
		
		mocked(calculateSHA256).mockImplementation(async (file: File) => {
			return `mock-hash-${file.name}`;
		});

		mocked(requestBatchSignedUrls).mockImplementation(async (files) => {
			const mockResponses: SignedUrlResponse[] = files.map((fileData) => ({
				sha256: fileData.sha256,
				bucket: "mock-bucket",
				key: `uploads/${fileData.file.name}`,
				url: `https://mock-s3.amazonaws.com/mock-bucket/uploads/${fileData.file.name}?signature=mock`,
			}));
			await new Promise((resolve) => setTimeout(resolve, 200));
			return mockResponses;
		});

		mocked(uploadToS3Storage).mockImplementation(
			async ({ file, onProgress }) => {
				// Fail first attempt for specific file
				if (file.name === "retry-me.txt" && retryCount === 0) {
					retryCount++;
					const error = {
						type: "network_error",
						message: "Failed to connect to storage service. Please check your connection and try again.",
					} as UploadError;
					throw error;
				}
				await simulateUploadProgress(onProgress, 1500);
				return Promise.resolve();
			},
		);

		mocked(uploadFile).mockImplementation(async ({ file, sha256, signedUrl, onProgress }) => {
			if (signedUrl) {
				return mocked(uploadToS3Storage)({
					file,
					signedUrl: signedUrl.url,
					onProgress: (progress) => onProgress?.(sha256, progress),
				});
			}
			await new Promise((resolve) => setTimeout(resolve, 200));
			if (file.name === "retry-me.txt" && retryCount === 0) {
				retryCount++;
				const error = {
					type: "network_error",
					message: "Failed to connect to storage service. Please check your connection and try again.",
				} as UploadError;
				throw error;
			}
			await simulateUploadProgress((progress) => {
				onProgress?.(sha256, progress);
			}, 1500);
			return Promise.resolve();
		});
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await new Promise((resolve) => setTimeout(resolve, 100));

		const mockFile = createMockFile("retry-me.txt", 512 * 1024);

		const dropzone = canvas.getByText(/Drop files here/i).closest("div");
		if (!dropzone) throw new Error("Dropzone not found");

		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(mockFile);

		const dropEvent = new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer,
		});

		dropzone.dispatchEvent(dropEvent);
		
		// Wait for error to occur
		await new Promise((resolve) => setTimeout(resolve, 2000));
		
		// User can click retry button to retry the upload
	},
};

// Shows validation errors
export const ValidationErrors: Story = {
	beforeEach: async () => {
		mocked(calculateSHA256).mockImplementation(async (file: File) => {
			return `mock-hash-${file.name}`;
		});

		mocked(requestBatchSignedUrls).mockImplementation(async () => {
			// Return validation error
			const error = {
				type: "validation_error",
				message: "File size exceeds maximum allowed (50 MB)",
			} as UploadError;
			throw error;
		});

		mocked(uploadToS3Storage).mockImplementation(
			async ({ file, onProgress }) => {
				await simulateUploadProgress(onProgress, 1500);
				return Promise.resolve();
			},
		);

		mocked(uploadFile).mockImplementation(async () => {
			const error = {
				type: "validation_error",
				message: "File size exceeds maximum allowed (50 MB)",
			} as UploadError;
			throw error;
		});
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await new Promise((resolve) => setTimeout(resolve, 100));

		const mockFile = createMockFile("too-large.zip", 15 * 1024 * 1024, "application/zip");

		const dropzone = canvas.getByText(/Drop files here/i).closest("div");
		if (!dropzone) throw new Error("Dropzone not found");

		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(mockFile);

		const dropEvent = new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer,
		});

		dropzone.dispatchEvent(dropEvent);
		
		// Wait for validation error to appear
		await new Promise((resolve) => setTimeout(resolve, 1000));
	},
};