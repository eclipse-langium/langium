import type { Model } from '<%= language-id %>-language';
import { create<%= LanguageName %>Services, <%= LanguageName %>LanguageMetaData } from '<%= language-id %>-language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode } from './util.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = <%= LanguageName %>LanguageMetaData.fileExtensions.join(', ');

    // TODO: use Program API to declare the CLI

    program.parse(process.argv);
}
