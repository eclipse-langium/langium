/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { CompositeGeneratorNode, IndentNode, NL, processNode } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateModule(grammar: langium.Grammar, config: LangiumConfig): string {
    const node = new CompositeGeneratorNode();
    node.children.push(generatedHeader);
    if (config.langiumInternal) {
        node.children.push("import { Module } from '../../dependency-injection';", NL);
        node.children.push("import { LangiumGeneratedServices, LangiumServices } from '../../services';", NL);
    } else {
        node.children.push("import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';", NL);
    }
    node.children.push(
        'import { ', grammar.name, "AstReflection } from './ast';", NL,
        'import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL,
        "import { Parser } from './parser';", NL, NL
    );

    node.children.push('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
    const moduleNode = new IndentNode();
    moduleNode.children.push('parser: {', NL);
    const parserNode = new IndentNode();
    parserNode.children.push('LangiumParser: (injector) => new Parser(injector)', NL);
    moduleNode.children.push(parserNode, '},', NL);
    moduleNode.children.push('GrammarAccess: () => new ', grammar.name, 'GrammarAccess(),', NL);
    moduleNode.children.push('AstReflection: () => new ', grammar.name, 'AstReflection()', NL);
    node.children.push(moduleNode, '};', NL);

    return processNode(node);
}
