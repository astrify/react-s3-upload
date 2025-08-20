import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: ["../stories/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
	addons: [
		"@storybook/addon-links",
		{
			name: "@storybook/addon-essentials",
			options: {
				actions: false,      // Disable actions logging
				backgrounds: false,  // Disable background color selector
				controls: false,     // Disable controls panel
				docs: false,        // Disable docs
				viewport: false,    // Disable viewport selector
				toolbars: false,    // Disable toolbars
				measure: false,     // Disable measure tool
				outline: false,     // Disable outline tool
			}
		},
		"@storybook/addon-interactions",
	],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	core: {
		builder: {
			name: "@storybook/builder-vite",
			options: {
				viteConfigPath: ".storybook/vite.config.mjs", // Point to a non-existent file to avoid loading the root vite.config.ts
			},
		},
	},
	async viteFinal(config) {
		// Import vite plugins dynamically
		const { default: react } = await import("@vitejs/plugin-react");
		const { default: tailwindcss } = await import("@tailwindcss/vite");

		// Add the plugins to the config
		config.plugins = config.plugins || [];
		config.plugins.push(react());
		config.plugins.push(tailwindcss());

		// Add the same alias as in your vite.config.ts
		config.resolve = config.resolve || {};
		config.resolve.alias = {
			...config.resolve.alias,
			"@": resolve(__dirname, "../src"),
			"@astrify/react-s3-upload": resolve(__dirname, "../src"),
		};

		// Set base path for GitHub Pages deployment
		if (process.env.GITHUB_PAGES) {
			config.base = '/react-s3-upload/';
		}

		return config;
	},
};
export default config;
