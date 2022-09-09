import colors from 'colors';
import path from 'path';
import fs from 'fs';
import { sync as globSync } from 'glob'
import { LangiumDocument, LangiumServices } from 'langium';
import { URI } from 'vscode-uri';
import { isTestModel, RequirementModel, TestModel } from '../language-server/generated/ast';

export async function extractDocuments(fileName: string, services: LangiumServices): Promise<[LangiumDocument, LangiumDocument[]]> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(colors.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(colors.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const documents : Array<LangiumDocument> = [];
    globSync(path.join(path.dirname(fileName), "**/*.tst")).forEach(testFileName=>{
        documents.push(services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(testFileName))));
    });

    const mainDocument = services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    documents.push(mainDocument);
    await services.shared.workspace.DocumentBuilder.build(documents, { validationChecks: 'all' });

    documents.forEach(document=>{
        const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
        if (validationErrors.length > 0) {
            console.error(colors.red('There are validation errors:'));
            for (const validationError of validationErrors) {
                console.error(colors.red(
                    `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                ));
            }
            process.exit(1);
        }
    });
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
    filePath = filePath.replace(/\..*$/, '').replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
