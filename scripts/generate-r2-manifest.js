import { writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File size threshold (25MB - files larger than this go to R2)
const SIZE_THRESHOLD = 25 * 1024 * 1024;

// Recursively find all files in a directory
function findFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main function
function generateManifest() {
  const staticDir = join(__dirname, '..', 'static');
  const videoDir = join(staticDir, 'video');
  const imagesDir = join(staticDir, 'images');

  const directories = [videoDir, imagesDir];
  const largeFiles = [];

  for (const dir of directories) {
    const files = findFiles(dir);

    for (const filePath of files) {
      const stat = statSync(filePath);
      const fileSize = stat.size;

      if (fileSize > SIZE_THRESHOLD) {
        // Get path relative to static directory
        const relativePath = '/' + filePath.split('/static/')[1];
        largeFiles.push(relativePath);
      }
    }
  }

  // Write manifest to src/lib
  const manifestPath = join(__dirname, '..', 'src', 'lib', 'r2-manifest.js');
  const manifestContent = `// Auto-generated list of files stored in R2 (>25MB)
// Generated at build time by scripts/generate-r2-manifest.js

export const R2_FILES = ${JSON.stringify(largeFiles, null, 2)};
`;

  writeFileSync(manifestPath, manifestContent);
  console.log(`✓ Generated R2 manifest with ${largeFiles.length} files`);
  largeFiles.forEach(file => console.log(`  - ${file}`));
}

generateManifest();
