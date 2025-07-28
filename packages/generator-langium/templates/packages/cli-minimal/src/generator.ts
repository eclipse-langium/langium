import type { <%= EntryName %> } from '<%= language-id %>-language';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import { extractDestinationAndName } from './util.js';

export function generateOutput(model: <%= EntryName %>, source: string, destination: string): string {
    const data = extractDestinationAndName(destination);

    const fileNode = expandToNode`
        // TODO : place here generated code
    `.appendNewLineIfNotEmpty();

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(destination, toString(fileNode));
    return destination;
}
