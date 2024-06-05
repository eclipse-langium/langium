/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, LangiumCoreServices, Reference } from 'langium';
import { expandToNode, joinToNode, normalizeEOL, toString } from 'langium/generate';
import type { URI } from 'vscode-uri';
import type { LangiumConfig } from '../package-types.js';
import { generatedHeader } from './node-util.js';

export function serializeGrammar(services: LangiumCoreServices, grammars: Grammar[], config: LangiumConfig): string {
    const node = expandToNode`
        ${generatedHeader}
    `.appendNewLine(
    ).appendTemplateIf(!!config.langiumInternal)`

        import type { Grammar } from '../../languages/generated/ast${config.importExtension}';
        import { loadGrammarFromJson } from '../../utils/grammar-loader${config.importExtension}';
    `.appendTemplateIf(!config.langiumInternal)`

        import type { Grammar } from 'langium';
        import { loadGrammarFromJson } from 'langium';
    `.appendNewLine();

    node.append(
        joinToNode(
            grammars.filter(grammar => grammar.name),
            grammar => {
                const production = config.mode === 'production';
                const delimiter = production ? "'" : '`';
                const uriConverter = (uri: URI, ref: Reference) => {
                    // We expect the grammar to be self-contained after the transformations we've done before
                    throw new Error(`Unexpected reference to symbol '${ref.$refText}' in document: ${uri.toString()}`);
                };
                const serializedGrammar = services.serializer.JsonSerializer.serialize(grammar, {
                    space: production ? undefined : 2,
                    comments: true,
                    uriConverter
                });
                // The json serializer returns strings with \n line delimiter by default
                // We need to translate these line endings to the OS specific line ending
                let json = normalizeEOL(serializedGrammar
                    .replace(/\\/g, '\\\\')
                    .replace(new RegExp(delimiter, 'g'), '\\' + delimiter));
                if (!production) {
                    // Escape ${ in template strings
                    json = json.replace(/\${/g, '\\${');
                }
                return expandToNode`

                    let loaded${grammar.name}Grammar: Grammar | undefined;
                    export const ${grammar.name}Grammar = (): Grammar => loaded${grammar.name}Grammar ?? (loaded${grammar.name}Grammar = loadGrammarFromJson(${delimiter}${json}${delimiter}));
                `;
            },
            { appendNewLineIfNotEmpty: true }
        )
    );

    return toString(node);
}
