// Context and hooks
export {
	FileUploadProvider,
	useFileUpload,
	useFileErrors,
	type FileUploadProviderProps,
} from "./FileUploadContext";

// Upload utilities
export {
	uploadFile,
	requestBatchSignedUrls,
	uploadToS3Storage,
	calculateSHA256,
	formatBytes,
} from "./lib/upload";

// Types
export type {
	FileUpload,
	FileUploadConfig,
	UseFileUploadResult,
	FileType,
	UploadStatus,
	UploadError,
	SignedUrlResponse,
	SignedUrlRequest,
} from "./types/file-upload";

// Component exports (undocumented - for development use)
// Note: Production users should install via shadcn CLI for better integration
export { Dropzone } from "./components/upload/dropzone";
export { Errors } from "./components/upload/errors";
export { Header } from "./components/upload/header";
export { List } from "./components/upload/list";
