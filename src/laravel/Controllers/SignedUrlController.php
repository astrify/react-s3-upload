<?php

namespace App\Http\Controllers;

use Aws\S3\S3Client;
use Aws\Signature\S3SignatureV4;
use Aws\Signature\SignatureProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SignedUrlController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request): JsonResponse
    {
        // Authorize the upload
        //Gate::authorize('uploadFiles', $request->user());

        // Validate the array of files
        $validated = $request->validate([
            'files' => 'required|array|min:1',
            'files.*.contentType' => 'required|string',
            'files.*.filename' => 'required|string',
            'files.*.filesize' => 'required|integer|max:10485760', // 1 MB max
            'files.*.sha256' => 'required|string|regex:/^[a-f0-9]{64}$/i',
        ]);

        // Initialize S3 client once for all files
        $signatureProvider = SignatureProvider::memoize(static function ($version, $service, $region) {
            if (($version === 's3v4' || $version === 'v4') && $service === 's3') {
                return new MyCustomS3Signature($service, $region);
            }

            return SignatureProvider::version()($version, $service, $region);
        });

        $config = [
            'region' => config('filesystems.disks.s3.region'),
            'version' => 'latest',
            'credentials' => [
                'key' => config('filesystems.disks.s3.key'),
                'secret' => config('filesystems.disks.s3.secret'),
            ],
            'signature_provider' => $signatureProvider,
        ];

        if (config('filesystems.disks.s3.endpoint')) {
            $config['endpoint'] = config('filesystems.disks.s3.endpoint');
            $config['use_path_style_endpoint'] = config('filesystems.disks.s3.use_path_style_endpoint', false);
        }

        if (config('filesystems.disks.s3.url')) {
            $config['url'] = config('filesystems.disks.s3.url');
        }

        $client = new S3Client($config);

        // Process each file and generate signed URLs
        $signedUrls = [];

        foreach ($validated['files'] as $fileData) {
            // Use the hash as the key (no folder structure, no extension)
            $key = 'uploads/'.strtolower($fileData['sha256']);

            // Check if file with this hash already exists
            //        if (Storage::disk('s3')->exists($key)) {
            //            throw ValidationException::withMessages([
            //                'sha256' => ['A file with this content already exists.'],
            //            ]);
            //        }

            // Create the presigned request with checksum header
            $checksum = base64_encode(hex2bin($fileData['sha256']));

            $command = $client->getCommand('PutObject', [
                'Bucket' => config('filesystems.disks.s3.bucket'),
                'Key' => $key,
                'ContentType' => $fileData['contentType'],
                'ChecksumSHA256' => $checksum,
                'ContentLength' => $fileData['filesize'],
            ]);

            $presignedRequest = $client->createPresignedRequest($command, '+5 minutes');
            $uri = $presignedRequest->getUri();

            $signedUrls[] = [
                'sha256' => $fileData['sha256'], // SHA-256 hash as identifier
                'bucket' => config('filesystems.disks.s3.bucket'),
                'key' => $key,
                'url' => (string) $uri,
                'filename' => $fileData['filename'], // Include filename for client reference
            ];
        }

        return response()->json(['files' => $signedUrls]);
    }
}

// https://github.com/aws/aws-sdk-php/issues/3108
class MyCustomS3Signature extends S3SignatureV4
{
    protected function getHeaderBlacklist(): array
    {
        $deniedList = parent::getHeaderBlacklist();
        unset($deniedList['content-length']);

        return $deniedList;
    }
}
