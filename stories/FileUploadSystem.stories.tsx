import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@storybook/test";
import { Toaster } from "sonner";
import { Dropzone } from "@/components/astrify/upload/dropzone";
import { Errors } from "@/components/astrify/upload/errors";
import { Header } from "@/components/astrify/upload/header";
import { List } from "@/components/astrify/upload/list";
import { FileUploadProvider } from "@/FileUploadContext";
import {
	createUploadFailureFake,
	createUploadSuccessFake,
	createUploadValidationErrorFake,
} from "@/lib/upload-fakes";
import type { UploadLib } from "@/types/file-upload";

// Component that composes all file upload components
function FileUploadSystem({
	uploadLib = createUploadSuccessFake(),
}: {
	uploadLib?: UploadLib;
}) {
	return (
		<>
			<FileUploadProvider
				config={{
					maxFiles: 10,
					maxSize: 50 * 1024 * 1024, // 50MB
					signedUrlEndpoint: "/upload/signed-url",
					uploadLib,
				}}
			>
				<div className="space-y-4">
					<Dropzone />
					<Errors />
					<Header />
					<List />
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

// Shows various file types being uploaded
export const MultipleFileTypes: Story = {
	args: {
		uploadLib: createUploadSuccessFake(),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Create various file types
		const mockFiles = [
			createMockFile("document.pdf", 1024 * 1024, "application/pdf"),
			createMockFile("photo.jpg", 2 * 1024 * 1024, "image/jpeg"),
			createMockFile(
				"spreadsheet.xlsx",
				512 * 1024,
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			),
			createMockFile("video.mp4", 5 * 1024 * 1024, "video/mp4"),
			createMockFile("archive.zip", 3 * 1024 * 1024, "application/zip"),
		];

		const dropzone = canvas.getByText(/Drop files here/i).closest("div");
		if (!dropzone) throw new Error("Dropzone not found");

		const dataTransfer = new DataTransfer();
		for (const file of mockFiles) {
			dataTransfer.items.add(file);
		}

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
	args: {
		uploadLib: createUploadFailureFake(/retry-me/),
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
	args: {
		uploadLib: createUploadValidationErrorFake(),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await new Promise((resolve) => setTimeout(resolve, 100));

		const mockFile = createMockFile(
			"too-large.zip",
			15 * 1024 * 1024,
			"application/zip",
		);

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
