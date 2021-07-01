/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, Grammar, LangiumServices, NL, processGeneratorNode } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function serializeGrammar(services: LangiumServices, grammar: Grammar, config: LangiumConfig): string {
    const json = services.serializer.JsonSerializer.serialize(grammar, 2);
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
        'const grammar = (): Grammar => loadGrammar(`', json.replace(/\\/g, '\\\\'), '`);', NL, NL,
        'export default grammar;', NL
    );
    return processGeneratorNode(node);
}
