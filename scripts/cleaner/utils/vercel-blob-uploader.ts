import { put, del, list } from '@vercel/blob';
import * as fs from 'fs';

/**
 * Delete a file from Vercel Blob Storage
 * 
 * Requires BLOB_READ_WRITE_TOKEN environment variable to be set.
 * 
 * @param blobPath - Path/name of the file in blob storage to delete
 */
export async function deleteFromVercelBlob(blobPath: string): Promise<void> {
  try {
    await del(blobPath);
    console.log(`🗑️  Deleted from Vercel Blob: ${blobPath}`);
  } catch (error: any) {
    // If file doesn't exist, that's okay - we're cleaning up
    if (error?.status === 404 || error?.message?.includes('not found')) {
      console.log(`ℹ️  File not found in blob (already deleted or never existed): ${blobPath}`);
      return;
    }
    console.error(`⚠️  Failed to delete ${blobPath} from Vercel Blob:`, error);
    throw error;
  }
}

/**
 * Delete multiple files from Vercel Blob Storage
 * @param blobPaths - Array of blob paths to delete
 */
export async function deleteMultipleFromVercelBlob(blobPaths: string[]): Promise<void> {
  const deletePromises = blobPaths.map(blobPath => deleteFromVercelBlob(blobPath));
  await Promise.all(deletePromises);
}

/**
 * List all files in Vercel Blob Storage matching a prefix pattern
 * @param prefix - Prefix pattern to match (e.g., 'cleaned-')
 * @returns Array of blob paths
 */
export async function listBlobsByPrefix(prefix: string): Promise<string[]> {
  try {
    const { blobs } = await list({ prefix });
    return blobs.map(blob => blob.pathname);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Don't log errors for missing tokens - this is expected when running locally
    if (!errorMessage.includes('No token found')) {
      console.error(`⚠️  Failed to list blobs with prefix ${prefix}:`, error);
    }
    throw error;
  }
}

/**
 * Upload a file to Vercel Blob Storage
 * 
 * Requires BLOB_READ_WRITE_TOKEN environment variable to be set.
 * The @vercel/blob package automatically reads this from process.env.
 * 
 * @param filePath - Local file path to upload
 * @param blobPath - Path/name for the file in blob storage (e.g., 'cleaned-songs.json')
 * @returns The URL of the uploaded file
 */
export async function uploadToVercelBlob(
  filePath: string,
  blobPath: string
): Promise<string> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath);
    
    // Upload to Vercel Blob Storage (this will replace if file already exists)
    const blob = await put(blobPath, fileContent, {
      access: 'public', // Make files publicly accessible
      addRandomSuffix: false, // Keep the exact filename
      allowOverwrite: true, // Allow overwriting existing files
    });

    console.log(`✅ Uploaded to Vercel Blob: ${blob.url}`);
    return blob.url;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Don't log errors for missing tokens - this is expected when running locally
    if (!errorMessage.includes('No token found')) {
      console.error(`❌ Failed to upload ${filePath} to Vercel Blob:`, error);
    }
    throw error;
  }
}

/**
 * Upload multiple files to Vercel Blob Storage
 * @param files - Array of { filePath, blobPath } objects
 * @returns Array of uploaded blob URLs
 */
export async function uploadMultipleToVercelBlob(
  files: Array<{ filePath: string; blobPath: string }>
): Promise<string[]> {
  const uploadPromises = files.map(({ filePath, blobPath }) =>
    uploadToVercelBlob(filePath, blobPath)
  );

  return Promise.all(uploadPromises);
}

/**
 * Clean up old cleaned data files from blob storage
 * Deletes all files with 'cleaned-' prefix
 * Note: detailed-stats.json is handled separately in saveDetailedStats()
 * The fixed filenames will be re-uploaded immediately after cleanup
 */
export async function cleanupOldBlobFiles(): Promise<void> {
  try {
    console.log('🧹 Cleaning up old files from Vercel Blob Storage...');
    
    // List all files that start with 'cleaned-' (our pattern)
    // Note: detailed-stats.json is NOT included here - it's handled separately
    const cleanedBlobs = await listBlobsByPrefix('cleaned-');
    
    if (cleanedBlobs.length > 0) {
      console.log(`Found ${cleanedBlobs.length} file(s) to delete:`);
      cleanedBlobs.forEach(file => console.log(`  - ${file}`));
      await deleteMultipleFromVercelBlob(cleanedBlobs);
      console.log('✅ Cleanup complete');
    } else {
      console.log('✅ No old files to clean up');
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // Don't log errors for missing tokens - this is expected when running locally
    // Don't throw - cleanup failure shouldn't stop the upload
    if (!errorMessage.includes('No token found')) {
      console.error('⚠️  Failed to cleanup old blob files:', error);
    }
  }
}

