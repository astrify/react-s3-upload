# @astrify/react-s3-upload

A flexible, composable React file upload system built for S3-compatible storage. Features include drag-and-drop, progress tracking, detailed error handling, duplicate detection, and shadcn/ui component integration.

## Features

- 🎯 **S3-Compatible Storage** - Works with AWS S3, DigitalOcean Spaces, Cloudflare R2, MinIO, and more
- 📦 **Batch Upload Processing** - Request signed URLs for multiple files in a single API call
- 🔒 **Duplicate Detection** - SHA-256 hashing for deduplication
- 📊 **Progress Tracking** - Real-time upload progress for each file
- 🎨 **Composable Components** - Mix and match UI components to build custom upload interfaces
- 🚀 **Concurrent Uploads** - Automatic queue management with configurable concurrency
- ♻️ **Error Recovery** - Built-in retry mechanism for failed uploads
- 🎯 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- 🧩 **shadcn/ui Components** - Pre-built components available via shadcn CLI

## Installation

```bash
npm install @astrify/react-s3-upload
# or
pnpm add @astrify/react-s3-upload
# or
yarn add @astrify/react-s3-upload
```

### Peer Dependencies

This package requires React 17 or higher:

```json
{
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  }
}
```

## Quick Start

### 1. Install UI components from shadcn registry

```bash
# Install individual components
npx shadcn@latest add https://astrify.github.io/react-s3-upload/r/dropzone.json
npx shadcn@latest add https://astrify.github.io/react-s3-upload/r/list.json
npx shadcn@latest add https://astrify.github.io/react-s3-upload/r/errors.json
npx shadcn@latest add https://astrify.github.io/react-s3-upload/r/header.json

# Or install the complete system
npx shadcn@latest add https://astrify.github.io/react-s3-upload/r/upload.json
```

### 2. Use the complete Upload component

```tsx
import { Upload } from '@/components/astrify/upload/upload';
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <Upload 
        config={{
          signedUrlEndpoint: '/upload/signed-url',
          maxFiles: 10,
          maxSize: 50 * 1024 * 1024, // 50MB
          accept: 'image/*,application/pdf'
        }}
      />
      <Toaster position="bottom-right" richColors />
    </>
  );
}
```

### 3. Or compose your own interface with individual components

```tsx
import { FileUploadProvider } from '@astrify/react-s3-upload';
import { Dropzone } from '@/components/astrify/upload/dropzone';
import { List } from '@/components/astrify/upload/list';
import { Errors } from '@/components/astrify/upload/errors';

function UploadSection() {
  return (
    <FileUploadProvider 
      config={{
        signedUrlEndpoint: '/upload/signed-url',
        maxFiles: 10,
        maxSize: 50 * 1024 * 1024, // 50MB
        accept: 'image/*,application/pdf'
      }}
    >
      <div className="space-y-4">
        <Dropzone />
        <List />
        <Errors />
      </div>
    </FileUploadProvider>
  );
}
```

### 4. Use in a form (example)

```tsx
import { useState } from 'react';
import { FileUploadProvider, useFileUpload } from '@astrify/react-s3-upload';
import { Dropzone } from '@/components/astrify/upload/dropzone';
import { List } from '@/components/astrify/upload/list';
import { Errors } from '@/components/astrify/upload/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Main form component with the provider
function UploadForm() {
  return (
    <FileUploadProvider 
      config={{
        signedUrlEndpoint: '/upload/signed-url',
        maxFiles: 5,
        maxSize: 10 * 1024 * 1024, // 10MB
        accept: 'image/*,application/pdf'
      }}
    >
      <FormContent />
    </FileUploadProvider>
  );
}

function FormContent() {
  const { files, hasComplete, hasPending, hasUploading, hasErrors } = useFileUpload();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract only completed files for submission
    const completedFiles = files.filter(f => f.status === 'complete');
    
    // Get form data
    const formData = new FormData(e.target as HTMLFormElement);
    
    // Submit with completed file data
    const submission = {
      name: formData.get('name'),
      files: completedFiles.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        sha256: f.sha256
      }))
    };
    
    console.log('Form submitted:', submission);
    // Send to your API here
  };

  // Enable submit only when all uploads are complete
  const canSubmit = hasComplete && !hasPending && !hasUploading && !hasErrors;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          type="text"
          id="name"
          name="name"
          placeholder="Enter your name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Attachments</Label>
        <div className="space-y-4">
          <Errors />
          <Dropzone />
          <List />
        </div>
      </div>

      <Button 
        type="submit"
        disabled={!canSubmit}
        className="w-full sm:w-auto"
      >
        Submit with {files.filter(f => f.status === 'complete').length} files
      </Button>
    </form>
  );
}
```

## Server Integration

### Request & Response Payloads

The uploader issues a `POST` to your presign endpoint (default `/upload/signed-url`) with JSON shaped like:

```json
{
  "files": [
    {
      "filename": "invoice.pdf",
      "filesize": 58211,
      "contentType": "application/pdf",
      "sha256": "3f0d2f8c8d0d2b36f9b8c5c2f5deda4d3b1c7a6d1e9f5e8c6a7b8c9d0e1f2a3"
    }
  ]
}
```

Reply with a `200` JSON body describing each generated upload target. At minimum, return the matching `sha256` plus the presigned URL details:

