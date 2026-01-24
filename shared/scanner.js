/**
 * Shared works scanning functionality
 * Used by: build-data.js, admin/server.js
 */

const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const {
  extractYouTubeId,
  getYouTubeThumbnail,
  getImageSrc,
  getImageCaption,
} = require("./utils");

/**
 * Get images from a project directory
 * @param {string} projectPath - Path to project folder
 * @param {Array} metaImages - Array of image entries from meta.json (strings or objects)
 * @param {string} parentFolder - Parent folder name (year or client)
 * @param {string} folderName - Project folder name
 * @returns {Array} Array of image entries with full paths
 */
function getImagesFromProject(projectPath, metaImages, parentFolder, folderName) {
  const images = [];

  if (!metaImages || !Array.isArray(metaImages)) {
    return images;
  }

  for (const img of metaImages) {
    const imgSrc = getImageSrc(img);
    const imgPath = path.join(projectPath, imgSrc);
    if (fs.existsSync(imgPath)) {
      const fullPath = `works/${parentFolder}/${folderName}/${imgSrc}`;
      const caption = getImageCaption(img);
      if (caption) {
        images.push({ src: fullPath, caption });
      } else {
        images.push(fullPath);
      }
    }
  }

  return images;
}

/**
 * Scan projects in a directory (year folder or client folder)
 * @param {string} parentPath - Path to parent directory
 * @param {string} parentName - Name of parent directory
 * @param {boolean} isYearFolder - Whether parent is a year folder
 * @returns {Object[]} Array of project info objects
 */
