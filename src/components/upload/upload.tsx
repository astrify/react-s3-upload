import type { FileUploadConfig } from "@astrify/react-s3-upload";
import { FileUploadProvider } from "@astrify/react-s3-upload";
import { Dropzone } from "@/components/upload/dropzone";
import { Errors } from "@/components/upload/errors";
import { List } from "@/components/upload/list";

interface UploadProps {
	config?: Partial<FileUploadConfig>;
	className?: string;
}

export function Upload({
	config = {
		signedUrlEndpoint: "/upload/signed-url",
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
