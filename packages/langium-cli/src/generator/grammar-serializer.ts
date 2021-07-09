/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, Grammar, LangiumServices, NL, processGeneratorNode } from 'langium';
import { EOL } from 'os';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function serializeGrammar(services: LangiumServices, grammar: Grammar, config: LangiumConfig): string {
    // The json serializer returns strings with \n line delimiter by default
    // We need to translate these line endings to the OS specific line ending
    const json = services.serializer.JsonSerializer.serialize(grammar, 2).replace(/\\/g, '\\\\').split('\n').join(EOL);
    const node = new CompositeGeneratorNode();
    node.append(generatedHeader);

    if (config.langiumInternal) {
        node.append(
            "import { loadGrammar } from '../grammar-util';", NL,
            "import { Grammar } from './ast';"
        );
    } else {
        node.append("import { loadGrammar, Grammar } from 'langium';");
    }
    node.append(NL, NL);

    node.append(
        'let loaded: Grammar | undefined;', NL,
        'export const grammar = (): Grammar => loaded || (loaded = loadGrammar(`', json, '`));', NL
    );
    return processGeneratorNode(node);
}