function scanProjectsInDirectory(parentPath, parentName, isYearFolder) {
  const projects = [];

  try {
    const folders = fs.readdirSync(parentPath, { withFileTypes: true });

    for (const folder of folders) {
      if (!folder.isDirectory() || folder.name.startsWith(".")) continue;

      const projectPath = path.join(parentPath, folder.name);
      const metaPath = path.join(projectPath, "meta.json");

      if (fs.existsSync(metaPath)) {
        projects.push({
          path: projectPath,
          metaPath: metaPath,
          structure: isYearFolder ? "new" : "old",
          folderName: folder.name,
          parentFolder: parentName,
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${parentPath}:`, err.message);
  }

  return projects;
}

/**
 * Get all projects from works directory (sync version for build script)
 * @param {string} worksDir - Path to works directory
 * @returns {Object[]} Array of project info objects
 */
function getAllProjects(worksDir) {
  const projects = [];

  if (!fs.existsSync(worksDir)) {
    console.error(`Works directory not found: ${worksDir}`);
    return projects;
  }

  try {
    const entries = fs.readdirSync(worksDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const entryPath = path.join(worksDir, entry.name);
      const isYearFolder = /^\d{4}$/.test(entry.name);

      const entryProjects = scanProjectsInDirectory(
        entryPath,
        entry.name,
        isYearFolder
      );
      projects.push(...entryProjects);
    }
  } catch (err) {
    console.error("Error reading works directory:", err.message);
  }

  return projects;
}

/**
 * Convert legacy meta format to new content format
 * @param {Object} meta - Meta object from meta.json
 * @param {string} projectPath - Path to project folder
 * @param {string} parentFolder - Parent folder name
 * @param {string} folderName - Project folder name
 * @returns {Array} Content array in new format
 */
function convertLegacyToContent(meta, projectPath, parentFolder, folderName) {
  const content = [];

  // Add video first if it's a video type
  if (meta.type === "video" && meta.videoId) {
    const videoId = extractYouTubeId(meta.videoId);
    if (videoId) {
      content.push({ type: "video", videoId: videoId });
    }
  }

  // Add images
  if (meta.images && Array.isArray(meta.images)) {
    for (const img of meta.images) {
      const imgSrc = getImageSrc(img);
      const imgPath = path.join(projectPath, imgSrc);
      if (fs.existsSync(imgPath)) {
        const fullPath = `works/${parentFolder}/${folderName}/${imgSrc}`;
        const caption = getImageCaption(img);
        const imageItem = { type: "image", src: fullPath };
        if (caption) imageItem.caption = caption;
        content.push(imageItem);
      }
    }
  }

  // Add info as text block
  if (meta.info && meta.info.trim()) {
    content.push({ type: "text", text: meta.info.trim() });
  }

  return content;
}

/**
 * Build content array with full paths
 * @param {Array} content - Content array from meta.json
 * @param {string} projectPath - Path to project folder
 * @param {string} parentFolder - Parent folder name
 * @param {string} folderName - Project folder name
 * @returns {Array} Content array with full paths
 */
function buildContentPaths(content, projectPath, parentFolder, folderName) {
  return content.map(item => {
    if (item.type === "image") {
      const imgPath = path.join(projectPath, item.src);
      if (fs.existsSync(imgPath)) {
        const fullPath = `works/${parentFolder}/${folderName}/${item.src}`;
        const newItem = { type: "image", src: fullPath };
        if (item.caption) newItem.caption = item.caption;
        return newItem;
      }
      return null;
    }
    return item;
  }).filter(Boolean);
}

/**
 * Build content array from meta.json (new format or legacy conversion)
 * @param {Object} meta - Meta object from meta.json
 * @param {string} projectPath - Path to project folder
 * @param {string} parentFolder - Parent folder name
 * @param {string} folderName - Project folder name
 * @returns {Array} Content array with full paths
 */
function buildContentFromMeta(meta, projectPath, parentFolder, folderName) {
  if (meta.content && Array.isArray(meta.content)) {
    return buildContentPaths(meta.content, projectPath, parentFolder, folderName);
  }

  return convertLegacyToContent(meta, projectPath, parentFolder, folderName);
}

/**
 * Build legacy fields from content array for backwards compatibility
 * @param {Array} content - Content array
 * @returns {Object} Legacy fields
 */
function buildLegacyFields(content) {
  let type = "image";
  let images = [];
  let info = "";
  let videoId = "";
  let thumbnail = "";

  for (const item of content) {
    if (item.type === "video" && !videoId) {
      type = "video";
      videoId = item.videoId;
      thumbnail = getYouTubeThumbnail(item.videoId);
    } else if (item.type === "image") {
      if (item.caption) {
        images.push({ src: item.src, caption: item.caption });
      } else {
        images.push(item.src);
      }
    } else if (item.type === "text" && !info) {
      info = item.text;
    }
  }

  return { type, images, info, videoId, thumbnail };
}

/**
 * Build project data from meta.json (sync version)
 * @param {Object} project - Project info object
 * @returns {Object|null} Project data object or null if error
 */
function buildProjectData(project) {
  try {
    const metaContent = fs.readFileSync(project.metaPath, "utf8");
    const meta = JSON.parse(metaContent);

    const data = {
      id: `${project.parentFolder}-${project.folderName}`,
      title: meta.title || "",
      client: meta.client || "",
      industry: meta.industry || "",
      contribution: meta.contribution || "",
      date: meta.date || "",
      style: meta.style || "",
      software: meta.software || "",
      featured: meta.featured || false,
    };

    // Handle content - new format or legacy conversion
    data.content = buildContentFromMeta(
      meta,
      project.path,
      project.parentFolder,
      project.folderName
    );

    // Generate legacy fields for backwards compatibility
    Object.assign(data, buildLegacyFields(data.content));

    return data;
  } catch (error) {
    console.error(`Error processing project at ${project.path}:`, error.message);
    return null;
  }
}

/**
 * Scan all works from works directory (async version for server)
 * @param {string} worksDir - Path to works directory
 * @returns {Promise<Object[]>} Array of work objects with full data
 */
async function scanAllWorksAsync(worksDir) {
  const works = [];

  try {
    const entries = await fsPromises.readdir(worksDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const entryPath = path.join(worksDir, entry.name);
      const isYearFolder = /^\d{4}$/.test(entry.name);

      const projectFolders = await fsPromises.readdir(entryPath, { withFileTypes: true });

      for (const projectFolder of projectFolders) {
        if (!projectFolder.isDirectory() || projectFolder.name.startsWith(".")) continue;

        const projectPath = path.join(entryPath, projectFolder.name);
        const metaPath = path.join(projectPath, "meta.json");

        if (fs.existsSync(metaPath)) {
          try {
            const metaContent = await fsPromises.readFile(metaPath, "utf8");
            const meta = JSON.parse(metaContent);

            // Determine year
            let year;
            if (isYearFolder) {
              year = entry.name;
            } else {
              const yearMatch = projectFolder.name.match(/^(\d{4})/);
              year = yearMatch ? yearMatch[1] : "unknown";
            }

            // Handle content - new format or legacy conversion
            const content = buildContentFromMeta(
              meta,
              projectPath,
              entry.name,
              projectFolder.name
            );

            // Generate legacy fields for backwards compatibility
            const { type, images, info, videoId, thumbnail } = buildLegacyFields(content);

            works.push({
              id: `${entry.name}-${projectFolder.name}`,
              title: meta.title || "",
              type: type,
              client: meta.client || "",
              industry: meta.industry || "",
              contribution: meta.contribution || "",
              date: meta.date || "",
              style: meta.style || "",
              software: meta.software || "",
              info: info,
              featured: meta.featured || false,
              videoId: videoId,
              images: images,
              content: content,
              thumbnail: thumbnail,
              year: year,
              folder: projectFolder.name,
              parentFolder: entry.name,
              path: projectPath,
            });
          } catch (err) {
            console.error(`Error reading meta.json in ${metaPath}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error scanning works:", err.message);
  }

  return works;
}

module.exports = {
  getImagesFromProject,
  scanProjectsInDirectory,
  getAllProjects,
  buildProjectData,
  scanAllWorksAsync,
};
