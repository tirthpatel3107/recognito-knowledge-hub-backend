#!/usr/bin/env node

/**
 * Post-build script to transform compiled JavaScript files.
 * Currently handles adding .js extensions to relative imports for Node.js ESM compatibility.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
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
 * Transform import statements to add .js extensions to relative paths
 */
function transformImports(content) {
  // Match relative paths in import/export statements
  // Pattern: (from|import|export) ... "relative/path" or 'relative/path'
  // Matches: from '../path', import './path', export * from '../path', etc.
  const importRegex = /((?:from|import|export(?:\s+\*|\s+\{[^}]*\})?)\s+['"])(\.\.?\/[^'"]+)(['"])/g;
  
  return content.replace(importRegex, (match, prefix, path, suffix) => {
    // Skip if already has an extension
    if (path.match(/\.(js|json|ts|tsx|jsx|mjs|cjs)$/)) {
      return match;
    }
    
    // Skip if it's a node_modules import
    if (path.includes('node_modules')) {
      return match;
    }
    
    // Add .js extension
    return `${prefix}${path}.js${suffix}`;
  });
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
      const transformedContent = transformImports(content);
      
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

