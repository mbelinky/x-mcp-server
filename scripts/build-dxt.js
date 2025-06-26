#!/usr/bin/env node

import { createWriteStream } from 'fs';
import { mkdir, rm, cp, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function buildDxt() {
  console.log('🔨 Building DXT package...');
  
  const tempDir = join(projectRoot, '.dxt-build');
  const outputPath = join(projectRoot, 'x-twitter-mcp.dxt');
  
  try {
    // Clean up any existing temp directory
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });
    
    // Build the TypeScript project
    console.log('📦 Building TypeScript...');
    await execAsync('npm run build', { cwd: projectRoot });
    
    // Copy necessary files
    console.log('📋 Copying files...');
    await cp(join(projectRoot, 'manifest.json'), join(tempDir, 'manifest.json'));
    await cp(join(projectRoot, 'build'), join(tempDir, 'build'), { recursive: true });
    await cp(join(projectRoot, 'package.json'), join(tempDir, 'package.json'));
    await cp(join(projectRoot, 'README.md'), join(tempDir, 'README.md'));
    await cp(join(projectRoot, 'LICENSE'), join(tempDir, 'LICENSE'));
    
    // Copy node_modules (excluding dev dependencies)
    console.log('📚 Installing production dependencies...');
    await execAsync('npm ci --production', { cwd: tempDir });
    
    // Create the zip archive
    console.log('🗜️ Creating DXT archive...');
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`✅ DXT package created: ${outputPath}`);
      console.log(`📊 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    archive.directory(tempDir, false);
    await archive.finalize();
    
    // Clean up
    await rm(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('❌ Error building DXT:', error);
    process.exit(1);
  }
}

// Check if archiver is installed
try {
  await import('archiver');
} catch {
  console.log('📦 Installing archiver...');
  await execAsync('npm install --save-dev archiver');
}

buildDxt();