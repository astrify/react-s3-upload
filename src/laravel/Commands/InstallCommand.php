<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class ReactS3UploadInstallCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'react-s3-upload:install
                            {--force : Overwrite existing files}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install React S3 Upload package with dependencies and Laravel integration';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Installing React S3 Upload package...');

        // Step 1: Install required composer dependencies
        if (!$this->installComposerDependencies()) {
            return 1;
        }

        // Step 2: Copy Laravel files from node_modules
        if (!$this->copyLaravelFiles()) {
            return 1;
        }

        // Step 3: Add routes to web.php
        $webRoutesPath = base_path('routes/web.php');
        $routesToAdd = $this->getRoutesToAdd();

        if ($this->shouldAddRoutes($webRoutesPath, $routesToAdd)) {
            $this->addRoutesToWebFile($webRoutesPath, $routesToAdd);
            $this->info('✓ Routes added to routes/web.php');
        } else {
            $this->comment('ℹ Routes already exist in routes/web.php');
        }

        // Step 4: Display setup instructions
        $this->displaySetupInstructions();

        $this->info('🎉 React S3 Upload installation completed successfully!');

        return 0;
    }

    /**
     * Install required composer dependencies.
     */
    private function installComposerDependencies(): bool
    {
        $this->info('📦 Installing composer dependencies...');

        $result = Process::run([
            'composer', 'require', 
            'league/flysystem-aws-s3-v3:^3.0',
            '--with-all-dependencies'
        ], function (string $type, string $output) {
            $this->line($output);
        });

        if ($result->failed()) {
            $this->error('❌ Failed to install composer dependencies');
            $this->error($result->errorOutput());
            return false;
        }

        $this->info('✓ Composer dependencies installed successfully');
        return true;
    }

    /**
     * Copy Laravel files from node_modules to Laravel directories.
     */
    private function copyLaravelFiles(): bool
    {
        $this->info('📁 Copying Laravel files...');

        $nodeModulesPath = base_path('node_modules/@astrify/react-s3-upload/src/laravel');
        
        if (!File::exists($nodeModulesPath)) {
            $this->error('❌ Package files not found in node_modules. Make sure @astrify/react-s3-upload is installed.');
            $this->comment('Run: npm install @astrify/react-s3-upload');
            return false;
        }

        // Copy controllers
        $controllersSource = $nodeModulesPath . '/Controllers';
        $controllersTarget = app_path('Http/Controllers');

        if (File::exists($controllersSource)) {
            $this->copyFiles($controllersSource, $controllersTarget, [
                'PresignController.php',
                'DocumentCreateController.php'
            ]);
        }

        $this->info('✓ Laravel integration files copied successfully');
        $this->comment('ℹ The install command is now available at: app/Console/Commands/ReactS3UploadInstallCommand.php');

        return true;
    }

    /**
     * Copy specific files from source to target directory.
     */
    private function copyFiles(string $sourcePath, string $targetPath, array $files): void
    {
        foreach ($files as $file) {
            $sourceFile = $sourcePath . '/' . $file;
            $targetFile = $targetPath . '/' . $file;

            if (!File::exists($sourceFile)) {
                $this->warn("⚠️  Source file not found: {$file}");
                continue;
            }

            if (File::exists($targetFile) && !$this->option('force')) {
                if (!$this->confirm("File {$file} already exists. Overwrite?")) {
                    $this->comment("Skipped: {$file}");
                    continue;
                }
            }

            // Ensure target directory exists
            File::ensureDirectoryExists($targetPath);

            // Copy the file
            File::copy($sourceFile, $targetFile);
            $this->info("✓ Copied: {$file}");
        }
    }

    /**
     * Get the routes that need to be added.
     */
    private function getRoutesToAdd(): string
    {
        return "
// React S3 Upload Routes
Route::post('/documents', App\\Http\\Controllers\\DocumentCreateController::class)
    ->middleware(['auth'])
    ->name('documents.create');

Route::post('/presign', App\\Http\\Controllers\\PresignController::class)
    ->middleware(['auth'])
    ->name('documents.presign');";
    }

    /**
     * Check if routes should be added to the web.php file.
     */
    private function shouldAddRoutes(string $webRoutesPath, string $routesToAdd): bool
    {
        if (!File::exists($webRoutesPath)) {
            $this->error('routes/web.php file not found!');
            return false;
        }

        $currentContent = File::get($webRoutesPath);

        // Check if routes already exist
        if (str_contains($currentContent, 'DocumentCreateController') && 
            str_contains($currentContent, 'PresignController')) {
            return false;
        }

        return true;
    }

    /**
     * Add routes to the web.php file.
     */
    private function addRoutesToWebFile(string $webRoutesPath, string $routesToAdd): void
    {
        $currentContent = File::get($webRoutesPath);
        $newContent = $currentContent . $routesToAdd;
        
        File::put($webRoutesPath, $newContent);
    }

    /**
     * Display setup instructions to the user.
     */
    private function displaySetupInstructions(): void
    {
        $this->newLine();
        $this->info('📋 Next Steps:');
        $this->line('');
        
        $this->comment('1. Configure your S3 storage in config/filesystems.php');
        $this->line('   Make sure you have an S3 disk configured with proper credentials.');
        $this->line('');
        
        $this->comment('2. Set up CORS for your S3 bucket');
        $this->line('   Allow POST requests from your domain for direct uploads.');
        $this->line('');
        
        $this->comment('3. Customize the controllers if needed');
        $this->line('   The controllers are now available in your app/Http/Controllers directory.');
        $this->line('');
        
        $this->comment('4. Usage in your React components:');
        $this->line('   <UploadInertia');
        $this->line('     signedUrlEndpoint="/upload/signed-url"');
        $this->line('     maxFiles={5}');
        $this->line('     maxSize={10 * 1024 * 1024} // 10MB');
        $this->line('   />');
        $this->line('');
        
        $this->comment('5. Make sure to include authentication middleware');
        $this->line('   The routes are protected with auth middleware by default.');
        $this->line('');
        
        $this->warn('⚠️  Security Note:');
        $this->line('   Always validate file uploads on the server side and implement');
        $this->line('   proper access controls for file storage.');
    }
}