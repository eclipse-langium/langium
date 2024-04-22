/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, IParserConfig } from 'langium';
import { type Generated, expandToNode, joinToNode, toString } from 'langium/generate';
import type { LangiumConfig, LangiumLanguageConfig } from '../package-types.js';
import { generatedHeader } from './node-util.js';

export function generateModule(grammars: Grammar[], config: LangiumConfig, grammarConfigMap: Map<Grammar, LangiumLanguageConfig>): string {
    const grammarsWithName = grammars.filter(grammar => !!grammar.name);
    const parserConfig = config.chevrotainParserConfig;
    const hasIParserConfigImport = Boolean(parserConfig) || grammars.some(grammar => grammarConfigMap.get(grammar)?.chevrotainParserConfig !== undefined);
    let needsGeneralParserConfig = undefined;

    /* eslint-disable @typescript-eslint/indent */
    const node = expandToNode`
        ${generatedHeader}
    `.appendNewLine(
    ).appendIf(!!config.langiumInternal,
        expandToNode`

            import type { LanguageMetaData } from '../../languages/language-meta-data${config.importExtension}';
            import { ${config.projectName}AstReflection } from '../../languages/generated/ast${config.importExtension}';
            import type { Module } from '../../dependency-injection${config.importExtension}';
            import type { LangiumSharedCoreServices, LangiumCoreServices, LangiumGeneratedCoreServices, LangiumGeneratedSharedCoreServices } from '../../services${config.importExtension}';
        `.appendTemplateIf(hasIParserConfigImport)`

            import type { IParserConfig } from '../../parser/parser-config${config.importExtension}';
        `
    ).appendTemplateIf(!config.langiumInternal)`

        import type { LangiumSharedCoreServices, LangiumCoreServices, LangiumGeneratedCoreServices, LangiumGeneratedSharedCoreServices, LanguageMetaData, Module${hasIParserConfigImport ? ', IParserConfig' : ''} } from 'langium';
        import { ${config.projectName}AstReflection } from './ast${config.importExtension}';
    `.appendTemplate`

        import { ${joinToNode(grammarsWithName, grammar => grammar.name + 'Grammar', { separator: ', '}) } } from './grammar${config.importExtension}';
        ${joinToNode(
            grammarsWithName,
            grammar => {
                const config = grammarConfigMap.get(grammar)!;
                return expandToNode`

                    export const ${ grammar.name }LanguageMetaData = {
                        languageId: '${config.id}',
                        fileExtensions: [${config.fileExtensions && joinToNode(config.fileExtensions, e => appendQuotesAndDot(e), { separator: ', ' })}],
                        caseInsensitive: ${Boolean(config.caseInsensitive)}
                    } as const satisfies LanguageMetaData;
                `;
            },
            { appendNewLineIfNotEmpty: true }
        )}
        ${joinToNode(
            grammarsWithName,
            grammar => {
                const grammarParserConfig = grammarConfigMap.get(grammar)!.chevrotainParserConfig;
                if (grammarParserConfig) {
                    return expandToNode`

                        export const ${grammar.name}ParserConfig: IParserConfig = {
                            ${generateParserConfig(grammarParserConfig)}
                        };
                    `;
                } else {
                    needsGeneralParserConfig = true;
                    return;
                }
            },
            { appendNewLineIfNotEmpty: true }
        )}
        ${needsGeneralParserConfig && parserConfig && expandToNode`

            export const parserConfig: IParserConfig = {
                ${generateParserConfig(parserConfig)}
            };
        `}

        export const ${config.projectName}GeneratedSharedModule: Module<LangiumSharedCoreServices, LangiumGeneratedSharedCoreServices> = {
            AstReflection: () => new ${config.projectName}AstReflection()
        };
        ${joinToNode(
            grammarsWithName,
            grammar => {
                const grammarConfig = grammarConfigMap.get(grammar)!;
                return expandToNode`

                    export const ${grammar.name}GeneratedModule: Module<LangiumCoreServices, LangiumGeneratedCoreServices> = {
                        Grammar: () => ${grammar.name}Grammar(),
                        LanguageMetaData: () => ${grammar.name}LanguageMetaData,
                        parser: {${(grammarConfig.chevrotainParserConfig || parserConfig) && expandToNode`
                        ${'' /** needed to add the linebreak after the opening brace in case content is to be added, and to enable 'expandToNode' to identify the correct intendation of the subseqent parts. */}
                            ${grammarConfig.chevrotainParserConfig ? `ParserConfig: () => ${grammar.name}ParserConfig` : undefined}
                            ${!grammarConfig.chevrotainParserConfig && parserConfig ? 'ParserConfig: () => parserConfig' : undefined}
                        `}}
                    };
                `;
            },
            { appendNewLineIfNotEmpty: true}
        )}
    `;
    /* eslint-enable @typescript-eslint/indent */

    return toString(node);
}

function generateParserConfig(config: IParserConfig): Generated {
    return joinToNode(
        Object.entries(config),
        ([key, value]) => `${key}: ${typeof value === 'string' ? `'${value}'` : value},`,
        { appendNewLineIfNotEmpty: true }
    );
}

function appendQuotesAndDot(input: string): string {
    if (!input.startsWith('.')) {
        input = '.' + input;
    }
    return `'${input}'`;
}
