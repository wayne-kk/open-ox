import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Test 1: Parse bundled hero skills.yaml (top-level skills:)
const yamlContent = readFileSync('ai/flows/generate_project/prompts/skills/section/hero/skills.yaml', 'utf-8');
const wrapped = '---\n' + yamlContent + '\n---\n';
try {
    const parsed = matter(wrapped);
    const skills = parsed.data.skills;
    const first = Array.isArray(skills) ? skills[0] : null;
    console.log('Bundled YAML parse OK:', JSON.stringify({ firstName: first?.name, sectionTypes: first?.sectionTypes }));
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
