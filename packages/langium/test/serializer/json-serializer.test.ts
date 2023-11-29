/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Reference } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { expandToStringLF } from 'langium/generate';
import { clearDocuments, parseHelper } from 'langium/test';
import { beforeEach, describe, expect, test } from 'vitest';
import { URI } from 'vscode-uri';

describe('JsonSerializer', async () => {

    const grammar = expandToStringLF`
        grammar JsonSerializerTest

        entry Entry: elements+=Element*;
        
        Element: 'element' name=ID ('refers' other=[Element:ID])?;
        
        hidden terminal WS: /\s+/;
        terminal ID: /[_a-zA-Z][\w]*/;
    `;
    const services = await createServicesForGrammar({ grammar });
    const serializer = services.serializer.JsonSerializer;
    const parse = parseHelper<Entry>(services);

    beforeEach(() => {
        clearDocuments(services);
    });

    test('Serialize reference to same document', async () => {
        const document1 = await parse(`
            element a
            element b refers a
        `);
        await services.shared.workspace.DocumentBuilder.build([document1, document1]);
        const json = serializer.serialize(document1.parseResult.value, { space: 4 });
        expect(json).toEqual(expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "a"
                    },
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "#/elements@0"
                        }
                    }
                ]
            }
        `);
    });

    test('Serialize reference to other document', async () => {
        const document1 = await parse(`
            element a
        `, {
            documentUri: 'file:///test1.langium'
        });
        const document2 = await parse(`
            element b refers a
        `, {
            documentUri: 'file:///test2.langium'
        });
        await services.shared.workspace.DocumentBuilder.build([document1, document2]);
        const json = serializer.serialize(document2.parseResult.value, { space: 4 });
        expect(json).toEqual(expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "file:///test1.langium#/elements@0"
                        }
                    }
                ]
            }
        `);
    });

    test('Serialize reference to other document with custom URI converter', async () => {
        const document1 = await parse(`
            element a
        `, {
            documentUri: 'file:///test1.langium'
        });
        const document2 = await parse(`
            element b refers a
        `, {
            documentUri: 'file:///test2.langium'
        });
        await services.shared.workspace.DocumentBuilder.build([document1, document2]);
        const json = serializer.serialize(document2.parseResult.value, {
            space: 4,
            uriConverter: (uri) => uri.with({ path: '/foo' + uri.path }).toString()
        });
        expect(json).toEqual(expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "file:///foo/test1.langium#/elements@0"
                        }
                    }
                ]
            }
        `);
    });

    test('Revive reference to same document', async () => {
        const json = expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "a"
                    },
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "#/elements@0"
                        }
                    }
                ]
            }
        `;
        const model = serializer.deserialize<Entry>(json);
        expect(model.elements).toHaveLength(2);
        expect(model.elements[1].other?.ref).toStrictEqual(model.elements[0]);
    });

    test('Revive reference to other document', async () => {
        const document1 = await parse(`
            element a
        `, {
            documentUri: 'file:///test1.langium'
        });
        await services.shared.workspace.DocumentBuilder.build([document1]);
        const json = expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "file:///test1.langium#/elements@0"
                        }
                    }
                ]
            }
        `;
        const model = serializer.deserialize<Entry>(json);
        expect(model.elements).toHaveLength(1);
        expect(model.elements[0].other?.ref).toStrictEqual(document1.parseResult.value.elements[0]);
    });

    test('Revive reference to other document with custom URI converter', async () => {
        const document1 = await parse(`
            element a
        `, {
            documentUri: 'file:///test1.langium'
        });
        await services.shared.workspace.DocumentBuilder.build([document1]);
        const json = expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "file:///foo/test1.langium#/elements@0"
                        }
                    }
                ]
            }
        `;
        const model = serializer.deserialize<Entry>(json, {
            uriConverter: (uriString) => {
                const uri = URI.parse(uriString);
                return uri.with({ path: uri.path.substring(4) });
            }
        });
        expect(model.elements).toHaveLength(1);
        expect(model.elements[0].other?.ref).toStrictEqual(document1.parseResult.value.elements[0]);
    });

    test('Reference error with non-existing document', async () => {
        const json = expandToStringLF`
            {
                "$type": "Entry",
                "elements": [
                    {
                        "$type": "Element",
                        "name": "b",
                        "other": {
                            "$ref": "file:///does-not-exist.langium#/elements@0"
                        }
                    }
                ]
            }
        `;
        const model = serializer.deserialize<Entry>(json);
        expect(model.elements).toHaveLength(1);
        expect(model.elements[0].other?.error?.message).toEqual('Could not find document for URI: file:///does-not-exist.langium#/elements@0');
    });

});

interface Entry extends AstNode {
    elements: Element[]
}

interface Element extends AstNode {
    name: string
    other?: Reference<Element>
}
