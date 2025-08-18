import {
	type FileUploadConfig,
	FileUploadProvider,
	type FileUploadProviderProps,
	useFileErrors,
	useFileUpload,
} from "@/FileUploadContext";
import type { FileUpload, SignedUrlResponse } from "@/types/file-upload";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the upload utilities
vi.mock("@/lib/upload", () => ({
	uploadFile: vi.fn(),
	requestBatchSignedUrls: vi.fn(),
	calculateSHA256: vi.fn(),
}));

import {
	calculateSHA256,
	requestBatchSignedUrls,
	uploadFile,
} from "@/lib/upload";

describe("FileUploadContext", () => {
	// Helper to create a wrapper component with provider
	const createWrapper = (props?: Partial<FileUploadProviderProps>) => {
		return ({ children }: { children: ReactNode }) => (
			<FileUploadProvider {...props}>{children}</FileUploadProvider>
		);
	};

	// Helper to create mock File objects
	const createMockFile = (
		name: string,
		size = 1024,
		type = "text/plain",
	): File => {
		const blob = new Blob(["a".repeat(size)], { type });
		return new File([blob], name, { type });
	};

	// Mock URL methods
	const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
	const mockRevokeObjectURL = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		global.URL.createObjectURL = mockCreateObjectURL;
		global.URL.revokeObjectURL = mockRevokeObjectURL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("useFileUpload hook", () => {
		it("should throw error when used outside provider", () => {
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			expect(() => {
				renderHook(() => useFileUpload());
			}).toThrow("useFileUpload must be used within FileUploadProvider");

			consoleError.mockRestore();
		});

		it("should provide initial context values", () => {
			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			expect(result.current.files).toEqual([]);
			expect(result.current.errors).toEqual([]);
			expect(result.current.isUploading).toBe(false);
			expect(result.current.remainingSlots).toBe(10);
			expect(result.current.canAcceptMore).toBe(true);
			expect(result.current.hasPending).toBe(false);
			expect(result.current.hasUploading).toBe(false);
			expect(result.current.hasErrors).toBe(false);
			expect(result.current.hasComplete).toBe(false);
		});

		it("should use custom config values", () => {
			const config: FileUploadConfig = {
				maxFiles: 5,
				maxSize: 10 * 1024 * 1024,
				accept: { "image/*": [] },
				presignEndpoint: "/custom-url",
			};

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ config }),
			});

			expect(result.current.config).toMatchObject(config);
			expect(result.current.remainingSlots).toBe(5);
			expect(result.current.maxFileSize).toBe(10 * 1024 * 1024);
			expect(result.current.acceptedFileTypes).toEqual({ "image/*": [] });
		});

		it("should initialize with default files", () => {
			const defaultFiles: FileUpload[] = [
				{
					id: "hash123",
					name: "existing.txt",
					size: 1024,
					type: "text/plain",
					sha256: "hash123",
					url: "https://example.com/file",
					status: "complete",
					progress: 100,
				},
			];

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ defaultFiles }),
			});

			expect(result.current.files).toHaveLength(1);
			expect(result.current.files[0]).toMatchObject({
				id: "hash123",
				name: "existing.txt",
				status: "complete",
				progress: 100,
			});
			expect(result.current.hasComplete).toBe(true);
			expect(result.current.remainingSlots).toBe(9);
		});
	});

	describe("addFiles", () => {
		it("should add files and request signed URLs", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const mockSignedUrlResponse: SignedUrlResponse = {
				sha256: mockHash,
				bucket: "test-bucket",
				key: "test-key",
				url: "https://signed-url.com",
			};

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				mockSignedUrlResponse,
			]);
			// Don't let upload complete
			let uploadResolve: any;
			vi.mocked(uploadFile).mockImplementation(
				() =>
					new Promise((resolve) => {
						uploadResolve = resolve;
					}),
			);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			// File starts as pending, then moves to uploading
			// Check that it exists and has the right properties
			await waitFor(() => {
				expect(result.current.files).toHaveLength(1);
				expect(result.current.files[0].name).toBe("test.txt");
			});

			expect(calculateSHA256).toHaveBeenCalledWith(mockFile);
			expect(requestBatchSignedUrls).toHaveBeenCalled();

			// Cleanup - let upload complete
			uploadResolve?.();
		});

		it("should handle file limit restrictions", async () => {
			const config: FileUploadConfig = { maxFiles: 2 };
			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ config }),
			});

			const files = [
				createMockFile("file1.txt"),
				createMockFile("file2.txt"),
				createMockFile("file3.txt"),
			];

			vi.mocked(calculateSHA256)
				.mockResolvedValueOnce("hash1")
				.mockResolvedValueOnce("hash2")
				.mockResolvedValueOnce("hash3");

			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: "hash1", bucket: "", key: "", url: "url1" },
				{ sha256: "hash2", bucket: "", key: "", url: "url2" },
			]);

			await act(async () => {
				await result.current.addFiles(files);
			});

			expect(result.current.files).toHaveLength(2);
			expect(result.current.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "validation_error",
						message: "File limit exceeded",
						details: "Only 2 more file(s) can be added",
					}),
				]),
			);
			expect(result.current.canAcceptMore).toBe(false);
		});

		it("should detect and handle duplicate files", async () => {
			const mockFile1 = createMockFile("test.txt");
			const mockFile2 = createMockFile("test-copy.txt");
			const mockHash = "same-hash";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			// Add first file
			await act(async () => {
				await result.current.addFiles([mockFile1]);
			});

			expect(result.current.files).toHaveLength(1);

			// Try to add duplicate
			await act(async () => {
				await result.current.addFiles([mockFile2]);
			});

			// Should still have only 1 file
			expect(result.current.files).toHaveLength(1);

			// Should have set duplicateAlert temporarily
			expect(result.current.files[0].duplicateAlert).toBe(true);
		});

		it("should create image previews", async () => {
			const mockImageFile = createMockFile("image.jpg", 1024, "image/jpeg");
			const mockHash = "image-hash";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockImageFile]);
			});

			expect(mockCreateObjectURL).toHaveBeenCalledWith(mockImageFile);
			expect(result.current.files[0].preview).toBe("blob:mock-url");
		});

		it("should call onFilesChange callback", async () => {
			const onFilesChange = vi.fn();
			const mockFile = createMockFile("test.txt");

			vi.mocked(calculateSHA256).mockResolvedValue("hash1");
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: "hash1", bucket: "", key: "", url: "url1" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ config: { onFilesChange } }),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			expect(onFilesChange).toHaveBeenCalledWith([mockFile]);
		});
	});

	describe("removeFile", () => {
		it("should remove a file and cleanup resources", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			expect(result.current.files).toHaveLength(1);

			act(() => {
				result.current.removeFile(mockHash);
			});

			expect(result.current.files).toHaveLength(0);
			expect(result.current.remainingSlots).toBe(10);
		});

		it("should abort upload in progress when removing", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const abortSpy = vi.fn();

			// Mock AbortController
			const MockAbortController = vi.fn().mockImplementation(() => ({
				abort: abortSpy,
				signal: {},
			}));
			global.AbortController = MockAbortController as any;

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			// Make uploadFile hang to simulate ongoing upload
			vi.mocked(uploadFile).mockImplementation(() => new Promise(() => {}));

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			// Wait for upload to start
			await waitFor(() => {
				expect(uploadFile).toHaveBeenCalled();
			});

			act(() => {
				result.current.removeFile(mockHash);
			});

			expect(abortSpy).toHaveBeenCalled();
		});
	});

	describe("removeAll", () => {
		it("should remove all files and cleanup resources", async () => {
			const files = [createMockFile("file1.txt"), createMockFile("file2.txt")];

			vi.mocked(calculateSHA256)
				.mockResolvedValueOnce("hash1")
				.mockResolvedValueOnce("hash2");

			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: "hash1", bucket: "", key: "", url: "url1" },
				{ sha256: "hash2", bucket: "", key: "", url: "url2" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles(files);
			});

			expect(result.current.files).toHaveLength(2);

			act(() => {
				result.current.removeAll();
			});

			expect(result.current.files).toHaveLength(0);
			expect(result.current.errors).toHaveLength(0);
			expect(result.current.remainingSlots).toBe(10);
		});
	});

	describe("upload queue processing", () => {
		it("should automatically start uploading pending files", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);
			vi.mocked(uploadFile).mockResolvedValue(undefined);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			// Wait for upload to complete
			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("complete");
			});

			expect(uploadFile).toHaveBeenCalled();
			expect(result.current.hasComplete).toBe(true);
			expect(result.current.isUploading).toBe(false);
		});

		it("should respect max concurrency limit", async () => {
			const files = Array.from({ length: 5 }, (_, i) =>
				createMockFile(`file${i}.txt`),
			);

			const hashes = files.map((_, i) => `hash${i}`);

			hashes.forEach((hash, _i) => {
				vi.mocked(calculateSHA256).mockResolvedValueOnce(hash);
			});

			vi.mocked(requestBatchSignedUrls).mockResolvedValue(
				hashes.map((hash) => ({
					sha256: hash,
					bucket: "",
					key: "",
					url: `url-${hash}`,
				})),
			);

			// Make uploads hang to count concurrent uploads
			let activeUploads = 0;
			let maxConcurrent = 0;

			vi.mocked(uploadFile).mockImplementation(async () => {
				activeUploads++;
				maxConcurrent = Math.max(maxConcurrent, activeUploads);
				await new Promise((resolve) => setTimeout(resolve, 10));
				activeUploads--;
			});

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles(files);
			});

			// Wait for all uploads to complete
			await waitFor(
				() => {
					expect(
						result.current.files.every((f) => f.status === "complete"),
					).toBe(true);
				},
				{ timeout: 5000 },
			);

			// Should not exceed max concurrency (3)
			expect(maxConcurrent).toBeLessThanOrEqual(3);
		});

		it("should handle upload errors", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const mockError = {
				type: "s3_upload",
				message: "Upload failed",
				details: {},
			};

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);
			vi.mocked(uploadFile).mockRejectedValue(mockError);

			const onUploadError = vi.fn();
			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ config: { onUploadError } }),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("error");
			});

			expect(result.current.files[0].error).toBe("Upload failed");
			expect(result.current.hasErrors).toBe(true);
			expect(onUploadError).toHaveBeenCalled();
		});

		it("should handle duplicate file errors specially", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const duplicateError = {
				type: "duplicate_file" as const,
				message: "File already exists",
				details: {},
			};

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);
			vi.mocked(uploadFile).mockRejectedValue(duplicateError);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			await waitFor(() => {
				expect(result.current.files).toHaveLength(0);
			});

			expect(result.current.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "duplicate_file",
						message: "test.txt was not uploaded",
						details: "This file already exists on the server",
					}),
				]),
			);
		});

		it("should track upload progress", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const progressValues: number[] = [];

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			vi.mocked(uploadFile).mockImplementation(async ({ sha256, onProgress }) => {
				onProgress?.(sha256, 0.25);
				onProgress?.(sha256, 0.5);
				onProgress?.(sha256, 0.75);
				onProgress?.(sha256, 1);
			});

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("complete");
			});

			expect(result.current.files[0].progress).toBe(100);
		});

		it("should call onUploadComplete callback", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";
			const onUploadComplete = vi.fn();

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);
			vi.mocked(uploadFile).mockResolvedValue(undefined);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper({ config: { onUploadComplete } }),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			// Wait for the upload to complete and callback to be called
			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("complete");
				expect(onUploadComplete).toHaveBeenCalled();
			});

			// The callback receives the file at the time it's called
			// which may have stale data due to closure
			expect(onUploadComplete).toHaveBeenCalled();
			expect(onUploadComplete.mock.calls[0][0]).toHaveLength(1);
			expect(onUploadComplete.mock.calls[0][0][0]).toHaveProperty(
				"name",
				"test.txt",
			);
		});
	});

	describe("retryUpload", () => {
		it("should retry failed upload", async () => {
			const mockFile = createMockFile("test.txt");
			const mockHash = "abc123";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			// First upload fails
			vi.mocked(uploadFile).mockRejectedValueOnce({
				type: "s3_upload",
				message: "Network error",
				details: {},
			});

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockFile]);
			});

			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("error");
			});

			// Now make upload succeed
			vi.mocked(uploadFile).mockResolvedValue(undefined);

			await act(async () => {
				await result.current.retryUpload(mockHash);
			});

			await waitFor(() => {
				expect(result.current.files[0]?.status).toBe("complete");
			});
		});
	});

	describe("error management", () => {
		it("should add and clear errors", () => {
			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.addErrors([
				{ type: "validation_error", message: "Error 1", details: "Details 1" },
				{ type: "validation_error", message: "Error 2", details: "Details 2" },
			]);
			});

			expect(result.current.errors).toEqual([
			{ type: "validation_error", message: "Error 1", details: "Details 1" },
			{ type: "validation_error", message: "Error 2", details: "Details 2" },
		]);
			expect(result.current.hasErrors).toBe(true);

			act(() => {
				result.current.clearErrors();
			});

			expect(result.current.errors).toEqual([]);
			expect(result.current.hasErrors).toBe(false);
		});
	});

	describe("scoped hooks", () => {
		it("useFileErrors should provide errors array", () => {
			// Create a test hook that uses both hooks in the same context
			const useTestHooks = () => {
				const context = useFileUpload();
				const errors = useFileErrors();
				return { context, errors };
			};

			const { result } = renderHook(() => useTestHooks(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.context.addErrors([
					{ type: "validation_error", message: "Test error", details: "Test details" },
				]);
			});

			expect(result.current.errors).toEqual([
				{ type: "validation_error", message: "Test error", details: "Test details" },
			]);
		});
	});

	describe("cleanup", () => {
		it("should cleanup preview URLs when removing files", async () => {
			const mockImageFile = createMockFile("image.jpg", 1024, "image/jpeg");
			const mockHash = "image-hash";

			vi.mocked(calculateSHA256).mockResolvedValue(mockHash);
			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: mockHash, bucket: "", key: "", url: "url1" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles([mockImageFile]);
			});

			const previewUrl = result.current.files[0].preview;
			expect(previewUrl).toBeDefined();

			act(() => {
				result.current.removeFile(mockHash);
			});

			expect(mockRevokeObjectURL).toHaveBeenCalledWith(previewUrl);
		});

		it("should cleanup all resources on reset", async () => {
			const files = [
				createMockFile("image1.jpg", 1024, "image/jpeg"),
				createMockFile("image2.jpg", 1024, "image/jpeg"),
			];

			vi.mocked(calculateSHA256)
				.mockResolvedValueOnce("hash1")
				.mockResolvedValueOnce("hash2");

			vi.mocked(requestBatchSignedUrls).mockResolvedValue([
				{ sha256: "hash1", bucket: "", key: "", url: "url1" },
				{ sha256: "hash2", bucket: "", key: "", url: "url2" },
			]);

			const { result } = renderHook(() => useFileUpload(), {
				wrapper: createWrapper(),
			});

			await act(async () => {
				await result.current.addFiles(files);
			});

			expect(result.current.files).toHaveLength(2);

			act(() => {
				result.current.reset();
			});

			expect(result.current.files).toHaveLength(0);
			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
		});
	});
});
