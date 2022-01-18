/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    createDefaultModule, createDefaultSharedModule, getDocument, Grammar, inject, IParserConfig,
    isGrammar, isParserRule, LangiumDocuments, LangiumGeneratedServices, LangiumGeneratedSharedServices,
    LangiumParser, LangiumServices, LangiumSharedServices, Module, ParserRule, prepareLangiumParser
} from 'langium';
import { getFilePath, LangiumConfig, LangiumLanguageConfig } from './package';

export function validateParser(grammar: Grammar, config: LangiumConfig, grammarConfigMap: Map<Grammar, LangiumLanguageConfig>,
    documents: LangiumDocuments): Error | undefined {
    const parserConfig: IParserConfig = {
        ...config.chevrotainParserConfig,
        ...grammarConfigMap.get(grammar)?.chevrotainParserConfig,
        skipValidations: false
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unavailable: () => any = () => ({});
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: unavailable,
    };
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammar,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        LanguageMetaData: () => grammarConfigMap.get(grammar) as any,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const shared = inject(createDefaultSharedModule(), generatedSharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule);

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
                    const rule = findRule(defError.ruleName, grammar, documents);
                    if (rule && rule.$cstNode) {
                        const filePath = getFilePath(getDocument(rule).uri.fsPath, config);
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

function findRule(name: string, grammar: Grammar, documents: LangiumDocuments): ParserRule | undefined {
    for (const rule of grammar.rules) {
        if (rule.name === name && isParserRule(rule)) {
            return rule;
        }
    }
    for (const document of documents.all) {
        const ast = document.parseResult.value;
        if (isGrammar(ast)) {
            for (const rule of ast.rules) {
                if (rule.name === name && isParserRule(rule)) {
                    return rule;
                }
            }
        }
    }
    return undefined;
}
