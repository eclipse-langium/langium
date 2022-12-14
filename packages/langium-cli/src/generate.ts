/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AstNode,
    copyAstNode,
    createLangiumGrammarServices,
    getDocument,
    Grammar,
    GrammarAST,
    LangiumDocument,
    linkContentToContainer,
    Mutable
} from 'langium';
import {
    resolveImport,
    resolveTransitiveImports
} from 'langium/lib/grammar/internal-grammar-util';
import { NodeFileSystem } from 'langium/node';
import { URI } from 'vscode-uri';
import { generateAst } from './generator/ast-generator';
import { serializeGrammar } from './generator/grammar-serializer';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/highlighting/textmate-generator';
import { generateMonarch } from './generator/highlighting/monarch-generator';
import {
    getUserChoice,
    log
} from './generator/util';
import {
    getFilePath,
    LangiumConfig,
    LangiumLanguageConfig,
    RelativePath
} from './package';
import { validateParser } from './parser-validation';
import { generateTypesFile } from './generator/types-generator';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type GenerateOptions = {
    file?: string;
    watch: boolean
}

export type ExtractTypesOptions = {
    grammar: string;
    output?: string;
    force: boolean;
}

export type GeneratorResult = 'success' | 'failure';

type GrammarElement = GrammarAST.AbstractRule | GrammarAST.Type | GrammarAST.Interface;

const { shared: sharedServices, grammar: grammarServices } = createLangiumGrammarServices(NodeFileSystem);
const documents = sharedServices.workspace.LangiumDocuments;

function eagerLoad(document: LangiumDocument, uris: Set<string> = new Set()): URI[] {
    const uriString = document.uri.toString();
    if (!uris.has(uriString)) {
        uris.add(uriString);
        const grammar = document.parseResult.value;
        if (GrammarAST.isGrammar(grammar)) {
            for (const imp of grammar.imports) {
                const importedGrammar = resolveImport(documents, imp);
                if (importedGrammar) {
                    const importedDoc = getDocument(importedGrammar);
                    eagerLoad(importedDoc, uris);
                }
            }
        }
    }

    return Array.from(uris).map(e => URI.parse(e));
}

/**
 * Creates a map that contains elements of all grammars.
 * This includes both input grammars and their transitive dependencies.
 */
function mapGrammarElements(grammars: Grammar[], visited: Set<string> = new Set(), map: Map<Grammar, GrammarElement[]> = new Map()): Map<Grammar, GrammarElement[]> {
    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        const uriString = doc.uri.toString();
        if (!visited.has(uriString)) {
            visited.add(uriString);
            map.set(
                grammar,
                (grammar.rules as GrammarElement[])
                    .concat(grammar.types)
                    .concat(grammar.interfaces)
            );
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
            mapGrammarElements(importedGrammars, visited, map);
        }
    }
    return map;
}

function embedReferencedGrammar(grammar: Grammar, map: Map<Grammar, GrammarElement[]>): void {
    const allGrammars = resolveTransitiveImports(documents, grammar);
    const linker = grammarServices.references.Linker;
    const buildReference = linker.buildReference.bind(linker);
    for (const importedGrammar of allGrammars) {
        const grammarElements = map.get(importedGrammar) ?? [];
        for (const element of grammarElements) {
            const copy = copyAstNode(element, buildReference);
            // Deactivate copied entry rule
            if (GrammarAST.isParserRule(copy)) {
                copy.entry = false;
            }
            if (GrammarAST.isAbstractRule(copy)) {
                grammar.rules.push(copy);
            } else if (GrammarAST.isType(copy)) {
                grammar.types.push(copy);
            } else if (GrammarAST.isInterface(copy)) {
                grammar.interfaces.push(copy);
            } else {
                throw new Error('Received invalid grammar element while generating project with multiple languages');
            }
        }
    }
    // Remove all imports, as their contents are now available in the grammar
    grammar.imports = [];
    // Link newly added elements to grammar
    linkContentToContainer(grammar);
}

async function relinkGrammars(grammars: Grammar[]): Promise<void> {
    const linker = grammarServices.references.Linker;
    const documentBuilder = sharedServices.workspace.DocumentBuilder;
    const documentFactory = sharedServices.workspace.LangiumDocumentFactory;
    const langiumDocuments = sharedServices.workspace.LangiumDocuments;
    const documents = langiumDocuments.all.toArray();
    // Unlink and delete all document data
    for (const document of documents) {
        linker.unlink(document);
    }
    await documentBuilder.update([], documents.map(e => e.uri));
    // Create and build new documents
    const newDocuments = grammars.map(e => {
        const uri = getDocument(e).uri;
        const newDoc = documentFactory.fromModel(e, uri);
        (e as Mutable<AstNode>).$document = newDoc;
        return newDoc;
    });
    newDocuments.forEach(e => langiumDocuments.addDocument(e));
    await documentBuilder.build(newDocuments, { validationChecks: 'none' });
}

