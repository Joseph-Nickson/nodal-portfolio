const fs = require("fs");
const path = require("path");
const { getAllProjects, buildProjectData } = require("./shared/scanner");

const worksDir = path.join(__dirname, "works");
const outputFile = path.join(__dirname, "data.json");

function main() {
  console.log("Scanning for projects...");

  const projects = getAllProjects(worksDir);
  console.log(`Found ${projects.length} projects`);

  const allData = projects
    .map(buildProjectData)
    .filter((data) => data !== null);

  // Sort by date (newest first)
  allData.sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2), "utf8");
  console.log(`\nData written to ${outputFile}`);
  console.log(`Total projects: ${allData.length}`);
}

main();
