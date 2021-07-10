/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, Grammar, NL, processGeneratorNode } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateMetaData(grammar: Grammar, config: LangiumConfig): string {
    const node = new CompositeGeneratorNode();
    node.append(generatedHeader, 'export class ', grammar.name, 'LanguageMetaData {', NL);
    node.indent(classBody => {
        classBody.append(`languageId = '${config.languageId}';`, NL);
        classBody.append(`extensions = [${config.extensions && config.extensions.map(e => `'${e}'`).join(', ')}];`, NL);
    });
    node.append('}', NL);
    return processGeneratorNode(node);
}