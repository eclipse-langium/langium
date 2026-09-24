/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseDocument } from 'langium/test';
import { RailroadHoverProvider } from 'langium-railroad';
import { describe, expect, test } from 'vitest';

const services = createLangiumGrammarServices(EmptyFileSystem, undefined, {
    lsp: {
        HoverProvider: (services) => new RailroadHoverProvider(services)
    }
}).grammar;

const DIAGRAM_REGEX = /!\[Railroad diagram of (\w+)\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/;

/**
 * Returns the hover content at the position of the n-th `<|>` marker in `text`.
 */
async function hoverAt(text: string, marker: number): Promise<string | undefined> {
    const parts = text.split('<|>');
    expect(marker).toBeLessThan(parts.length - 1);
    const offset = parts.slice(0, marker + 1).join('').length;
    const document = await parseDocument(services, parts.join(''));
    const hover = await services.lsp.HoverProvider!.getHoverContent(document, {
        textDocument: { uri: document.uri.toString() },
        position: document.textDocument.positionAt(offset)
    });
    const contents = hover?.contents;
    return contents && typeof contents === 'object' && 'value' in contents ? contents.value : undefined;
}

function decodeDiagram(hover: string | undefined): { name: string, svg: string } {
    const match = hover?.match(DIAGRAM_REGEX);
    expect(match, `Expected a railroad diagram in hover: ${hover}`).toBeTruthy();
    const bytes = Uint8Array.from(atob(match![2]), c => c.charCodeAt(0));
    return { name: match![1], svg: new TextDecoder().decode(bytes) };
}

const grammar = `
    grammar Test
    /**
     * A person with a name.
     */
    entry <|>Person: 'person' name=<|>ID greeting=<|>Greeting?;
    <|>Greeting: 'hello' | 'hi' | {infer Silence};
    terminal <|>ID: /[_a-zA-Z][\\w_]*/;
`;

describe('RailroadHoverProvider', () => {

    test('shows the diagram of a parser rule on its declaration', async () => {
        const hover = await hoverAt(grammar, 3);
        const { name, svg } = decodeDiagram(hover);
        expect(name).toBe('Greeting');
        expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(svg.trimEnd()).toMatch(/<\/svg>$/);
        expect(svg).toContain('>hello</text>');
        expect(svg).toContain('>hi</text>');
    });

    test('shows the same content on a reference as on the declaration', async () => {
        const declaration = await hoverAt(grammar, 3);
        const reference = await hoverAt(grammar, 2);
        expect(reference).toBeDefined();
        expect(reference).toBe(declaration);
    });

    test('shows the documentation first, then the diagram', async () => {
        const hover = await hoverAt(grammar, 0);
        expect(hover).toMatch(/^A person with a name\.\n\n---\n\n!\[Railroad diagram of Person\]/);
        expect(decodeDiagram(hover).svg).toContain('>person</text>');
    });

    test('shows no diagram for terminal rules', async () => {
        expect(await hoverAt(grammar, 4)).toBeUndefined();
        expect(await hoverAt(grammar, 1)).toBeUndefined();
    });

    test('encodes non-ASCII keywords as UTF-8', async () => {
        const hover = await hoverAt(`
            grammar Test
            entry <|>Arrow: 'ä' | '→';
        `, 0);
        const { svg } = decodeDiagram(hover);
        expect(svg).toContain('>ä</text>');
        expect(svg).toContain('>→</text>');
    });

    test('shows the diagram for incomplete grammars', async () => {
        const hover = await hoverAt(`
            grammar Test
            entry <|>A: 'a' b=Missing | ;
        `, 0);
        expect(decodeDiagram(hover).svg).toContain('>Missing</text>');
    });

});
