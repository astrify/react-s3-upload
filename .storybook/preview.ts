import type { Preview } from "@storybook/react";
import "../src/tailwind.css";

// Polyfill for __vitest_mocker__ in production builds
// This fixes the "Cannot read properties of undefined (reading 'mockObject')" error on GitHub Pages
if (typeof globalThis.__vitest_mocker__ === "undefined") {
	// @ts-ignore
	globalThis.__vitest_mocker__ = {
		mockObject: (obj: any, type: string) => {
			// Return a proxy that wraps the original object
			// This allows mocked() to work in production builds
			return new Proxy(obj, {
				get(target, prop) {
					// If it's a function that we want to mock, wrap it
					if (typeof target[prop] === "function") {
						// Create a mock function with Jest-like API
						const mockFn = function(...args: any[]) {
							if (mockFn._mockImplementation) {
								return mockFn._mockImplementation(...args);
							}
							return target[prop](...args);
						};
						
						// Add mock methods
						mockFn._mockImplementation = null;
						mockFn.mockImplementation = (impl: any) => {
							mockFn._mockImplementation = impl;
							return mockFn;
						};
						mockFn.mockReset = () => {
							mockFn._mockImplementation = null;
							return mockFn;
						};
						mockFn.mockClear = () => {
							return mockFn;
						};
						
						return mockFn;
					}
					return target[prop];
				},
			});
		},
	};
}

// Set up automocking for upload functions
// @ts-ignore - sb is a Storybook global
if (typeof sb !== "undefined") {
	// Mock the upload module functions with spy: true to preserve original implementations
	// This allows selective mocking in stories while keeping formatBytes and other utilities intact
	// @ts-ignore - sb is a Storybook global
	sb.mock(import("../src/lib/upload.ts"), { spy: true });
}

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
		docs: {
			codePanel: true,
		},
	},
};

export default preview;
