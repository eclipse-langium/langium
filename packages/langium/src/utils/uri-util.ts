/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';

export function equalURI(a?: URI | string, b?: URI | string): boolean {
    return a?.toString() === b?.toString();
}

export function relativeURI(from: URI, to: URI): string {
    const fromPath = from.path;
    const toPath = to.path;
    const fromParts = fromPath.split('/').filter(e => e.length > 0);
    const toParts = toPath.split('/').filter(e => e.length > 0);
    let i = 0;
    for (; i < fromParts.length; i++) {
        if (fromParts[i] !== toParts[i]) {
            break;
        }
    }
    const backPart = '../'.repeat(fromParts.length - i);
    const toPart = toParts.slice(i).join('/');
    return backPart + toPart;
}