async function buildAll(config: LangiumConfig): Promise<Map<string, LangiumDocument>> {
    for (const doc of documents.all) {
        documents.invalidateDocument(doc.uri);
    }
    const map = new Map<string, LangiumDocument>();
    const relPath = config[RelativePath];
    for (const languageConfig of config.languages) {
        const absGrammarPath = URI.file(path.resolve(relPath, languageConfig.grammar));
        const document = documents.getOrCreateDocument(absGrammarPath);
        const allUris = eagerLoad(document);
        await sharedServices.workspace.DocumentBuilder.update(allUris, []);
    }
    for (const doc of documents.all) {
        await sharedServices.workspace.DocumentBuilder.build([doc]);
        map.set(doc.uri.fsPath, doc);
    }
    return map;
}

export async function generate(config: LangiumConfig, options: GenerateOptions): Promise<GeneratorResult> {
    if (!config.languages || config.languages.length === 0) {
        log('error', options, 'No languages specified in config.');
        return 'failure';
    }
    const all = await buildAll(config);

    let hasErrors = false;
    for (const [path, document] of all) {
        const diagnostics = Array.from(document.diagnostics ?? []);
        diagnostics.sort((a, b) => a.range.start.line - b.range.start.line);
        for (const diagnostic of diagnostics) {
            const message = `${getFilePath(path, config)}:${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1} - ${diagnostic.message}`;
            if (diagnostic.severity === 1) {
                log('error', options, chalk.red(message));
            } else if (diagnostic.severity === 2) {
                log('warn', options, chalk.yellow(message));
            } else {
                log('log', options, message);
            }
        }
        if (!hasErrors) {
            hasErrors = diagnostics.length > 0 && diagnostics.some(e => e.severity === 1);
        }
    }

    if (hasErrors) {
        log('error', options, `Langium generator ${chalk.red.bold('failed')}.`);
        return 'failure';
    }

    const grammars: Grammar[] = [];
    const configMap: Map<Grammar, LangiumLanguageConfig> = new Map();
    const relPath = config[RelativePath];
    for (const languageConfig of config.languages) {
        const absGrammarPath = URI.file(path.resolve(relPath, languageConfig.grammar)).fsPath;
        const document = all.get(absGrammarPath);
        if (document) {
            const grammar = document.parseResult.value as Grammar;
            if (!grammar.isDeclared) {
                log('error', options, chalk.red(`${absGrammarPath}: The entry grammar must start with the 'grammar' keyword.`));
                return 'failure';
            }
            grammars.push(grammar);
            configMap.set(grammar, languageConfig);
        }
    }

    const grammarElements = mapGrammarElements(grammars);

    for (const grammar of grammars) {
        embedReferencedGrammar(grammar, grammarElements);
    }
    // We need to rescope the grammars again
    // They need to pick up on the embedded references
    await relinkGrammars(grammars);

    for (const grammar of grammars) {
        // Create and validate the in-memory parser
        const parserAnalysis = await validateParser(grammar, config, configMap, grammarServices);
        if (parserAnalysis instanceof Error) {
            log('error', options, chalk.red(parserAnalysis.toString()));
            return 'failure';
        }
    }

    // Generate the output files
    const output = path.resolve(relPath, config.out ?? 'src/generated');
    log('log', options, `Writing generated files to ${chalk.white.bold(output)}`);

    if (await rmdirWithFail(output, ['ast.ts', 'grammar.ts', 'module.ts'], options)) {
        return 'failure';
    }
    if (await mkdirWithFail(output, options)) {
        return 'failure';
    }

    const genAst = generateAst(grammarServices, grammars, config);
    await writeWithFail(path.resolve(output, 'ast.ts'), genAst, options);

    const serializedGrammar = serializeGrammar(grammarServices, grammars, config);
    await writeWithFail(path.resolve(output, 'grammar.ts'), serializedGrammar, options);

    const genModule = generateModule(grammars, config, configMap);
    await writeWithFail(path.resolve(output, 'module.ts'), genModule, options);

    for (const grammar of grammars) {
        const languageConfig = configMap.get(grammar);
        if (languageConfig?.textMate) {
            const genTmGrammar = generateTextMate(grammar, languageConfig);
            const textMatePath = path.resolve(relPath, languageConfig.textMate.out);
            log('log', options, `Writing textmate grammar to ${chalk.white.bold(textMatePath)}`);
            await writeHighlightGrammar(genTmGrammar, textMatePath, options);
        }

        if (languageConfig?.monarch) {
            const genMonarchGrammar = generateMonarch(grammar, languageConfig);
            const monarchPath = path.resolve(relPath, languageConfig.monarch.out);
            log('log', options, `Writing monarch grammar to ${chalk.white.bold(monarchPath)}`);
            await writeHighlightGrammar(genMonarchGrammar, monarchPath, options);
        }
    }

    return 'success';
}

