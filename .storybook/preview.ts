import type { Preview } from "@storybook/react";
import "../src/tailwind.css";

// Note: Mock setup removed - now using dependency injection with stub implementations

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
