import type { <%= EntryName %> } from '<%= language-id %>-language';
import { create<%= LanguageName %>Services, <%= LanguageName %>LanguageMetaData } from '<%= language-id %>-language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode } from './util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = create<%= LanguageName %>Services(NodeFileSystem).<%= LanguageName %>;
    const model = await extractAstNode<<%= EntryName %>>(fileName, services);
    const generatedFilePath = generateJavaScript(model, fileName, opts.destination);
    console.log(chalk.green(`Code generated succesfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    // TODO: use Program API to declare the CLI
    const fileExtensions = <%= LanguageName %>LanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('Generates code for a provided source file.')
        .action(generateAction);

    program.parse(process.argv);
}
