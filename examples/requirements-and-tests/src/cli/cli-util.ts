import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { LangiumDocument, LangiumServices } from 'langium';
import { URI } from 'vscode-uri';
import { isTestModel, RequirementModel, TestModel } from '../language-server/generated/ast';
import { WorkspaceFolder } from 'vscode-languageclient';

export async function extractDocuments(fileName: string, services: LangiumServices): Promise<[LangiumDocument, LangiumDocument[]]> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const folders : WorkspaceFolder[] = [{
        uri: URI.file(path.resolve(path.dirname(fileName))).toString(), // TODO: why a string and not an URI?
        name: 'main'
    }];
    await services.shared.workspace.WorkspaceManager.initializeWorkspace(folders);

    const documents = services.shared.workspace.LangiumDocuments.all.toArray();
    await services.shared.workspace.DocumentBuilder.build(documents, { validationChecks: 'all' });

    documents.forEach(document=>{
        const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
        if (validationErrors.length > 0) {
            console.error(chalk.red('There are validation errors:'));
            for (const validationError of validationErrors) {
                console.error(chalk.red(
                    `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                ));
            }
            process.exit(1);
        }
    });
    const mainDocument = services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));

    return [mainDocument, documents];
}

export async function extractRequirementModelWithTestModels(fileName: string, services: LangiumServices): Promise<[RequirementModel, TestModel[]]> {
    const [mainDocument, allDocuments] = await extractDocuments(fileName, services);
    return [
        mainDocument.parseResult?.value as RequirementModel, 
        allDocuments
            .filter(d=>isTestModel(d.parseResult?.value))
            .map(d=>d.parseResult?.value as TestModel)
    ];
}

interface FilePathData {
    destination: string,
    name: string
}

export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
