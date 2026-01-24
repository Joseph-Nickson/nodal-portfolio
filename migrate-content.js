#!/usr/bin/env node
/**
 * Migration script to convert legacy work format to new content format
 *
 * Legacy format:
 *   type: "image" | "video"
 *   images: ["image.jpg"] or [{src: "image.jpg", caption: "..."}]
 *   videoId: "youtube-id"
 *   info: "description text"
 *
 * New format:
 *   content: [
 *     { type: "image", src: "image.jpg", caption: "..." },
 *     { type: "video", videoId: "youtube-id" },
 *     { type: "text", text: "description" }
 *   ]
 *
 * Run: node migrate-content.js
 * Add --dry-run to preview changes without writing
 */

const fs = require('fs');
const path = require('path');
const { getImageSrc, getImageCaption } = require("./shared/utils");

const worksDir = path.join(__dirname, 'works');
const dryRun = process.argv.includes('--dry-run');

function convertToNewFormat(meta) {
  // Skip if already in new format
  if (meta.content && Array.isArray(meta.content)) {
    console.log('  Already in new format, skipping');
    return null;
  }

  const content = [];

  // Add video first if it's a video type
  if (meta.type === 'video' && meta.videoId) {
    content.push({ type: 'video', videoId: meta.videoId });
  }

  // Add images
  if (meta.images && Array.isArray(meta.images)) {
    for (const img of meta.images) {
      const src = getImageSrc(img);
      const caption = getImageCaption(img);
      const item = { type: 'image', src: src };
      if (caption) item.caption = caption;
      content.push(item);
    }
  }

  // Add info as text block
  if (meta.info && meta.info.trim()) {
    content.push({ type: 'text', text: meta.info.trim() });
  }

  // Build new meta object (remove legacy fields)
  const newMeta = {
    title: meta.title || '',
    client: meta.client || '',
    industry: meta.industry || '',
    contribution: meta.contribution || '',
    date: meta.date || '',
    style: meta.style || '',
    software: meta.software || '',
    featured: meta.featured || false,
    content: content
  };

  return newMeta;
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const entryPath = path.join(dir, entry.name);
    const metaPath = path.join(entryPath, 'meta.json');

    if (fs.existsSync(metaPath)) {
      // This is a project folder
      console.log(`Processing: ${entryPath}`);

      try {
        const metaContent = fs.readFileSync(metaPath, 'utf8');
        const meta = JSON.parse(metaContent);

        const newMeta = convertToNewFormat(meta);

        if (newMeta) {
          console.log(`  Content items: ${newMeta.content.length}`);

          if (!dryRun) {
            fs.writeFileSync(metaPath, JSON.stringify(newMeta, null, 2));
            console.log('  Updated meta.json');
          } else {
            console.log('  Would update meta.json (dry run)');
          }
          count++;
        }
      } catch (err) {
        console.error(`  Error: ${err.message}`);
      }
    } else {
      // Recurse into subdirectory (year folders)
      count += processDirectory(entryPath);
    }
  }

  return count;
}

console.log('Migration: Converting legacy format to new content format');
console.log(`Works directory: ${worksDir}`);
if (dryRun) console.log('DRY RUN - no files will be modified\n');
else console.log('');

const count = processDirectory(worksDir);

console.log(`\nMigration complete. ${count} files ${dryRun ? 'would be ' : ''}updated.`);
if (dryRun) console.log('Run without --dry-run to apply changes.');
