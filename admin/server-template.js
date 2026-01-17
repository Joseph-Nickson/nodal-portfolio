const fs = require('fs');
const path = require('path');

const WORKS_DIR = './works';
const OUTPUT_FILE = './data.json';

function scanWorksDirectory() {
    const works = [];
    let id = 1;

    if (!fs.existsSync(WORKS_DIR)) {
        console.error('Error: works directory not found');
        return works;
    }

    const topLevel = fs.readdirSync(WORKS_DIR)
        .filter(item => {
            const itemPath = path.join(WORKS_DIR, item);
            return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
        });

    topLevel.forEach(folder => {
        const folderPath = path.join(WORKS_DIR, folder);
        
        const isYearFolder = /^\d{4}$/.test(folder);
        
        if (isYearFolder) {
            const projects = fs.readdirSync(folderPath)
                .filter(item => {
                    const itemPath = path.join(folderPath, item);
                    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
                });

            projects.forEach(projectFolder => {
                const work = processProject(path.join(folderPath, projectFolder), folder, projectFolder);
                if (work) {
                    work.id = id++;
                    works.push(work);
                }
            });
        } else {
            const items = fs.readdirSync(folderPath)
                .filter(item => {
                    const itemPath = path.join(folderPath, item);
                    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
                });

            items.forEach(projectFolder => {
                const yearMatch = projectFolder.match(/^(\d{4})\s*-\s*/);
                const year = yearMatch ? yearMatch[1] : '2024';
                
                const work = processProject(path.join(folderPath, projectFolder), year, projectFolder);
                if (work) {
                    work.id = id++;
                    works.push(work);
                }
            });
        }
    });

    return works;
}

function processProject(projectPath, year, projectFolder) {
    const metaPath = path.join(projectPath, 'meta.json');

    if (!fs.existsSync(metaPath)) {
        return null;
    }

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const files = fs.readdirSync(projectPath);
        
        let imageFile = null;
        let thumbnailFile = null;
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        if (files.includes('image.jpg')) imageFile = 'image.jpg';
        else if (files.includes('image.jpeg')) imageFile = 'image.jpeg';
        else if (files.includes('image.png')) imageFile = 'image.png';
        else if (files.includes('cover.jpg')) imageFile = 'cover.jpg';
        else {
            imageFile = files.find(f => {
                const ext = path.extname(f).toLowerCase();
                return imageExtensions.includes(ext) && !f.startsWith('thumbnail');
            });
        }

        thumbnailFile = files.find(f => f.startsWith('thumbnail'));

        if (!imageFile && meta.type !== 'video') {
            console.warn('    Warning: No image found for', projectFolder);
            return null;
        }

        const work = {
            title: meta.title || projectFolder,
            type: meta.type || 'image',
            client: meta.client || 'Unknown',
            contribution: meta.contribution || 'Unknown',
            date: meta.date || year,
            style: meta.style || 'Unknown',
            featured: meta.featured || false
        };

        const relativePath = path.relative('./works', projectPath);
        
        if (meta.type === 'video') {
            if (thumbnailFile) {
                work.thumbnail = path.join('works', relativePath, thumbnailFile);
            } else if (meta.videoId) {
                work.thumbnail = `https://img.youtube.com/vi/${meta.videoId}/mqdefault.jpg`;
            }
            work.videoId = meta.videoId || '';
        } else {
            work.image = path.join('works', relativePath, imageFile);
        }

        console.log('    Added:', work.title);
        return work;

    } catch (error) {
        console.error('    Error reading', projectFolder, ':', error.message);
        return null;
    }
}

console.log('Building data.json...\n');
const works = scanWorksDirectory();

if (works.length === 0) {
    console.log('\nNo works found!');
} else {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(works, null, 4));
    console.log('\nGenerated', OUTPUT_FILE, 'with', works.length, 'works');
}
