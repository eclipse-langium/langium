/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import {
    AbstractRule, createLangiumGrammarServices, getDocument, Grammar, isGrammar,
    isParserRule, LangiumDocument, resolveImport, resolveTransitiveImports
} from 'langium';
import path from 'path';
import { URI } from 'vscode-uri';
import { generateAst } from './generator/ast-generator';
import { serializeGrammar } from './generator/grammar-serializer';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import { getUserChoice, log } from './generator/util';
import { getFilePath, LangiumConfig, LangiumLanguageConfig, RelativePath } from './package';
import { validateParser } from './parser-validation';

export type GenerateOptions = {
    file?: string;
    watch: boolean
}

export type GeneratorResult = 'success' | 'failure';

const { shared: sharedServices, grammar: grammarServices } = createLangiumGrammarServices();
const documents = sharedServices.workspace.LangiumDocuments;

function eagerLoad(document: LangiumDocument, uris: Set<string> = new Set()): URI[] {
    const uriString = document.uri.toString();
    if (!uris.has(uriString)) {
        uris.add(uriString);
        const grammar = document.parseResult.value;
        if (isGrammar(grammar)) {
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
 * Creates a map that contains all rules of all grammars.
 * This includes both input grammars and their transitive dependencies.
 */
function mapRules(grammars: Grammar[], visited: Set<string> = new Set(), map: Map<Grammar, AbstractRule[]> = new Map()): Map<Grammar, AbstractRule[]> {
    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        const uriString = doc.uri.toString();
        if (!visited.has(uriString)) {
            visited.add(uriString);
            map.set(grammar, grammar.rules.map(e => {
                // Create a new array of rules and copy all rules
                // Also deactivate all entry rules
                const shallowCopy = {...e};
                if (isParserRule(shallowCopy)) {
                    shallowCopy.entry = false;
                }
                return shallowCopy;
            }));
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
            mapRules(importedGrammars, visited, map);
        }
    }
    return map;
}

function embedReferencedRules(grammar: Grammar, map: Map<Grammar, AbstractRule[]>): void {
    const allGrammars = resolveTransitiveImports(documents, grammar);
    for (const importedGrammar of allGrammars) {
        const rules = map.get(importedGrammar);
        if (rules) {
            grammar.rules.push(...rules);
        }
    }
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
        const diagnostics = document.diagnostics ?? [];
        for (const diagnostic of diagnostics) {
            const message = `${getFilePath(path, config)}:${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1} - ${diagnostic.message}`;
            if (diagnostic.severity === 1) {
                log('error', options, message.red);
            } else if (diagnostic.severity === 2) {
                log('warn', options, message.yellow);
            } else {
                log('log', options, message);
            }
        }
        if (!hasErrors) {
            hasErrors = diagnostics.length > 0 && diagnostics.some(e => e.severity === 1);
        }
    }

    if (hasErrors) {
        log('error', options, `Langium generator ${'failed'.red.bold}.`);
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
            if(!grammar.isDeclared) {
                log('error', options, `${absGrammarPath}: The entry grammar must start with the 'grammar' keyword.`.red);
                return 'failure';
            }
            grammars.push(grammar);
            configMap.set(grammar, languageConfig);
        }
    }

    const ruleMap = mapRules(grammars);

    for (const grammar of grammars) {
        embedReferencedRules(grammar, ruleMap);
        // Create and validate the in-memory parser
        const parserAnalysis = validateParser(grammar, config, configMap, documents);
        if (parserAnalysis instanceof Error) {
            log('error', options, parserAnalysis.toString().red);
            return 'failure';
        }
    }

    // Generate the output files
    const output = path.resolve(relPath, config.out ?? 'src/generated');
    log('log', options, `Writing generated files to ${output.white.bold}`);

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
            log('log', options, `Writing textmate grammar to ${textMatePath.white.bold}`);
            const parentDir = path.dirname(textMatePath).split(path.sep).pop();
            parentDir && await mkdirWithFail(parentDir, options);
            await writeWithFail(textMatePath, genTmGrammar, options);
        }
    }

    return 'success';
}

async function rmdirWithFail(dirPath: string, expectedFiles: string[], options: GenerateOptions): Promise<boolean> {
    try {
        let deleteDir = true;
        const dirExists = await fs.pathExists(dirPath);
        if (dirExists) {
            const existingFiles = await fs.readdir(dirPath);
            const unexpectedFiles = existingFiles.filter(file => !expectedFiles.includes(path.basename(file)));
            if (unexpectedFiles.length > 0) {
                log('log', options, `Found unexpected files in the generated directory: ${unexpectedFiles.map(e => e.yellow).join(', ')}`);
                deleteDir = await getUserChoice('Do you want to delete the files?', ['yes', 'no'], 'yes') === 'yes';
            }
            if (deleteDir) {
                await fs.remove(dirPath);
            }
        }
        return false;
    } catch (e) {
        log('error', options, `Failed to delete directory ${dirPath.red.bold}`, e);
        return true;
    }
}

async function mkdirWithFail(path: string, options: GenerateOptions): Promise<boolean> {
    try {
        await fs.mkdirs(path);
        return false;
    } catch (e) {
        log('error', options, `Failed to create directory ${path.red.bold}`, e);
        return true;
    }
}

async function writeWithFail(path: string, content: string, options: GenerateOptions): Promise<void> {
    try {
        await fs.writeFile(path, content);
    } catch (e) {
        log('error', options, `Failed to write file to ${path.red.bold}`, e);
    }
}
