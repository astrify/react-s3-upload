import { useFileErrors, useFileUpload } from "@astrify/react-s3-upload";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

export function FileErrors() {
	const errors = useFileErrors();
	const { clearErrors } = useFileUpload();

	// Show errors as toasts
	useEffect(() => {
		if (errors.length > 0) {
			// Show toasts for all errors
			errors.forEach((error) => {
				toast.error(error.message, {
					description:
						typeof error.details === "string" ? error.details : undefined,
					richColors: true,
				});
			});

			// Clear errors immediately after showing toasts
			clearErrors();
		}
	}, [errors, clearErrors]);

	// Replace with null if you're loading the Toaster in a different component
	return <Toaster expand={true} />;
}
