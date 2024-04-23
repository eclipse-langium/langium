/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Grammar, LangiumDocument, Mutable } from 'langium';
import type { LangiumConfig, LangiumLanguageConfig} from './package-types.js';
import { URI } from 'langium';
import { loadConfig } from './package.js';
import { AstUtils, GrammarAST } from 'langium';
import { createLangiumGrammarServices, resolveImport, resolveImportUri, resolveTransitiveImports } from 'langium/grammar';
import { NodeFileSystem } from 'langium/node';
import { generateAst } from './generator/ast-generator.js';
import { serializeGrammar } from './generator/grammar-serializer.js';
import { generateModule } from './generator/module-generator.js';
import { generateTextMate } from './generator/highlighting/textmate-generator.js';
import { generateMonarch } from './generator/highlighting/monarch-generator.js';
import { generatePrismHighlighting } from './generator/highlighting/prism-generator.js';
import { getTime, log } from './generator/langium-util.js';
import { elapsedTime, getUserChoice, schema } from './generator/node-util.js';
import { RelativePath } from './package-types.js';
import { getFilePath } from './package.js';
import { validateParser } from './parser-validation.js';
import { generateTypesFile } from './generator/types-generator.js';
import { createGrammarDiagramHtml, createGrammarDiagramSvg } from 'langium-railroad';
import { validate } from 'jsonschema';
import chalk from 'chalk';
import * as path from 'path';
import fs from 'fs-extra';

export async function generate(options: GenerateOptions): Promise<boolean> {
    const config = await loadConfig(options);
    const validation = validate(config, await schema, {
        nestedErrors: true
    });
    if (!validation.valid) {
        log('error', options, chalk.red('Error: Your Langium configuration is invalid.'));
        const errors = validation.errors.filter(error => error.path.length > 0);
        errors.forEach(error => {
            log('error', options, `--> ${error.stack}`);
        });
        return false;
    }
    const result = await runGenerator(config, options);
    if (options.watch) {
        printSuccess(result);
        console.log(getTime() + 'Langium generator will continue running in watch mode.');
        await runWatcher(config, options, await allGeneratorFiles(result));
    }
    // Outside of watch mode, report elapsed time for successful generation.
    printSuccess(result);
    return result.success;
}

async function allGeneratorFiles(results: GeneratorResult): Promise<string[]> {
    const files = Array.from(new Set(results.files));
    const filesExist = await Promise.all(files.map(e => fs.exists(e)));
    return files.filter((_, i) => filesExist[i]);
}

async function runWatcher(config: LangiumConfig, options: GenerateOptions, files: string[]): Promise<void> {
    if (files.length === 0) {
        return;
    }
    const watchers: fs.FSWatcher[] = [];
    for (const grammarFile of files) {
        const watcher = fs.watch(grammarFile, undefined, watch);
        watchers.push(watcher);
    }
    // The watch might be triggered multiple times
    // We only want to execute once
    let watcherTriggered = false;

    async function watch(): Promise<void> {
        if (watcherTriggered) {
            return;
        }
        watcherTriggered = true;
        // Delay the generation a bit in case multiple files are changed at once
        await delay(20);
        console.log(getTime() + 'File change detected. Starting compilation...');
        const results = await runGenerator(config, options);
        for (const watcher of watchers) {
            watcher.close();
        }
        printSuccess(results);
        runWatcher(config, options, await allGeneratorFiles(results));
    }

    await new Promise(() => { /* Never resolve */ });
}

