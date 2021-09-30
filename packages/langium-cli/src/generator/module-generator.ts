/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateModule(grammar: langium.Grammar, config: LangiumConfig): string {
    const parserConfig = config.chevrotainParserConfig;
    const node = new CompositeGeneratorNode();

    node.append(generatedHeader);
    if (config.langiumInternal) {
        node.append(`import { LanguageMetaData${parserConfig ? ', IParserConfig' : ''} } from '../..';`, NL);
        node.append("import { Module } from '../../dependency-injection';", NL);
        node.contents.push("import { LangiumGeneratedServices, LangiumServices } from '../../services';", NL);
    } else {
        node.append(`import { LangiumGeneratedServices, LangiumServices, LanguageMetaData, Module${parserConfig ? ', IParserConfig' : ''} } from 'langium';`, NL);
    }
    node.append(
        'import { ', grammar.name, "AstReflection } from './ast';", NL,
        "import { grammar } from './grammar';", NL, NL
    );

    node.append('export const languageMetaData: LanguageMetaData = {', NL);
    node.indent(metaData => {
        metaData.append(`languageId: '${config.languageId}',`, NL);
        metaData.append(`fileExtensions: [${config.fileExtensions && config.fileExtensions.map(e => appendQuotesAndDot(e)).join(', ')}]`, NL);
    });
    node.append('};', NL, NL);

    if (parserConfig) {
        node.append('export const parserConfig: IParserConfig = {', NL);
        node.indent(configNode => {
            Object.keys(parserConfig).forEach(key => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (parserConfig as any)[key];
                configNode.append(`${key}: ${typeof value === 'string' ? `'${value}'` : value},`, NL);
            });
        });
        node.append('};', NL, NL);
    }

    node.append('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
    node.indent(moduleNode => {
        moduleNode.append(
            'Grammar: () => grammar(),', NL,
            'AstReflection: () => new ', grammar.name, 'AstReflection(),', NL,
            'LanguageMetaData: () => languageMetaData,', NL,
            'parser: {',
        );
        if (parserConfig) {
            moduleNode.append(NL);
            moduleNode.indent(parserGroupNode => {
                parserGroupNode.append('ParserConfig: () => parserConfig', NL);
            });
        }
        moduleNode.append('}', NL);
    });
    node.append('};', NL);

    return processGeneratorNode(node);
}

function appendQuotesAndDot(input: string): string {
    if (!input.startsWith('.')) {
        input = '.' + input;
    }
    return `'${input}'`;
}
