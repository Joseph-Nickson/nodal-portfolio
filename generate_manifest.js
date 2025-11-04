const fs = require('fs');
const path = require('path');

const worksDir = './works';
const categories = ['painting', 'film', 'music'];

const manifest = {};

categories.forEach(category => {
    const categoryPath = path.join(worksDir, category);
    if (fs.existsSync(categoryPath)) {
        const files = fs.readdirSync(categoryPath)
            .filter(file => /\.(jpg|jpeg|png|gif|mp4|mov|mp3|wav)$/i.test(file))
            .map(file => ({
                filename: file,
                path: `works/${category}/${file}`,
                title: file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
            }));
        manifest[category] = files;
    } else {
        manifest[category] = [];
    }
});

fs.writeFileSync('works_manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest generated:', manifest);
