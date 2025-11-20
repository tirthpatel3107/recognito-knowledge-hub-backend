#!/usr/bin/env node

/**
 * Post-build script to transform compiled JavaScript files.
 * Currently handles adding .js extensions to relative imports for Node.js ESM compatibility.
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = join(__dirname, '..', 'dist');

/**
 * Recursively get all .js files in a directory
 */
async function collectJsFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a path exists as a directory in the dist folder
 */
async function isDirectoryInDist(relativePath, currentFileDir) {
  try {
    const fullPath = resolve(currentFileDir, relativePath);
    const stats = await stat(fullPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Transform import statements to add .js extensions to relative paths
 */
async function transformImports(content, currentFileDir) {
  // Match relative paths in import/export statements
  // Pattern: (from|import|export) ... "relative/path" or 'relative/path'
  // Matches: from '../path', import './path', export * from '../path', etc.
  const importRegex = /((?:from|import|export(?:\s+\*|\s+\{[^}]*\})?)\s+['"])(\.\.?\/[^'"]+)(['"])/g;
  
  const replacements = [];
  let match;
  
  // Collect all matches first
  while ((match = importRegex.exec(content)) !== null) {
    replacements.push({
      fullMatch: match[0],
      prefix: match[1],
      path: match[2],
      suffix: match[3],
      index: match.index
    });
  }
  
  // Process replacements in reverse order to maintain indices
  let result = content;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { fullMatch, prefix, path, suffix, index } = replacements[i];
    
    // Skip if already has an extension
    if (path.match(/\.(js|json|ts|tsx|jsx|mjs|cjs)$/)) {
      continue;
    }
    
    // Skip if it's a node_modules import
    if (path.includes('node_modules')) {
      continue;
    }
    
    // Check if path is a directory
    const isDirectory = await isDirectoryInDist(path, currentFileDir);
    
    // Add appropriate extension
    const newPath = isDirectory ? `${path}/index.js` : `${path}.js`;
    const replacement = `${prefix}${newPath}${suffix}`;
    
    result = result.substring(0, index) + replacement + result.substring(index + fullMatch.length);
  }
  
  return result;
}

/**
 * Process all JavaScript files in the dist directory
 */
async function processBuildOutput() {
  try {
    const jsFiles = await collectJsFiles(DIST_DIR);
    
    console.log(`Found ${jsFiles.length} JavaScript files to process...`);
    
    let modifiedCount = 0;
    
    for (const filePath of jsFiles) {
      const content = await readFile(filePath, 'utf-8');
      const currentFileDir = dirname(filePath);
      const transformedContent = await transformImports(content, currentFileDir);
      
      if (content !== transformedContent) {
        await writeFile(filePath, transformedContent, 'utf-8');
        modifiedCount++;
        console.log(`Updated: ${filePath.replace(DIST_DIR, 'dist')}`);
      }
    }
    
    console.log(`\n✓ Processed ${jsFiles.length} files, modified ${modifiedCount} files.`);
  } catch (error) {
    console.error('Error processing build output:', error);
    process.exit(1);
  }
}

processBuildOutput();

