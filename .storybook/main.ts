import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: ["../stories/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
	addons: [
		"@storybook/addon-links",
		"@storybook/addon-essentials",
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

		return config;
	},
};
export default config;
