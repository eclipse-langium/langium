/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { CompositeGeneratorNode, NL, toString } from 'langium';
import { LangiumConfig, LangiumLanguageConfig } from '../package';
import { generatedHeader } from './util';

export function generateModule(grammars: langium.Grammar[], config: LangiumConfig, grammarConfigMap: Map<langium.Grammar, LangiumLanguageConfig>): string {
    const parserConfig = config.chevrotainParserConfig;
    const hasIParserConfigImport = Boolean(parserConfig) || grammars.some(grammar => grammarConfigMap.get(grammar)?.chevrotainParserConfig !== undefined);
    const node = new CompositeGeneratorNode();

    node.append(generatedHeader);
    if (config.langiumInternal) {
        node.append("import { LanguageMetaData } from '../language-meta-data';", NL);
        node.append("import { Module } from '../../dependency-injection';", NL);
        node.contents.push("import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices } from '../../services';", NL);
        if (hasIParserConfigImport) {
            node.append("import { IParserConfig } from '../../parser/parser-config';", NL);
        }
    } else {
        node.append(`import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices, LanguageMetaData, Module${hasIParserConfigImport ? ', IParserConfig' : ''} } from 'langium';`, NL);
    }

    node.append(
        'import { ', config.projectName, "AstReflection } from './ast';", NL,
        'import { '
    );
    for (let i = 0; i < grammars.length; i++) {
        const grammar = grammars[i];
        if (grammar.name) {
            node.append(grammar.name, 'Grammar');
            if (i < grammars.length - 1) {
                node.append(', ');
            }
        }
    }
    node.append(" } from './grammar';", NL, NL);

    for (const grammar of grammars) {
        if (grammar.name) {
            const config = grammarConfigMap.get(grammar)!;
            node.append('export const ', grammar.name, 'LanguageMetaData: LanguageMetaData = {', NL);
            node.indent(metaData => {
                metaData.append(`languageId: '${config.id}',`, NL);
                metaData.append(`fileExtensions: [${config.fileExtensions && config.fileExtensions.map(e => appendQuotesAndDot(e)).join(', ')}],`, NL);
                metaData.append(`caseInsensitive: ${Boolean(config.caseInsensitive)}`, NL);
            });
            node.append('};', NL, NL);
        }
    }

    let needsGeneralParserConfig = false;
    for (const grammar of grammars) {
        const grammarConfig = grammarConfigMap.get(grammar)!;
        const grammarParserConfig = grammarConfig.chevrotainParserConfig;
        if (grammarParserConfig && grammar.name) {
            node.append('export const ', grammar.name, 'ParserConfig: IParserConfig = ', generateParserConfig(grammarParserConfig));
        } else {
            needsGeneralParserConfig = true;
        }
    }

    if (needsGeneralParserConfig && parserConfig) {
        node.append('export const parserConfig: IParserConfig = ', generateParserConfig(parserConfig));
    }

    node.append('export const ', config.projectName, 'GeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {', NL);
    node.indent(moduleNode => {
        moduleNode.append(
            'AstReflection: () => new ', config.projectName, 'AstReflection()', NL
        );
    });
    node.append('};', NL, NL);

    for (let i = 0; i < grammars.length; i++) {
        const grammar = grammars[i];
        if (grammar.name) {
            const grammarConfig = grammarConfigMap.get(grammar)!;
            node.append('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
            node.indent(moduleNode => {
                moduleNode.append(
                    'Grammar: () => ', grammar.name!, 'Grammar(),', NL,
                    'LanguageMetaData: () => ', grammar.name!, 'LanguageMetaData,', NL,
                    'parser: {'
                );
                if (grammarConfig.chevrotainParserConfig ?? parserConfig) {
                    moduleNode.append(NL);
                    moduleNode.indent(parserGroupNode => {
                        const parserConfigName = grammarConfig.chevrotainParserConfig
                            ? grammar.name + 'ParserConfig'
                            : 'parserConfig';
                        parserGroupNode.append('ParserConfig: () => ', parserConfigName,  NL);
                    });
                }
                moduleNode.append('}', NL);
            });
            node.append('};', NL);
            if (i < grammars.length - 1) {
                node.append(NL);
            }
        }
    }

    return toString(node);
}

function generateParserConfig(config: langium.IParserConfig): CompositeGeneratorNode {
    const node = new CompositeGeneratorNode();
    node.append('{', NL);
    node.indent(configNode => {
        for (const [key, value] of Object.entries(config)) {
            configNode.append(`${key}: ${typeof value === 'string' ? `'${value}'` : value},`, NL);
        }
    });
    node.append('};', NL, NL);
    return node;
}

function appendQuotesAndDot(input: string): string {
    if (!input.startsWith('.')) {
        input = '.' + input;
    }
    return `'${input}'`;
}
