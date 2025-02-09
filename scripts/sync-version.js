import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJson = JSON.parse(
	readFileSync(resolve(__dirname, '../package.json'), 'utf8')
);

// Read card.json
const cardJsonPath = resolve(__dirname, '../card.json');
const cardJson = JSON.parse(readFileSync(cardJsonPath, 'utf8'));

// Update version
cardJson.version = packageJson.version;

// Write back to card.json
writeFileSync(cardJsonPath, JSON.stringify(cardJson, null, 2) + '\n');

console.log(`Updated card.json version to ${packageJson.version}`);
