import colors from 'colors';
import { Command } from 'commander';
import { RequirementsLanguageMetaData } from '../language-server/generated/module';
import { createRequirementsAndTestsLanguageServices } from '../language-server/requirements-and-tests-language-module';
import { extractRequirementModelWithTestModels } from './cli-util';
import { generateSummary } from './generator';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createRequirementsAndTestsLanguageServices().RequirementsLanguage;
    const [requirementModel, testModels]  = await extractRequirementModelWithTestModels(fileName, services);
    const generatedFilePath = generateSummary(requirementModel, testModels, fileName, opts.destination);
    console.log(colors.green(`Requirement coverage generated successfully: ${generatedFilePath}`));
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
        .command('generate-requirements-coverage')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates a table for requirement coverage of requirements of that file')
        .action(generateAction);

    program.parse(process.argv);
}
