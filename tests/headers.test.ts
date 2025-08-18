import { describe, expect, it, vi } from "vitest";
import { requestBatchSignedUrls } from "@/lib/upload";

describe("Custom Headers for Signed URL Requests", () => {
	it("should support static headers", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				files: [
					{
						sha256: "test-hash",
						bucket: "test-bucket",
						key: "test-key",
						url: "https://example.com/signed-url",
					},
				],
			}),
		});
		global.fetch = mockFetch;

		await requestBatchSignedUrls(
			[{ file: new File(["test"], "test.txt"), sha256: "test-hash" }],
			undefined,
			{
				"Authorization": "Bearer test-token",
				"X-Custom-Header": "custom-value",
			}
		);

		const [url, options] = mockFetch.mock.calls[0];
		const headers = options.headers;

		expect(headers.get("Authorization")).toBe("Bearer test-token");
		expect(headers.get("X-Custom-Header")).toBe("custom-value");
		// Default headers should still be present
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(headers.get("Accept")).toBe("application/json");
	});

	it("should support dynamic headers via function", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				files: [
					{
						sha256: "test-hash",
						bucket: "test-bucket", 
						key: "test-key",
						url: "https://example.com/signed-url",
					},
				],
			}),
		});
		global.fetch = mockFetch;

		const getAuthToken = () => "dynamic-token-123";

		await requestBatchSignedUrls(
			[{ file: new File(["test"], "test.txt"), sha256: "test-hash" }],
			undefined,
			() => ({
				"Authorization": `Bearer ${getAuthToken()}`,
				"X-Request-ID": Date.now().toString(),
			})
		);

		const [url, options] = mockFetch.mock.calls[0];
		const headers = options.headers;

		expect(headers.get("Authorization")).toBe("Bearer dynamic-token-123");
		expect(headers.get("X-Request-ID")).toBeTruthy();
	});

	it("should support async header functions", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				files: [
					{
						sha256: "test-hash",
						bucket: "test-bucket",
						key: "test-key",
						url: "https://example.com/signed-url",
					},
				],
			}),
		});
		global.fetch = mockFetch;

		const getAsyncToken = async () => {
			// Simulate async token fetching
			await new Promise(resolve => setTimeout(resolve, 10));
			return "async-token-456";
		};

		await requestBatchSignedUrls(
			[{ file: new File(["test"], "test.txt"), sha256: "test-hash" }],
			undefined,
			async () => ({
				"Authorization": `Bearer ${await getAsyncToken()}`,
			})
		);

		const [url, options] = mockFetch.mock.calls[0];
		const headers = options.headers;

		expect(headers.get("Authorization")).toBe("Bearer async-token-456");
	});

	it("should not override critical headers", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				files: [
					{
						sha256: "test-hash",
						bucket: "test-bucket",
						key: "test-key",
						url: "https://example.com/signed-url",
					},
				],
			}),
		});
		global.fetch = mockFetch;

		await requestBatchSignedUrls(
			[{ file: new File(["test"], "test.txt"), sha256: "test-hash" }],
			undefined,
			{
				"Content-Type": "text/plain", // Should be ignored
				"Accept": "text/html", // Should be ignored
				"X-Requested-With": "custom", // Should be ignored
				"Authorization": "Bearer token", // Should be applied
			}
		);

		const [url, options] = mockFetch.mock.calls[0];
		const headers = options.headers;

		// Critical headers should not be overridden
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(headers.get("Accept")).toBe("application/json");
		expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
		// Custom header should be applied
		expect(headers.get("Authorization")).toBe("Bearer token");
	});

	it("should still include CSRF token when available", async () => {
		// Mock CSRF token in cookie
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "XSRF-TOKEN=csrf-test-token",
		});

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				files: [
					{
						sha256: "test-hash",
						bucket: "test-bucket",
						key: "test-key",
						url: "https://example.com/signed-url",
					},
				],
			}),
		});
		global.fetch = mockFetch;

		await requestBatchSignedUrls(
			[{ file: new File(["test"], "test.txt"), sha256: "test-hash" }],
			undefined,
			{
				"Authorization": "Bearer token",
			}
		);

		const [url, options] = mockFetch.mock.calls[0];
		const headers = options.headers;

		expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-test-token");
		expect(headers.get("Authorization")).toBe("Bearer token");

		// Clean up
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "",
		});
	});
});