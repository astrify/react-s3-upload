<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DocumentCreateController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        // Validate the incoming request
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'uploadedFiles' => 'required|array|min:1',
            'uploadedFiles.*.id' => 'required|string',
            'uploadedFiles.*.name' => 'required|string',
            'uploadedFiles.*.sha256' => 'required|string',
            'uploadedFiles.*.size' => 'required|integer|min:0',
            'uploadedFiles.*.type' => 'required|string',
        ]);

        Log::info('Document creation request received', [
            'name' => $validated['name'],
            'uploaded_files' => $validated['uploadedFiles'],
        ]);

        // Process the uploaded files
        //        DB::transaction(function () use ($validated, $request) {
        //            // Create documents for each uploaded file
        //            foreach ($validated['uploadedFiles'] as $file) {
        //                Document::create([
        //                    'user_id' => $request->user()->id,
        //                    'name' => $file['name'],
        //                    'file_name' => $file['name'],
        //                    'file_url' => $file['url'],
        //                    'file_sha256' => $file['sha256'],
        //                    'file_size' => $file['size'],
        //                    'mime_type' => $file['type'],
        //                ]);
        //            }
        //        });

        return back()->with('success', 'Files uploaded successfully');
    }
}
