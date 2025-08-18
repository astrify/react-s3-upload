import type { Preview } from "@storybook/react";
import "../src/tailwind.css";

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