export async function generateTypes(options: ExtractTypesOptions): Promise<void> {
    const grammarPath = path.isAbsolute(options.grammar) ? options.grammar : path.resolve('.', options.grammar);
    if (!fs.existsSync(grammarPath) || !fs.lstatSync(grammarPath).isFile()) {
        log('error', { watch: false }, chalk.red(`Grammar file '${grammarPath}' doesn't exist or is not a file.`));
        return;
    }
    const outputPath = options.output ?? path.join(path.resolve(grammarPath, '..'), 'types.langium');
    const typesFilePath = path.isAbsolute(outputPath) ? outputPath : path.join('.', outputPath);
    if (!options.force && fs.existsSync(typesFilePath)) {
        const overwriteTypesFile =
            await getUserChoice(`Target file '${path.relative('.', typesFilePath)}' already exists. Overwrite?`, ['yes', 'no'], 'yes') === 'yes';
        if (!overwriteTypesFile) {
            log('log', { watch: false }, 'Generation canceled.');
            return;
        }
    }

    const grammarFileUri = URI.file(grammarPath);
    const document = documents.getOrCreateDocument(grammarFileUri);
    const allUris = eagerLoad(document);
    await sharedServices.workspace.DocumentBuilder.update(allUris, []);
    let grammarDoc;
    for (const doc of documents.all) {
        await sharedServices.workspace.DocumentBuilder.build([doc]);
        grammarDoc = doc;
    }
    if (grammarDoc) {
        const genTypes = generateTypesFile(grammarServices, [grammarDoc.parseResult.value as Grammar]);
        await writeWithFail(typesFilePath, genTypes, { watch: false });
        log('log', { watch: false }, `Generated type definitions to: ${chalk.white.bold(typesFilePath)}`);
    }
    return;
}

/**
 * Writes contents of a grammar for syntax highlighting to a file, logging any errors and continuing without throwing
 * @param grammar Grammar contents to write
 * @param grammarPath Path to write, verifying the parent dir exists first
 * @param options Generation options
 */
async function writeHighlightGrammar(grammar: string, grammarPath: string, options: GenerateOptions): Promise<void> {
    const parentDir = path.dirname(grammarPath).split(path.sep).pop();
    parentDir && await mkdirWithFail(parentDir, options);
    await writeWithFail(grammarPath, grammar, options);
}

async function rmdirWithFail(dirPath: string, expectedFiles: string[], options: GenerateOptions): Promise<boolean> {
    try {
        let deleteDir = true;
        const dirExists = await fs.pathExists(dirPath);
        if (dirExists) {
            const existingFiles = await fs.readdir(dirPath);
            const unexpectedFiles = existingFiles.filter(file => !expectedFiles.includes(path.basename(file)));
            if (unexpectedFiles.length > 0) {
                log('log', options, `Found unexpected files in the generated directory: ${unexpectedFiles.map(e => chalk.yellow(e)).join(', ')}`);
                deleteDir = await getUserChoice('Do you want to delete the files?', ['yes', 'no'], 'yes') === 'yes';
            }
            if (deleteDir) {
                await fs.remove(dirPath);
            }
        }
        return false;
    } catch (e) {
        log('error', options, `Failed to delete directory ${chalk.red.bold(dirPath)}`, e);
        return true;
    }
}

async function mkdirWithFail(path: string, options: GenerateOptions): Promise<boolean> {
    try {
        await fs.mkdirs(path);
        return false;
    } catch (e) {
        log('error', options, `Failed to create directory ${chalk.red.bold(path)}`, e);
        return true;
    }
}

async function writeWithFail(path: string, content: string, options: { watch: boolean }): Promise<void> {
    try {
        await fs.writeFile(path, content);
    } catch (e) {
        log('error', options, `Failed to write file to ${chalk.red.bold(path)}`, e);
    }
}
