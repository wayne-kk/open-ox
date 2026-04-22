import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Test 1: Parse YAML file
const yamlContent = readFileSync('ai/flows/generate_project/prompts/skills/section/hero/lighting.yaml', 'utf-8');
const wrapped = '---\n' + yamlContent + '\n---\n';
try {
    const parsed = matter(wrapped);
    console.log('YAML parse OK:', JSON.stringify({ id: parsed.data.id, sectionTypes: parsed.data.sectionTypes }));
} catch (e) {
    console.error('YAML parse FAIL:', e.message);
}

// Test 2: Simulate collectFiles for .yaml
function collectFiles(dir, ext) {
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const entryPath = join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith(ext)) {
            results.push({ fullPath: entryPath, name: entry.name });
        } else if (entry.isDirectory()) {
            results.push(...collectFiles(entryPath, ext));
        }
    }
    return results;
}

const root = 'ai/flows/generate_project/prompts/skills';
const yamlFiles = collectFiles(root, '.yaml');
console.log('Found YAML files:', yamlFiles.map(f => f.name));

const mdFiles = collectFiles(root, '.md');
console.log('Found MD files:', mdFiles.map(f => f.name));
