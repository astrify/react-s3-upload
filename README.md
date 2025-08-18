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
npx shadcn@latest add https://your-registry-url/r/file-dropzone.json
npx shadcn@latest add https://your-registry-url/r/file-list.json
npx shadcn@latest add https://your-registry-url/r/file-errors.json

# Or install the complete system
npx shadcn@latest add https://your-registry-url/r/file-upload-complete.json
```

### 2. Compose your upload interface with FileUploadProvider

```tsx
import { FileUploadProvider } from '@astrify/react-s3-upload';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { FileList } from '@/components/ui/file-list';
import { FileErrors } from '@/components/ui/file-errors';

function UploadSection() {
  return (
    <FileUploadProvider 
      config={{
        presignEndpoint: '/api/signed-storage-url',
        maxFiles: 10,
        maxSize: 50 * 1024 * 1024, // 50MB
        accept: 'image/*,application/pdf'
      }}
    >
      <div className="space-y-4">
        <FileDropzone />
        <FileList />
        <FileErrors />
      </div>
    </FileUploadProvider>
  );
}
```

### 3. Use in a form (example)

```tsx
import { useState } from 'react';
import { FileUploadProvider, useFileUpload } from '@astrify/react-s3-upload';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { FileList } from '@/components/ui/file-list';
import { FileErrors } from '@/components/ui/file-errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Main form component with the provider
function UploadForm() {
  return (
    <FileUploadProvider 
      config={{
        presignEndpoint: '/api/signed-storage-url',
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
          <FileErrors />
          <FileDropzone />
          <FileList />
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

## Usage Examples

### Basic File Upload

```tsx
import { FileUploadProvider } from '@astrify/react-s3-upload';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { FileList } from '@/components/ui/file-list';

function BasicUpload() {
  return (
    <FileUploadProvider config={{
      presignEndpoint: '/api/signed-storage-url',
      maxFiles: 5
    }}>
      <FileDropzone />
      <FileList />
    </FileUploadProvider>
  );
}
```

### Image Upload with List View

```tsx
import { FileUploadProvider } from '@astrify/react-s3-upload';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { FileList } from '@/components/ui/file-list';

function ImageUpload() {
  return (
    <FileUploadProvider config={{
      presignEndpoint: '/api/signed-storage-url',
      maxFiles: 12,
      accept: 'image/*'
    }}>
      <FileDropzone />
      <FileList showImagePreviews />
    </FileUploadProvider>
  );
}
```

### With Custom Headers

```tsx
import { FileUploadProvider } from '@astrify/react-s3-upload';

function SecureUpload() {
  return (
    <FileUploadProvider config={{
      presignEndpoint: '/api/signed-storage-url',
      // Static headers
      presignHeaders: {
        'X-API-Key': 'your-api-key'
      },
      // Or dynamic headers (async function)
      presignHeaders: async () => {
        const token = await getAuthToken();
        return {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': generateRequestId()
        };
      }
    }}>
      <FileDropzone />
      <FileList />
    </FileUploadProvider>
  );
}
```

### Using the Hook API

```tsx
import { useFileUpload } from '@astrify/react-s3-upload';

function CustomUploadButton() {
  const { addFiles, files, isUploading } = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleClick = () => {
    inputRef.current?.click();
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };
  
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <button onClick={handleClick} disabled={isUploading}>
        Upload Files ({files.length})
      </button>
    </>
  );
}
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
  presignEndpoint?: string;       // Endpoint for signed URL generation (default: '/signed-storage-url')
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

## Server Integration

### Laravel Example

The package expects a server endpoint that returns presigned URLs for S3 uploads:

```php
// routes/api.php
Route::post('/signed-storage-url', function (Request $request) {
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

app.post('/api/signed-storage-url', async (req, res) => {
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

## shadcn Registry Components

The following components are available through the shadcn registry:

### file-dropzone
Drag-and-drop file selector with visual feedback.

### file-list
List view displaying files with progress bars, status, and actions.

### file-errors
Error message display via toast notifications.

### file-header
Header component showing file count and bulk actions.

### file-upload-complete
Complete file upload system bundling all components together.

## Features in Detail

### Duplicate Detection
Files are hashed using SHA-256 on the client side before upload. The hash is sent to the server for deduplication checking, preventing duplicate uploads and saving bandwidth.

### Concurrent Upload Management
The system automatically manages upload concurrency, limiting to 3 simultaneous uploads by default to prevent overwhelming the server while maintaining good performance.

### Progress Tracking
Each file's upload progress is tracked individually using XMLHttpRequest, providing real-time feedback to users.

### Error Recovery
Failed uploads can be retried with a single click. The system will request a fresh signed URL and attempt the upload again.

### Memory Management
- Blob URLs are automatically cleaned up when files are removed
- Abort controllers cancel in-flight uploads when needed
- Preview URLs are revoked to prevent memory leaks

## Browser Support

This package supports all modern browsers that implement:
- File API
- Crypto.subtle (for SHA-256 hashing)
- XMLHttpRequest Level 2 (for progress events)
- ES2015+ JavaScript features

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

### Available Scripts

#### Development
- `pnpm dev` - Run concurrent development mode (builds, Storybook, and tests)
- `pnpm build` - Build package with tsup for production
- `pnpm build --watch` - Build package in watch mode

#### Testing
- `pnpm test` - Run all tests in watch mode with Vitest
- `pnpm test:ci` - Run tests once with coverage reporting
- `pnpm vitest run` - Run tests once without watch

#### Storybook
- `pnpm storybook` - Start Storybook dev server on port 6006
- `pnpm storybook:build` - Build static Storybook

#### Code Quality
- `pnpm lint` - Format and fix code with Biome
- `pnpm lint:ci` - Check code without fixing (for CI)
- `pnpm commit` - Create formatted commit with commitizen

#### Publishing
- `pnpm release` - Build and create a release with release-it
- `pnpm link:self` - Link package globally for local development

#### Registry
- `pnpm registry:build` - Build the shadcn registry JSON files

### Project Structure

```
src/
├── FileUploadContext.tsx    # Context provider with upload logic
├── components/              # UI components
│   ├── FileDropzone.tsx    # Drag-and-drop file selector
│   ├── FileList.tsx        # List view with progress tracking
│   ├── FileErrors.tsx      # Error display component
│   └── FileHeader.tsx      # Header with file count and actions
├── lib/
│   └── upload.ts           # Upload utilities and S3 integration
├── types/
│   └── file-upload.ts      # TypeScript type definitions
└── index.ts                # Package exports
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