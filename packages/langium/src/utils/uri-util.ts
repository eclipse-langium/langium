/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscodeUri from 'vscode-uri';

// Node.js and some bundlers don't deal well with the type information in `vscode-uri`
// This is a workaround to support all runtimes and bundlers
let uri = vscodeUri;
if ('default' in uri) {
    uri = uri.default as typeof uri;
}

type URI = vscodeUri.URI;
const URI = uri.URI;

export { URI };

export namespace UriUtils {

    export const basename = uri.Utils.basename;
    export const dirname = uri.Utils.dirname;
    export const extname = uri.Utils.extname;
    export const joinPath = uri.Utils.joinPath;
    export const resolvePath = uri.Utils.resolvePath;

    export function equals(a?: URI | string, b?: URI | string): boolean {
        return a?.toString() === b?.toString();
    }

    export function relative(from: URI | string, to: URI | string): string {
        const fromPath = typeof from === 'string' ? from : from.path;
        const toPath = typeof to === 'string' ? to : to.path;
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

}

/**
 * @deprecated Use `UriUtils.equals` instead.
 */
export const equalURI = UriUtils.equals;
/**
 * @deprecated Use `UriUtils.relative` instead.
 */
export const relativeURI = UriUtils.relative;
