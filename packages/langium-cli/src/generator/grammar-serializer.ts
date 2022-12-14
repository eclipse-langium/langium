/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, Grammar, LangiumServices, NL, toString } from 'langium';
import { EOL } from 'os';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function serializeGrammar(services: LangiumServices, grammars: Grammar[], config: LangiumConfig): string {
    const node = new CompositeGeneratorNode();
    node.append(generatedHeader);

    if (config.langiumInternal) {
        node.append(
            "import { loadGrammarFromJson } from '../../utils/grammar-util';", NL,
            "import { Grammar } from './ast';");
    } else {
        node.append("import { loadGrammarFromJson, Grammar } from 'langium';");
    }
    node.append(NL, NL);

    for (let i = 0; i < grammars.length; i++) {
        const grammar = grammars[i];
        if (grammar.name) {
            // The json serializer returns strings with \n line delimiter by default
            // We need to translate these line endings to the OS specific line ending
            const json = services.serializer.JsonSerializer.serialize(grammar, { space: 2 }).replace(/\\/g, '\\\\').replace(/`/g, '\\`').split('\n').join(EOL);
            node.append(
                'let loaded', grammar.name, 'Grammar: Grammar | undefined;', NL,
                'export const ', grammar.name, 'Grammar = (): Grammar => loaded', grammar.name, 'Grammar ?? (loaded', grammar.name, 'Grammar = loadGrammarFromJson(`', json, '`));', NL
            );
            if (i < grammars.length - 1) {
                node.append(NL);
            }
        }
    }
    return toString(node);
}