```json
{
  "files": [
    {
      "sha256": "3f0d2f8c8d0d2b36f9b8c5c2f5deda4d3b1c7a6d1e9f5e8c6a7b8c9d0e1f2a3",
      "bucket": "my-uploads",
      "key": "uploads/9d1fcdcb-0f1f-4c82-bfd5-e8a4c5d9e123.pdf",
      "url": "https://my-uploads.s3.amazonaws.com/uploads/9d1fcdc...",
      "filename": "invoice.pdf"
    }
  ]
}
```

For validation failures return `422 Unprocessable Entity` with an `errors` object (for example `{"errors": {"files.0.filesize": ["File too large"]}}`); the uploader surfaces those messages to the user.

### Laravel Example

The package expects a server endpoint that returns presigned URLs for S3 uploads:

```php
// routes/api.php
Route::post('/upload/signed-url', function (Request $request) {
    $validated = $request->validate([
        'files' => 'required|array',
        'files.*.filename' => 'required|string',
        'files.*.content_type' => 'required|string',
        'files.*.filesize' => 'required|integer',
        'files.*.sha256' => 'required|string',
    ]);
    
    $responses = [];
    
    foreach ($validated['files'] as $file) {
        // Check for duplicates
        if (File::where('sha256', $file['sha256'])->exists()) {
            return response()->json([
                'error' => 'Duplicate file detected'
            ], 422);
        }
        
        // Generate presigned URL
        $key = 'uploads/' . Str::uuid() . '.' . $file['extension'];
        $url = Storage::disk('s3')->temporaryUploadUrl(
            $key,
            now()->addMinutes(30),
            ['ContentType' => $file['content_type']]
        );
        
        $responses[] = [
            'sha256' => $file['sha256'],
            'bucket' => config('filesystems.disks.s3.bucket'),
            'key' => $key,
            'url' => $url,
            'filename' => $file['filename']
        ];
    }
    
    return response()->json(['files' => $responses]);
});
```

### Node.js/Express Example

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

app.post('/upload/signed-url', async (req, res) => {
  const { files } = req.body;
  
  const responses = await Promise.all(files.map(async (file) => {
    const key = `uploads/${uuid()}.${file.extension}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: file.content_type,
    });
    
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 1800, // 30 minutes
    });
    
    return {
      sha256: file.sha256,
      bucket: process.env.S3_BUCKET,
      key,
      url,
      filename: file.filename
    };
  }));
  
  res.json({ files: responses });
});
```


## API Reference

### FileUploadProvider

The main context provider that manages upload state and logic.

```tsx
interface FileUploadConfig {
  maxFiles?: number;              // Maximum number of files (default: 10)
  maxSize?: number;               // Maximum file size in bytes (default: 50MB)
  accept?: string;                // Accepted file types (default: '*')
  multiple?: boolean;             // Allow multiple file selection (default: true)
  signedUrlEndpoint?: string;       // Endpoint for signed URL generation (default: '/upload/signed-url')
  presignHeaders?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>); // Optional headers for presign requests
  onUploadComplete?: (files: FileUpload[]) => void;
  onUploadError?: (errors: Array<{ file: File; error: any }>) => void;
  onFilesChange?: (files: File[]) => void;
}
```

### useFileUpload Hook

Access the upload context and all functionality.

```tsx
const {
  // State
  files,           // Current file collection
  errors,          // Error messages
  isUploading,     // Upload in progress
  remainingSlots,  // Available upload slots
  
  // Actions
  addFiles,        // Add files to upload
  removeFile,      // Remove a specific file
  removeAll,       // Clear all files
  retryUpload,     // Retry failed upload
  reset,           // Reset to initial state
  
  // Utilities
  canAcceptMore,   // Can accept more files
  acceptedFileTypes,
  maxFileSize
} = useFileUpload();
```

### Types

```tsx
interface FileUpload {
  id: string;              // SHA-256 hash
  name: string;            // File name
  size: number;            // File size in bytes
  type: string;            // MIME type
  sha256: string;          // SHA-256 hash
  url: string;             // Presigned upload URL
  status: UploadStatus;    // Upload status
  progress: number;        // Upload progress (0-100)
  error?: string;          // Error message if failed
  preview?: string;        // Preview URL for images
}

type UploadStatus = 'pending' | 'uploading' | 'complete' | 'error';
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](#contributing-guide) below for details on development setup and guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/astrify/react-s3-upload.git
cd react-s3-upload

# Install dependencies
pnpm install

# Start development mode
pnpm dev
```

### Development Tools

- **tsup** - TypeScript bundler for ESM and CJS outputs
- **Vite** - Powers Storybook development
- **Vitest** - Testing framework
- **Biome** - Code formatting and linting
- **Lefthook** - Git hooks for code quality
- **Commitizen** - Standardized commit messages

### Testing

Run tests with:

```bash
pnpm test
```

Tests are located in the `tests/` directory and use Vitest with React Testing Library.

### Building

Build the package with:

```bash
pnpm build
```

This creates ESM and CJS bundles in the `dist/` directory.

### 🖇️ Linking

Often times you want to link this package to another project when developing locally, circumventing the need to publish to NPM to consume it. In a project where you want to consume your package run:

```bash
pnpm link @astrify/react-s3-upload --global
```

Learn more about package linking [here](https://pnpm.io/cli/link).

### Releasing

To create a new release:

```bash
pnpm release
```

This will:
1. Build the package
2. Create a git tag
3. Generate a GitHub release
4. Publish to npm (if configured)

### Contributing Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Run linting (`pnpm lint`)
6. Commit your changes (`pnpm commit`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

[MIT](LICENSE) © [Your Name]

## Support

- [GitHub Issues](https://github.com/astrify/react-s3-upload/issues)

## Acknowledgments

Built with:
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
