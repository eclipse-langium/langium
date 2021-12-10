/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { LangiumConfig, LangiumLanguageConfig, RelativePath } from './package';
import { AbstractRule, BuildResult, createLangiumGrammarServices, getDocument, Grammar, isGrammar, isParserRule, LangiumDocument, resolveImport, resolveTransitiveImports } from 'langium';
import { URI, Utils } from 'vscode-uri';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import { serializeGrammar } from './generator/grammar-serializer';
import { getTime, getUserChoice } from './generator/util';
import { validateParser } from './parser-validation';

export type GenerateOptions = {
    file?: string;
    watch: boolean
}

export type GeneratorResult = 'success' | 'failure';

const services = createLangiumGrammarServices();
const documents = services.workspace.LangiumDocuments;

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

async function buildAll(config: LangiumConfig): Promise<Map<string, BuildResult>> {
    const all = services.workspace.LangiumDocuments.all;
    for (const doc of all) {
        services.workspace.LangiumDocuments.invalidateDocument(doc.uri);
    }
    const map = new Map<string, BuildResult>();
    const relPath = config[RelativePath];
    for (const languageConfig of config.languages) {
        const absGrammarPath = URI.file(path.resolve(relPath, languageConfig.grammar));
        const document = services.workspace.LangiumDocuments.getOrCreateDocument(absGrammarPath);
        const allUris = eagerLoad(document);
        await services.workspace.DocumentBuilder.update(allUris, []);
    }
    for (const doc of services.workspace.LangiumDocuments.all) {
        const buildResult = await services.workspace.DocumentBuilder.build(doc);
        map.set(doc.uri.fsPath, buildResult);
    }
    return map;
}

export async function generate(config: LangiumConfig): Promise<GeneratorResult> {
    if (!config.languages || config.languages.length === 0) {
        console.error(`${getTime()}No languages specified in config.`);
        return 'failure';
    }
    const all = await buildAll(config);

    let hasErrors = false;
    for (const [path, buildResult] of all) {
        const diagnostics = buildResult.diagnostics;
        for (const diagnostic of diagnostics) {
            const message = `${Utils.basename(URI.file(path))}:${diagnostic.range.start.line}:${diagnostic.range.start.character} - ${diagnostic.message}`;
            if (diagnostic.severity === 1) {
                console.error(message.red);
            } else if (diagnostic.severity === 2) {
                console.warn(message.yellow);
            } else {
                console.log(message);
            }
        }
        if (!hasErrors) {
            hasErrors = diagnostics.length > 0 && diagnostics.some(e => e.severity === 1);
        }
    }

    if (hasErrors) {
        console.error(`${getTime()}Langium generator ${'failed'.red.bold}.`);
        return 'failure';
    }

    const grammars: Grammar[] = [];
    const configMap: Map<Grammar, LangiumLanguageConfig> = new Map();
    const relPath = config[RelativePath];
    for (const languageConfig of config.languages) {
        const absGrammarPath = URI.file(path.resolve(relPath, languageConfig.grammar)).fsPath;
        const buildResult = all.get(absGrammarPath);
        if (buildResult) {
            const grammar = buildResult.document.parseResult.value as Grammar;
            grammars.push(grammar);
            configMap.set(grammar, languageConfig);
        }
    }

    const ruleMap = mapRules(grammars);
    for (const grammar of grammars) {
        embedReferencedRules(grammar, ruleMap);
        // Create and validate the in-memory parser
        const parserAnalysis = validateParser(grammar, config);
        if (parserAnalysis instanceof Error) {
            console.error(parserAnalysis.toString().red);
            return 'failure';
        }
    }

    // Generate the output files
    const output = path.resolve(relPath, config.out ?? 'src/generated');
    console.log(`${getTime()}Writing generated files to ${output.white.bold}`);

    if (await rmdirWithFail(output, ['ast.ts', 'grammar.ts', 'module.ts'])) {
        return 'failure';
    }
    if (await mkdirWithFail(output)) {
        return 'failure';
    }

    const langiumServices = services.ServiceRegistry.getService(URI.file('/grammar.langium'));

    const genAst = generateAst(langiumServices, grammars, config);
    await writeWithFail(path.resolve(output, 'ast.ts'), genAst);

    const serializedGrammar = serializeGrammar(langiumServices, grammars, config);
    await writeWithFail(path.resolve(output, 'grammar.ts'), serializedGrammar);

    const genModule = generateModule(grammars, config, configMap);
    await writeWithFail(path.resolve(output, 'module.ts'), genModule);

    for (const grammar of grammars) {
        const languageConfig = configMap.get(grammar);
        if (languageConfig?.textMate) {
            const genTmGrammar = generateTextMate(grammar, languageConfig);
            const textMatePath = path.resolve(relPath, languageConfig.textMate.out);
            console.log(`${getTime()}Writing textmate grammar to ${textMatePath.white.bold}`);
            const parentDir = path.dirname(textMatePath).split(path.sep).pop();
            parentDir && await mkdirWithFail(parentDir);
            await writeWithFail(textMatePath, genTmGrammar);
        }
    }

    return 'success';
}

async function rmdirWithFail(dirPath: string, expectedFiles?: string[]): Promise<boolean> {
    try {
        let deleteDir = true;
        const dirExists = await fs.pathExists(dirPath);
        if(dirExists) {
            if (expectedFiles) {
                const existingFiles = await fs.readdir(dirPath);
                const unexpectedFiles = existingFiles.filter(file => !expectedFiles.includes(path.basename(file)));
                if (unexpectedFiles.length > 0) {
                    console.log(`${getTime()}Found unexpected files in the generated directory: ${unexpectedFiles.map(e => e.yellow).join(', ')}`);
                    deleteDir = await getUserChoice(`${getTime()}Do you want to delete the files?`, ['yes', 'no'], 'yes') === 'yes';
                }
            }
            if (deleteDir) {
                await fs.remove(dirPath);
            }
        }
        return false;
    } catch (e) {
        console.error(`${getTime()}Failed to delete directory ${dirPath.red.bold}`, e);
        return true;
    }
}

async function mkdirWithFail(path: string): Promise<boolean> {
    try {
        await fs.mkdirs(path);
        return false;
    } catch (e) {
        console.error(`${getTime()}Failed to create directory ${path.red.bold}`, e);
        return true;
    }
}

async function writeWithFail(path: string, content: string): Promise<void> {
    try {
        await fs.writeFile(path, content);
    } catch (e) {
        console.error(`${getTime()}Failed to write file to ${path.red.bold}`, e);
    }
}
