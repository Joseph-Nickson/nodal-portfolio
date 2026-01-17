/**
 * Shared works scanning functionality
 * Used by: build-data.js, admin/server.js
 */

const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { extractYouTubeId, getYouTubeThumbnail } = require("./utils");
const CONFIG = require("./config");

/**
 * Get images from a project directory
 * @param {string} projectPath - Path to project folder
 * @param {string[]} metaImages - Array of image filenames from meta.json
 * @param {string} parentFolder - Parent folder name (year or client)
 * @param {string} folderName - Project folder name
 * @returns {string[]} Array of relative image paths
 */
function getImagesFromProject(projectPath, metaImages, parentFolder, folderName) {
  const images = [];

  if (!metaImages || !Array.isArray(metaImages)) {
    return images;
  }

  for (const img of metaImages) {
    const imgPath = path.join(projectPath, img);
    if (fs.existsSync(imgPath)) {
      images.push(`works/${parentFolder}/${folderName}/${img}`);
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
      type: meta.type || "image",
      client: meta.client || "",
      industry: meta.industry || "",
      contribution: meta.contribution || "",
      date: meta.date || "",
      style: meta.style || "",
      software: meta.software || "",
      info: meta.info || "",
      featured: meta.featured || false,
    };

    // Get images
    const images = getImagesFromProject(
      project.path,
      meta.images,
      project.parentFolder,
      project.folderName
    );
    data.images = images;

    if (meta.type === "video") {
      const videoId = extractYouTubeId(meta.videoId) || extractYouTubeId(meta.video);
      data.videoId = videoId;

      // Use first image as thumbnail, or YouTube thumbnail as fallback
      if (images.length > 0) {
        data.thumbnail = images[0];
      } else if (videoId) {
        data.thumbnail = getYouTubeThumbnail(videoId);
      } else {
        data.thumbnail = "";
      }
    }

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

            // Build image paths
            const images = meta.images && Array.isArray(meta.images)
              ? meta.images.map(img => `works/${entry.name}/${projectFolder.name}/${img}`)
              : [];

            // Build thumbnail for videos
            let thumbnail = "";
            if (meta.type === "video" && meta.videoId) {
              const videoId = extractYouTubeId(meta.videoId);
              if (images.length > 0) {
                thumbnail = images[0];
              } else {
                thumbnail = getYouTubeThumbnail(videoId);
              }
            }

            works.push({
              id: `${entry.name}-${projectFolder.name}`,
              title: meta.title || "",
              type: meta.type || "image",
              client: meta.client || "",
              industry: meta.industry || "",
              contribution: meta.contribution || "",
              date: meta.date || "",
              style: meta.style || "",
              software: meta.software || "",
              info: meta.info || "",
              featured: meta.featured || false,
              videoId: meta.videoId ? extractYouTubeId(meta.videoId) : "",
              images: images,
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
