import { Dropzone } from "@/components/upload/dropzone";
import { Errors } from "@/components/upload/errors";
import { List } from "@/components/upload/list";
import { FileUploadProvider } from "@astrify/react-s3-upload";
import type { FileUploadConfig } from "@astrify/react-s3-upload";

interface UploadProps {
	config?: Partial<FileUploadConfig>;
	className?: string;
}

export function Upload({
	config = {
		presignEndpoint: "/api/signed-storage-url",
		maxFiles: 10,
		maxSize: 10 * 1024 * 1024, // 10MB
		accept: {
			"application/pdf": [".pdf"],
			"image/*": [".png", ".jpeg", ".jpg"],
		},
	},
	className,
}: UploadProps) {
	return (
		<FileUploadProvider config={config}>
			<div className={`space-y-4 ${className || ""}`}>
				<Dropzone />
				<List />
				<Errors />
			</div>
		</FileUploadProvider>
	);
}
