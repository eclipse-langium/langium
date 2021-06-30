/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { CompositeGeneratorNode, IndentNode, NL, processGeneratorNode } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateModule(grammar: langium.Grammar, config: LangiumConfig): string {
    const node = new CompositeGeneratorNode();
    node.contents.push(generatedHeader);
    if (config.langiumInternal) {
        node.contents.push("import { Module } from '../../dependency-injection';", NL);
        node.contents.push("import { LangiumGeneratedServices, LangiumServices } from '../../services';", NL);
    } else {
        node.contents.push("import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';", NL);
    }
    node.contents.push(
        'import { ', grammar.name, "AstReflection } from './ast';", NL,
        'import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL,
        "import { Parser } from './parser';", NL, NL
    );

    node.contents.push('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
    const moduleNode = new IndentNode();
    moduleNode.contents.push('parser: {', NL);
    const parserNode = new IndentNode();
    parserNode.contents.push('LangiumParser: (injector) => new Parser(injector)', NL);
    moduleNode.contents.push(parserNode, '},', NL);
    moduleNode.contents.push('GrammarAccess: () => new ', grammar.name, 'GrammarAccess(),', NL);
    moduleNode.contents.push('AstReflection: () => new ', grammar.name, 'AstReflection()', NL);
    node.contents.push(moduleNode, '};', NL);

    return processGeneratorNode(node);
}
