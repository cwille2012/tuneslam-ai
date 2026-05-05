#!/usr/bin/env node

/**
 * Build script for AWS Elastic Beanstalk deployment
 * Creates a dist/ folder with production-ready code
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('🏗️  Building backend for AWS Elastic Beanstalk...\n');

/**
 * Copy directory recursively
 */
async function copyDir(src, dest, exclude = []) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded items
    if (exclude.includes(entry.name)) {
      console.log(`   ⏭️  Skipping: ${entry.name}`);
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, exclude);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Copy a single file
 */
async function copyFile(src, dest, newName) {
  const destPath = newName ? path.join(dest, newName) : dest;
  await fs.copyFile(src, destPath);
}

/**
 * Main build function
 */
async function build() {
  try {
    // 1. Clean dist folder
    console.log('🧹 Cleaning dist folder...');
    try {
      await fs.rm(distDir, { recursive: true, force: true });
    } catch (err) {
      // Folder doesn't exist, that's fine
    }
    await fs.mkdir(distDir, { recursive: true });
    console.log('   ✅ Cleaned\n');

    // 2. Copy source code
    console.log('📁 Copying source code...');
    await copyDir(
      path.join(rootDir, 'src'),
      path.join(distDir, 'src'),
      []
    );
    console.log('   ✅ Source copied\n');

    // 3. Copy package.json
    console.log('📦 Copying package.json...');
    await copyFile(
      path.join(rootDir, 'package.json'),
      path.join(distDir, 'package.json')
    );
    console.log('   ✅ package.json copied\n');

    // 4. Copy .env.production as .env
    console.log('🔐 Copying environment file...');
    await copyFile(
      path.join(rootDir, '.env.production'),
      path.join(distDir, '.env')
    );
    console.log('   ✅ .env.production → .env\n');

    // 5. Create .ebextensions folder
    console.log('⚙️  Creating Elastic Beanstalk configuration...');
    await fs.mkdir(path.join(distDir, '.ebextensions'), { recursive: true });
    
    // Copy EB configuration files if they exist
    try {
      await copyDir(
        path.join(rootDir, '.ebextensions'),
        path.join(distDir, '.ebextensions'),
        []
      );
    } catch (err) {
      console.log('   ⚠️  No .ebextensions folder found (will create later)');
    }
    console.log('   ✅ EB config ready\n');

    // 6. Create .platform folder
    console.log('🔧 Creating platform hooks...');
    await fs.mkdir(path.join(distDir, '.platform'), { recursive: true });
    
    try {
      await copyDir(
        path.join(rootDir, '.platform'),
        path.join(distDir, '.platform'),
        []
      );
    } catch (err) {
      console.log('   ⚠️  No .platform folder found (will create later)');
    }
    console.log('   ✅ Platform config ready\n');

    // 7. Copy .gitignore
    console.log('📄 Copying additional files...');
    try {
      await copyFile(
        path.join(rootDir, '.gitignore'),
        path.join(distDir, '.gitignore')
      );
      console.log('   ✅ .gitignore copied');
    } catch (err) {
      console.log('   ⚠️  No .gitignore found');
    }

    // 8. Create Procfile
    const procfile = 'web: npm start';
    await fs.writeFile(path.join(distDir, 'Procfile'), procfile);
    console.log('   ✅ Procfile created\n');

    // 9. Build summary
    console.log('✅ Build complete!\n');
    console.log('📊 Dist folder contents:');
    console.log('   📂 dist/');
    console.log('   ├── src/             (Source code)');
    console.log('   ├── package.json     (Dependencies)');
    console.log('   ├── .env             (Production config)');
    console.log('   ├── .ebextensions/   (EB configuration)');
    console.log('   ├── .platform/       (Platform hooks)');
    console.log('   ├── Procfile         (Start command)');
    console.log('   └── .gitignore\n');

    console.log('📦 Ready to deploy!');
    console.log('   Next steps:');
    console.log('   1. cd dist');
    console.log('   2. zip -r ../backend-deployment.zip .');
    console.log('   3. Upload to AWS Elastic Beanstalk\n');
    console.log('   Or use EB CLI:');
    console.log('   1. eb init');
    console.log('   2. eb create tuneslam-api');
    console.log('   3. eb deploy\n');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