function printSuccess(results: GeneratorResult): void {
    if (results.success) {
        console.log(`${getTime()}Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}

export interface GenerateOptions {
    file?: string;
    mode?: 'development' | 'production';
    watch?: boolean;
}

export interface ExtractTypesOptions {
    grammar: string;
    output?: string;
    force: boolean;
}

export interface GeneratorResult {
    success: boolean
    files: string[]
}

type GrammarElement = GrammarAST.AbstractRule | GrammarAST.Type | GrammarAST.Interface;

const { shared: sharedServices, grammar: grammarServices } = createLangiumGrammarServices(NodeFileSystem);
const documents = sharedServices.workspace.LangiumDocuments;

async function eagerLoad(document: LangiumDocument, uris: Set<string> = new Set()): Promise<URI[]> {
    const uriString = document.uri.toString();
    if (!uris.has(uriString)) {
        uris.add(uriString);
        const grammar = document.parseResult.value;
        if (GrammarAST.isGrammar(grammar)) {
            for (const imp of grammar.imports) {
                const importUri = resolveImportUri(imp);
                if (importUri) {
                    const document = await sharedServices.workspace.LangiumDocuments.getOrCreateDocument(importUri);
                    await eagerLoad(document, uris);
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
        const doc = AstUtils.getDocument(grammar);
        const uriString = doc.uri.toString();
        if (!visited.has(uriString)) {
            visited.add(uriString);
            map.set(
                grammar,
                (grammar.rules as GrammarElement[])
                    .concat(grammar.types)
                    .concat(grammar.interfaces)
            );
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)).filter((e): e is Grammar => e !== undefined);
            mapGrammarElements(importedGrammars, visited, map);
        }
    }
    return map;
}

function embedReferencedGrammar(grammar: Grammar, map: Map<Grammar, GrammarElement[]>): Grammar {
    const allGrammars = resolveTransitiveImports(documents, grammar);
    const linker = grammarServices.references.Linker;
    const buildReference = linker.buildReference.bind(linker);
    for (const importedGrammar of allGrammars) {
        const grammarElements = map.get(importedGrammar) ?? [];
        for (const element of grammarElements) {
            const copy = AstUtils.copyAstNode(element, buildReference);
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
    const grammarCopy: Grammar = {
        ...grammar,
        imports: []
    };
    // Link newly added elements to grammar
    AstUtils.linkContentToContainer(grammarCopy);
    return grammarCopy;
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
        const uri = AstUtils.getDocument(e).uri;
        const newDoc = documentFactory.fromModel(e, uri);
        (e as Mutable<AstNode>).$document = newDoc;
        return newDoc;
    });
    newDocuments.forEach(e => langiumDocuments.addDocument(e));
    await documentBuilder.build(newDocuments, { validation: false });
}

async function buildAll(config: LangiumConfig): Promise<Map<string, LangiumDocument>> {
    for (const doc of documents.all) {
        documents.deleteDocument(doc.uri);
    }
    const map = new Map<string, LangiumDocument>();
    const relPath = config[RelativePath];
    const uris = new Set<string>();
    for (const languageConfig of config.languages) {
        const absGrammarPath = URI.file(path.resolve(relPath, languageConfig.grammar));
        const document = await documents.getOrCreateDocument(absGrammarPath);
        await eagerLoad(document, uris);
    }
    for (const doc of documents.all) {
        map.set(doc.uri.fsPath, doc);
    }
    await sharedServices.workspace.DocumentBuilder.build(documents.all.toArray(), {
        validation: true
    });
    return map;
}

export async function runGenerator(config: LangiumConfig, options: GenerateOptions): Promise<GeneratorResult> {
    if (!config.languages || config.languages.length === 0) {
        log('error', options, 'No languages specified in config.');
        return {
            success: false,
            files: []
        };
    }
    if (options.mode) {
        config.mode = options.mode;
    }
    const all = await buildAll(config);
    const buildResult: (success: boolean) => GeneratorResult = (success: boolean) => ({
        success,
        files: Array.from(all.keys())
    });

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
        return buildResult(false);
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
                return buildResult(false);
            }
            grammars.push(grammar);
            configMap.set(grammar, languageConfig);
        }
    }

    const grammarElements = mapGrammarElements(grammars);

    const embeddedGrammars: Grammar[] = [];
    for (const grammar of grammars) {
        const embeddedGrammar = embedReferencedGrammar(grammar, grammarElements);
        embeddedGrammars.push(embeddedGrammar);
        configMap.set(embeddedGrammar, configMap.get(grammar)!);
    }
    // We need to rescope the grammars again
    // They need to pick up on the embedded references
    await relinkGrammars(embeddedGrammars);

    for (const grammar of embeddedGrammars) {
        // Create and validate the in-memory parser
        const parserAnalysis = await validateParser(grammar, config, configMap, grammarServices);
        if (parserAnalysis instanceof Error) {
            log('error', options, chalk.red(parserAnalysis.toString()));
            return buildResult(false);
        }
    }

    // Generate the output files
    const output = path.resolve(relPath, config.out ?? 'src/generated');
    log('log', options, `Writing generated files to ${chalk.white.bold(output)}`);

    if (await rmdirWithFail(output, ['ast.ts', 'grammar.ts', 'module.ts'], options)) {
        return buildResult(false);
    }
    if (await mkdirWithFail(output, options)) {
        return buildResult(false);
    }

    const genAst = generateAst(grammarServices, embeddedGrammars, config);
    await writeWithFail(path.resolve(updateLangiumInternalAstPath(output, config), 'ast.ts'), genAst, options);

    const serializedGrammar = serializeGrammar(grammarServices, embeddedGrammars, config);
    await writeWithFail(path.resolve(output, 'grammar.ts'), serializedGrammar, options);

    const genModule = generateModule(embeddedGrammars, config, configMap);
    await writeWithFail(path.resolve(output, 'module.ts'), genModule, options);

    for (const grammar of embeddedGrammars) {
        const languageConfig = configMap.get(grammar);

        if (languageConfig?.textMate) {
            const genTmGrammar = generateTextMate(grammar, languageConfig);
            const textMatePath = path.resolve(relPath, languageConfig.textMate.out);
            log('log', options, `Writing textmate grammar to ${chalk.white.bold(textMatePath)}`);
            await writeWithFail(textMatePath, genTmGrammar, options);
        }

        if (languageConfig?.monarch) {
            const genMonarchGrammar = generateMonarch(grammar, languageConfig);
            const monarchPath = path.resolve(relPath, languageConfig.monarch.out);
            log('log', options, `Writing monarch grammar to ${chalk.white.bold(monarchPath)}`);
            await writeWithFail(monarchPath, genMonarchGrammar, options);
        }

        if (languageConfig?.prism) {
            const genPrismGrammar = generatePrismHighlighting(grammar, languageConfig);
            const prismPath = path.resolve(relPath, languageConfig.prism.out);
            log('log', options, `Writing prism grammar to ${chalk.white.bold(prismPath)}`);
            await writeWithFail(prismPath, genPrismGrammar, options);
        }

        if (languageConfig?.railroad) {
            let css: string | undefined;
            if (languageConfig.railroad.css) {
                const cssPath = path.resolve(relPath, languageConfig.railroad.css);
                css = await readFileWithFail(cssPath, options);
            }
            const railroadOptions = { css };
            const rules = grammar.rules.filter(GrammarAST.isParserRule);
            const diagramPath = path.resolve(relPath, languageConfig.railroad.out);
            if (languageConfig.railroad.mode !== 'svg') {
                // Single File or no info -> write to HTML.
                const diagram = createGrammarDiagramHtml(rules, railroadOptions);
                log('log', options, `Writing railroad syntax diagram to ${chalk.white.bold(diagramPath)}`);
                await writeWithFail(diagramPath, diagram, options);
            } else {
                // Svg files requested -> make dir and write into it.
                const diagrams = createGrammarDiagramSvg(rules, railroadOptions);
                log('log', options, `Writing railroad syntax diagrams to ${chalk.white.bold(diagramPath)}`);
                for (const [name, diagram] of diagrams) {
                    const filePath = path.join(diagramPath, name);
                    await writeWithFail(`${filePath}.svg`, diagram, options);
                }
            }
        }
    }

    return buildResult(true);
}

function updateLangiumInternalAstPath(output: string, config: LangiumConfig): string {
    if (config.langiumInternal) {
        // The Langium internal ast is generated to the languages package.
        // This is done to prevent internal access to the `langium/grammar` export.
        return path.join(output, '..', '..', 'languages', 'generated');
    } else {
        return output;
    }
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
    const grammarDoc = await doLoadAndUpdate(await documents.getOrCreateDocument(URI.file(grammarPath)));
    const genTypes = generateTypesFile(grammarServices, [grammarDoc.parseResult.value as Grammar]);
    await writeWithFail(typesFilePath, genTypes, { watch: false });
    log('log', { watch: false }, `Generated type definitions to: ${chalk.white.bold(typesFilePath)}`);
    return;
}

/**
 * Builds the given grammar document and all imported grammars.
 */
async function doLoadAndUpdate(grammarDoc: LangiumDocument): Promise<LangiumDocument> {
    const allUris = await eagerLoad(grammarDoc);
    await sharedServices.workspace.DocumentBuilder.update(allUris, []);
    for (const doc of documents.all) {
        await sharedServices.workspace.DocumentBuilder.build([doc]);
        if (doc.uri === grammarDoc.uri) {
            // update grammar doc after rebuild
            grammarDoc = doc;
        }
    }
    return grammarDoc;
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

async function writeWithFail(filePath: string, content: string, options: GenerateOptions): Promise<void> {
    try {
        const parentDir = path.dirname(filePath);
        await mkdirWithFail(parentDir, options);
        await fs.writeFile(filePath, content);
    } catch (e) {
        log('error', options, `Failed to write file to ${chalk.red.bold(filePath)}`, e);
    }
}

async function readFileWithFail(path: string, options: GenerateOptions): Promise<string | undefined> {
    try {
        return await fs.readFile(path, { encoding: 'utf8' });
    } catch (e) {
        log('error', options, `Failed to read file from ${chalk.red.bold(path)}`, e);
        return undefined;
    }
}
