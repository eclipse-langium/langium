/******************************************************************************
 * Copyright 2021-2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type { Grammar } from '../grammar/generated/ast';
import { DefaultJsonSerializer } from '../serializer/json-serializer';
import { DocumentState, LangiumDocument } from '../workspace/documents';
import { Mutable } from './ast-util';

/**
 * Load a Langium grammar for your language from a JSON string. This is used by several services,
 * most notably the parser builder which interprets the grammar to create a parser.
 */
export function loadGrammarFromJson(json: string): Grammar {
    const serializer = new DefaultJsonSerializer();
    const astNode = serializer.deserialize(json) as Mutable<Grammar>;
    const uri = `memory://${astNode.name ?? 'grammar'}.langium`;
    const documentUri = URI.parse(uri);
    const document: LangiumDocument = {
        parseResult: {
            lexerErrors: [],
            parserErrors: [],
            value: astNode
        },
        references: [],
        state: DocumentState.Validated,
        textDocument: TextDocument.create(uri, 'langium', 0, ''),
        uri: documentUri
    };
    astNode.$document = document;
    return astNode;
}