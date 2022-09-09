import colors from 'colors';
import { Command } from 'commander';
import { RequirementModel } from '../language-server/generated/ast';
import { RequirementsLanguageMetaData } from '../language-server/generated/module';
import { createRequirementsAndTestsLanguageServices } from '../language-server/requirements-language-module';
import { extractAstNode } from './cli-util';
import { generateJavaScript } from './generator';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createRequirementsAndTestsLanguageServices().RequirementsLanguage;
    const model = await extractAstNode<RequirementModel>(fileName, services);
    const generatedFilePath = generateJavaScript(model, fileName, opts.destination);
    console.log(colors.green(`JavaScript code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    const fileExtensions = RequirementsLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file')
        .action(generateAction);

    program.parse(process.argv);
}
