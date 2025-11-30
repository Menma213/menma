const fs = require('fs').promises;
const path = require('path');

// A list of directories to ignore during the search
const ignoreDirs = ['node_modules', '.git', 'public', 'views', 'assets', 'images'];

async function analyzeCode(prompt) {
    const relevantFiles = [];
    const projectRoot = path.join(__dirname, '..');
    
    // Simple keyword extraction (split prompt into words)
    const keywords = prompt.toLowerCase().split(/\s+/).filter(word => word.length > 2);

    async function searchDir(directory) {
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);

                if (entry.isDirectory()) {
                    if (!ignoreDirs.includes(entry.name)) {
                        await searchDir(fullPath);
                    }
                } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json'))) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        const lowerContent = content.toLowerCase();
                        
                        // Check if any keyword appears in the file content
                        if (keywords.some(keyword => lowerContent.includes(keyword))) {
                            relevantFiles.push(path.relative(projectRoot, fullPath));
                        }
                    } catch (readErr) {
                        // Ignore files that can't be read
                    }
                }
            }
        } catch (dirErr) {
            console.error(`Could not read directory: ${directory}`, dirErr);
        }
    }

    await searchDir(projectRoot);

    // In a real scenario, we might return more context, but for now, just the files.
    return {
        files: relevantFiles.slice(0, 20) // Limit to 20 files to avoid being overwhelming
    };
}

module.exports = { analyzeCode };
