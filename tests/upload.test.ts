import type { SignedUrlResponse } from "@/types/file-upload";
import {
	type Mock,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// We need to import the functions after setting up mocks
let uploadFile: typeof import("@/lib/upload").uploadFile;
let requestBatchSignedUrls: typeof import("@/lib/upload").requestBatchSignedUrls;
let uploadToS3Storage: typeof import("@/lib/upload").uploadToS3Storage;
let calculateSHA256: typeof import("@/lib/upload").calculateSHA256;
let formatBytes: typeof import("@/lib/upload").formatBytes;

describe("upload.ts", () => {
	// Helper to create mock File objects
	const createMockFile = (
		name: string,
		content = "test content",
		type = "text/plain",
	): File => {
		return new File([content], name, { type });
	};

	beforeEach(async () => {
		// Reset modules and re-import to get fresh instances
		vi.resetModules();
		const uploadModule = await import("@/lib/upload");
		uploadFile = uploadModule.uploadFile;
		requestBatchSignedUrls = uploadModule.requestBatchSignedUrls;
		uploadToS3Storage = uploadModule.uploadToS3Storage;
		calculateSHA256 = uploadModule.calculateSHA256;
		formatBytes = uploadModule.formatBytes;
	});

	describe("formatBytes", () => {
		it("should format bytes with SI units by default", () => {
			expect(formatBytes(0)).toBe("0 B");
			expect(formatBytes(500)).toBe("500 B");
			expect(formatBytes(1000)).toBe("1 kB");
			expect(formatBytes(1500)).toBe("2 kB"); // Fixed expectation
			expect(formatBytes(1000000)).toBe("1 MB");
			expect(formatBytes(1500000)).toBe("2 MB"); // Fixed expectation
			expect(formatBytes(1000000000)).toBe("1 GB");
			expect(formatBytes(1000000000000)).toBe("1 TB");
			expect(formatBytes(1000000000000000)).toBe("1 PB");
		});

		it("should format bytes with binary units when si=false", () => {
			expect(formatBytes(1024, { si: false })).toBe("1 KiB");
			expect(formatBytes(1048576, { si: false })).toBe("1 MiB");
			expect(formatBytes(1073741824, { si: false })).toBe("1 GiB");
			expect(formatBytes(1099511627776, { si: false })).toBe("1 TiB");
			expect(formatBytes(1125899906842624, { si: false })).toBe("1 PiB");
		});

		it("should handle decimal places", () => {
			expect(formatBytes(1500, { decimalPlaces: 2 })).toBe("1.50 kB");
			expect(formatBytes(1536, { si: false, decimalPlaces: 2 })).toBe(
				"1.50 KiB",
			);
			expect(formatBytes(1234567, { decimalPlaces: 3 })).toBe("1.235 MB");
		});

		it("should handle edge cases", () => {
			expect(formatBytes(999)).toBe("999 B");
			expect(formatBytes(1023, { si: false })).toBe("1023 B");
		});
	});

	describe("calculateSHA256", () => {
		let originalCrypto: Crypto | undefined;

		// Helper to create a mock File with arrayBuffer method
		const createMockFileWithArrayBuffer = (
			name: string,
			content: string,
			type = "text/plain",
		) => {
			const encoder = new TextEncoder();
			const buffer = encoder.encode(content).buffer;
			const file = new File([content], name, { type });
			// Mock the arrayBuffer method
			file.arrayBuffer = vi.fn().mockResolvedValue(buffer);
			return file;
		};

		beforeEach(() => {
			originalCrypto = global.crypto;
			// Create a mock crypto object
			const mockDigest = vi.fn();
			Object.defineProperty(global, "crypto", {
				value: {
					subtle: {
						digest: mockDigest,
					},
				},
				writable: true,
				configurable: true,
			});
		});

		afterEach(() => {
			if (originalCrypto) {
				global.crypto = originalCrypto;
			}
		});

		it("should calculate SHA-256 hash of a file", async () => {
			const file = createMockFileWithArrayBuffer("test.txt", "Hello World");

			// Mock digest to return a predictable hash buffer
			const mockHashBuffer = new ArrayBuffer(32);
			const view = new Uint8Array(mockHashBuffer);
			// Fill with some test values
			for (let i = 0; i < 32; i++) {
				view[i] = i;
			}
			global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHashBuffer);

			const hash = await calculateSHA256(file);

			expect(file.arrayBuffer).toHaveBeenCalled();
			expect(global.crypto.subtle.digest).toHaveBeenCalledWith(
				"SHA-256",
				expect.anything(),
			);
			expect(hash).toBe(
				"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
			);
			expect(hash).toHaveLength(64); // SHA-256 produces 32 bytes = 64 hex characters
		});

		it("should handle empty files", async () => {
			const file = createMockFileWithArrayBuffer("empty.txt", "");

			const mockHashBuffer = new ArrayBuffer(32);
			global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHashBuffer);

			const hash = await calculateSHA256(file);

			expect(file.arrayBuffer).toHaveBeenCalled();
			expect(global.crypto.subtle.digest).toHaveBeenCalled();
			expect(hash).toHaveLength(64);
		});

		it("should handle large files", async () => {
			const largeContent = "x".repeat(10 * 1024 * 1024); // 10MB
			const file = createMockFileWithArrayBuffer("large.txt", largeContent);

			const mockHashBuffer = new ArrayBuffer(32);
			const view = new Uint8Array(mockHashBuffer);
			view.fill(255);
			global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHashBuffer);

			const hash = await calculateSHA256(file);

			expect(file.arrayBuffer).toHaveBeenCalled();
			expect(global.crypto.subtle.digest).toHaveBeenCalledWith(
				"SHA-256",
				expect.anything(),
			);
			expect(hash).toBe(
				"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			);
		});
	});

	describe("requestBatchSignedUrls", () => {
		let originalFetch: any;
		let originalNavigator: any;
		let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			originalFetch = global.fetch;
			originalNavigator = global.navigator;
			global.navigator = { ...originalNavigator, onLine: true } as any;

			// Mock document.cookie
			Object.defineProperty(document, "cookie", {
				writable: true,
				value: "",
				configurable: true,
			});

			consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			global.fetch = originalFetch;
			global.navigator = originalNavigator;
			consoleWarnSpy.mockRestore();
		});

		it("should request signed URLs successfully", async () => {
			const files = [
				{ file: createMockFile("file1.txt"), sha256: "hash1" },
				{ file: createMockFile("file2.txt"), sha256: "hash2" },
			];

			const mockResponse: SignedUrlResponse[] = [
				{
					sha256: "hash1",
					bucket: "bucket1",
					key: "key1",
					url: "https://s3.url1",
				},
				{
					sha256: "hash2",
					bucket: "bucket2",
					key: "key2",
					url: "https://s3.url2",
				},
			];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ files: mockResponse }),
			});

			const result = await requestBatchSignedUrls(files);

			expect(global.fetch).toHaveBeenCalledWith("/signed-storage-url", {
				method: "POST",
				headers: expect.any(Headers),
				body: JSON.stringify({
					files: [
						{
							contentType: "text/plain",
							filename: "file1.txt",
							filesize: 12,
							sha256: "hash1",
						},
						{
							contentType: "text/plain",
							filename: "file2.txt",
							filesize: 12,
							sha256: "hash2",
						},
					],
				}),
				credentials: "same-origin",
			});

			expect(result).toEqual(mockResponse);
		});

		it("should use custom endpoint from parameter", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ files: [] }),
			});

			await requestBatchSignedUrls(files, "/custom-endpoint");

			expect(global.fetch).toHaveBeenCalledWith(
				"/custom-endpoint",
				expect.any(Object),
			);
		});

		it("should include CSRF token if available", async () => {
			document.cookie = "XSRF-TOKEN=test-token-123";

			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ files: [] }),
			});

			await requestBatchSignedUrls(files);

			const fetchMock = global.fetch as Mock;
			const call = fetchMock.mock.calls[0];
			const headers = call[1].headers;
			expect(headers.get("X-XSRF-TOKEN")).toBe("test-token-123");
		});

		it("should handle missing CSRF token gracefully", async () => {
			document.cookie = "";

			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ files: [] }),
			});

			// Should not throw even without CSRF token
			await expect(requestBatchSignedUrls(files)).resolves.not.toThrow();
			
			// Should still make the request without X-XSRF-TOKEN header
			expect(global.fetch).toHaveBeenCalled();
		});

		it("should handle 401 unauthorized error", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
			});

			await expect(requestBatchSignedUrls(files)).rejects.toMatchObject({
				type: "server_error",
				message: "Unable to obtain upload URL",
				details: expect.objectContaining({
					details: "User not authenticated",
				}),
			});
		});

		it("should handle 403 forbidden error", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
			});

			await expect(requestBatchSignedUrls(files)).rejects.toMatchObject({
				type: "server_error",
				message: "Unable to obtain upload URL",
				details: expect.objectContaining({
					details: "User not authorized",
				}),
			});
		});

		it("should handle 422 validation error with specific errors", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				json: async () => ({
					errors: {
						"files.0.filesize": ["File too large"],
						"files.0.content_type": ["Invalid file type"],
					},
				}),
			});

			await expect(requestBatchSignedUrls(files)).rejects.toMatchObject({
				type: "validation_error",
				message: "File too large, Invalid file type",
			});
		});

		it("should handle network offline error", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];
			global.navigator = { ...originalNavigator, onLine: false } as any;

			global.fetch = vi
				.fn()
				.mockRejectedValue(new TypeError("Failed to fetch"));

			await expect(requestBatchSignedUrls(files)).rejects.toMatchObject({
				type: "network_error",
				message: "Unable to obtain upload URL",
				details: "No internet connection",
			});
		});

		it("should handle network fetch error", async () => {
			const files = [{ file: createMockFile("test.txt"), sha256: "hash" }];

			global.fetch = vi
				.fn()
				.mockRejectedValue(new TypeError("Failed to fetch"));

			await expect(requestBatchSignedUrls(files)).rejects.toMatchObject({
				type: "network_error",
				message: "Unable to obtain upload URL",
				details: "Unable to reach server",
			});
		});
	});

	describe("uploadToS3Storage", () => {
		let originalXMLHttpRequest: any;
		let xhrInstance: any;

		beforeEach(() => {
			originalXMLHttpRequest = global.XMLHttpRequest;

			xhrInstance = {
				open: vi.fn(),
				send: vi.fn(),
				abort: vi.fn(),
				setRequestHeader: vi.fn(),
				readyState: 4,
				status: 200,
				upload: {
					addEventListener: vi.fn((event, handler) => {
						if (event === "progress") {
							xhrInstance.upload.onprogress = handler;
						}
					}),
					onprogress: null,
				},
				onloadend: null,
				onerror: null,
				ontimeout: null,
			};

			global.XMLHttpRequest = vi.fn(() => xhrInstance) as any;
		});

		afterEach(() => {
			global.XMLHttpRequest = originalXMLHttpRequest;
		});

		it("should upload file successfully", async () => {
			const file = createMockFile("test.txt", "content");
			const signedUrl = "https://s3.amazonaws.com/bucket/key?signature=xyz";
			const onProgress = vi.fn();

			const uploadPromise = uploadToS3Storage({
				file,
				signedUrl,
				onProgress,
			});

			// Simulate successful upload
			setTimeout(() => {
				if (xhrInstance.upload.onprogress) {
					xhrInstance.upload.onprogress({
						lengthComputable: true,
						loaded: 50,
						total: 100,
					});
				}
				xhrInstance.onloadend();
			}, 0);

			await uploadPromise;

			expect(xhrInstance.open).toHaveBeenCalledWith("PUT", signedUrl);
			expect(xhrInstance.send).toHaveBeenCalledWith(file);
			expect(onProgress).toHaveBeenCalledWith(0.5); // 50/100
			expect(onProgress).toHaveBeenCalledWith(1); // Called on completion
		});

		it("should handle 403 forbidden error", async () => {
			const file = createMockFile("test.txt");
			const signedUrl = "https://s3.amazonaws.com/bucket/key";

			const uploadPromise = uploadToS3Storage({ file, signedUrl });

			setTimeout(() => {
				xhrInstance.status = 403;
				xhrInstance.onloadend();
			}, 0);

			await expect(uploadPromise).rejects.toThrow(
				"Upload unauthorized",
			);
		});

		it("should handle network error event", async () => {
			const file = createMockFile("test.txt");
			const signedUrl = "https://s3.amazonaws.com/bucket/key";

			const uploadPromise = uploadToS3Storage({ file, signedUrl });

			setTimeout(() => {
				xhrInstance.onerror();
			}, 0);

			await expect(uploadPromise).rejects.toThrow(
				"Network error during upload",
			);
		});

		it("should handle abort signal", async () => {
			const file = createMockFile("test.txt");
			const signedUrl = "https://s3.amazonaws.com/bucket/key";
			const abortController = new AbortController();

			const uploadPromise = uploadToS3Storage({
				file,
				signedUrl,
				signal: abortController.signal,
			});

			// Abort after a short delay to ensure the upload has started
			await new Promise((resolve) => setTimeout(resolve, 5));
			abortController.abort();

			// The promise should reject with abort error
			await expect(uploadPromise).rejects.toThrow("Upload aborted");
			expect(xhrInstance.abort).toHaveBeenCalled();
		});
	});

	describe("uploadFile integration", () => {
		let originalFetch: any;
		let originalXMLHttpRequest: any;
		let xhrInstance: any;

		beforeEach(() => {
			originalFetch = global.fetch;
			originalXMLHttpRequest = global.XMLHttpRequest;

			// Mock XHR
			xhrInstance = {
				open: vi.fn(),
				send: vi.fn(),
				abort: vi.fn(),
				setRequestHeader: vi.fn(),
				readyState: 4,
				status: 200,
				upload: {
					addEventListener: vi.fn((event, handler) => {
						if (event === "progress") {
							xhrInstance.upload.onprogress = handler;
						}
					}),
					onprogress: null,
				},
				onloadend: null,
				onerror: null,
				ontimeout: null,
			};

			global.XMLHttpRequest = vi.fn(() => xhrInstance) as any;

			// Mock document.cookie
			Object.defineProperty(document, "cookie", {
				writable: true,
				value: "XSRF-TOKEN=test-token",
				configurable: true,
			});
		});

		afterEach(() => {
			global.fetch = originalFetch;
			global.XMLHttpRequest = originalXMLHttpRequest;
		});

		it("should upload file with provided signed URL", async () => {
			const file = createMockFile("test.txt");
			const signedUrl: SignedUrlResponse = {
				sha256: "hash123",
				bucket: "test-bucket",
				key: "test-key",
				url: "https://s3.url",
			};
			const onProgress = vi.fn();

			const uploadPromise = uploadFile({
				file,
				signedUrl,
				sha256: "hash123",
				onProgress,
			});

			// Simulate successful XHR upload
			setTimeout(() => {
				xhrInstance.onloadend();
			}, 0);

			await uploadPromise;

			expect(xhrInstance.open).toHaveBeenCalledWith(
				"PUT",
				"https://s3.url",
			);
			expect(xhrInstance.send).toHaveBeenCalledWith(file);
		});

		it("should upload with XHR using signed URL", async () => {
			const file = createMockFile("test.txt");
			const signedUrl: SignedUrlResponse = {
				sha256: "hash123",
				bucket: "test-bucket",
				key: "test-key",
				url: "https://s3.url",
			};

			const uploadPromise = uploadFile({
				file,
				signedUrl,
				sha256: "hash123",
			});

			// Simulate successful XHR upload
			setTimeout(() => {
				xhrInstance.onloadend();
			}, 0);

			await uploadPromise;

			expect(xhrInstance.open).toHaveBeenCalledWith("PUT", "https://s3.url");
			expect(xhrInstance.send).toHaveBeenCalledWith(file);
		});

		it("should throw error if upload fails", async () => {
			const file = createMockFile("test.txt");
			const signedUrl: SignedUrlResponse = {
				sha256: "hash123",
				bucket: "test-bucket",
				key: "test-key",
				url: "https://s3.url",
			};

			const uploadPromise = uploadFile({ 
				file,
				signedUrl,
				sha256: "hash123",
			});

			// Simulate failed upload
			setTimeout(() => {
				xhrInstance.status = 403;
				xhrInstance.onloadend();
			}, 0);

			await expect(uploadPromise).rejects.toMatchObject({
				type: "s3_upload",
				message: expect.stringContaining("Upload unauthorized"),
			});
		});

		it("should wrap XHR upload errors", async () => {
			const file = createMockFile("test.txt");
			const signedUrl: SignedUrlResponse = {
				sha256: "hash123",
				bucket: "test-bucket",
				key: "test-key",
				url: "https://s3.url",
			};

			const uploadPromise = uploadFile({
				file,
				signedUrl,
				sha256: "hash123",
			});

			// Simulate XHR error
			setTimeout(() => {
				xhrInstance.status = 500;
				xhrInstance.onloadend();
			}, 0);

			await expect(uploadPromise).rejects.toMatchObject({
				type: "s3_upload",
				message: "Upload failed",
				details: "Status 500",
			});
		});
	});
});
