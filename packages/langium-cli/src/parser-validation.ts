/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, IParserConfig, LangiumDocuments, LangiumParser, LanguageMetaData } from 'langium';
import type { LangiumConfig, LangiumLanguageConfig } from './package-types.js';
import { AstUtils, GrammarAST, prepareLangiumParser } from 'langium';
import type { LangiumGrammarServices} from 'langium/grammar';
import { createServicesForGrammar } from 'langium/grammar';
import { getFilePath } from './package.js';

export async function validateParser(grammar: Grammar, config: LangiumConfig, grammarConfig: LangiumLanguageConfig,
    grammarServices: LangiumGrammarServices): Promise<Error | undefined> {
    const parserConfig: IParserConfig = {
        ...config.chevrotainParserConfig,
        ...grammarConfig.chevrotainParserConfig,
        skipValidations: false
    };
    const services = await createServicesForGrammar({
        grammarServices,
        grammar,
        languageMetaData: languageConfigToMetaData(grammarConfig),
        parserConfig
    });

    let parser: LangiumParser | undefined;
    try {
        parser = prepareLangiumParser(services);
        // The finalization step invokes parser validation, which can lead to thrown errors
        parser.finalize();
        return undefined;
    } catch (err) {
        if (parser && parser.definitionErrors.length > 0) {
            // Construct a message with tracing information
            let message = 'Parser definition errors detected:';
            for (const defError of parser.definitionErrors) {
                message += '\n-------------------------------\n';
                if (defError.ruleName) {
                    const rule = findRule(defError.ruleName, grammar, grammarServices.shared.workspace.LangiumDocuments);
                    if (rule && rule.$cstNode) {
                        const filePath = getFilePath(AstUtils.getDocument(rule).uri.fsPath, config);
                        const line = rule.$cstNode.range.start.line + 1;
                        message += `${filePath}:${line} - `;
                    }
                }
                message += defError.message;
            }
            return new Error(message);
        }
        if (err instanceof Error) {
            return err;
        }
        throw err;
    }
}

function languageConfigToMetaData(config: LangiumLanguageConfig): LanguageMetaData {
    return {
        languageId: config.id,
        fileExtensions: config.fileExtensions ?? [],
        fileNames: config.fileNames,
        caseInsensitive: Boolean(config.caseInsensitive),
        mode: 'development'
    };
}

function findRule(name: string, grammar: Grammar, documents: LangiumDocuments): GrammarAST.ParserRule | undefined {
    for (const rule of grammar.rules) {
        if (rule.name === name && GrammarAST.isParserRule(rule)) {
            return rule;
        }
    }
    for (const document of documents.all) {
        const ast = document.parseResult.value;
        if (GrammarAST.isGrammar(ast)) {
            for (const rule of ast.rules) {
                if (rule.name === name && GrammarAST.isParserRule(rule)) {
                    return rule;
                }
            }
        }
    }
    return undefined;
}
