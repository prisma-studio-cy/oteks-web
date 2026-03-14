const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = 'd:/oteks/assets';
const MAX_WIDTH = 1920;
const QUALITY = 80;

function optimizeImages(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            optimizeImages(fullPath);
            return;
        }

        const ext = path.extname(file).toLowerCase();
        // Ignore metadata files and only process images
        if (file.startsWith('._')) return;
        
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            const inputPath = fullPath;
            const outputName = file.replace(ext, '.webp');
            const outputPath = path.join(dir, outputName);
            
            console.log(`Optimizing: ${file}...`);
            try {
                // Correct sharp-cli syntax based on help output
                const command = `npx.cmd -y sharp-cli -i "${inputPath}" -o "${outputPath}" -q ${QUALITY} resize ${MAX_WIDTH}`;
                execSync(command, { stdio: 'inherit' });
                console.log(`Successfully created ${outputName}`);
            } catch (error) {
                console.error(`Failed to optimize ${file}:`, error.message);
            }
        }
    });
}

optimizeImages(ASSETS_DIR);
