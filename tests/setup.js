import "dotenv/config";
// biome-ignore lint/style/noNamespaceImport: Required for jest-dom matchers
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(matchers);

afterEach(() => {
	cleanup();
});
