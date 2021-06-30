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
    const node = new CompositeGeneratorNode();
    node.append(generatedHeader);
    if (config.langiumInternal) {
        node.append("import { Module } from '../../dependency-injection';", NL);
        node.contents.push("import { LangiumGeneratedServices, LangiumServices } from '../../services';", NL);
    } else {
        node.append("import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';", NL);
    }
    node.append(
        'import { ', grammar.name, "AstReflection } from './ast';", NL,
        'import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL,
        "import { Parser } from './parser';", NL, NL
    );

    node.append('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
    node.indent(moduleNode => {
        moduleNode.append('parser: {', NL);
        moduleNode.indent(parserNode => {
            parserNode.append('LangiumParser: (injector) => new Parser(injector)', NL);
        });
        moduleNode.append(
            '},', NL,
            'GrammarAccess: () => new ', grammar.name, 'GrammarAccess(),', NL,
            'AstReflection: () => new ', grammar.name, 'AstReflection()', NL
        );
    });
    node.append('};', NL);

    return processGeneratorNode(node);
}
