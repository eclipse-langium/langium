/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI, Utils } from 'vscode-uri';

export { URI };

export namespace UriUtils {

    export const basename = Utils.basename;
    export const dirname = Utils.dirname;
    export const extname = Utils.extname;
    export const joinPath = Utils.joinPath;
    export const resolvePath = Utils.resolvePath;

    const isWindows = process?.platform === 'win32';

    export function equals(a?: URI | string, b?: URI | string): boolean {
        return a?.toString() === b?.toString();
    }

    export function relative(from: URI | string, to: URI | string): string {
        const fromPath = typeof from === 'string' ? from : from.path;
        const toPath = typeof to === 'string' ? to : to.path;
        const fromParts = fromPath.split('/').filter(e => e.length > 0);
        const toParts = toPath.split('/').filter(e => e.length > 0);

        if (isWindows) {
            const upperCaseDriveLetter = /^[A-Z]:$/;
            if (fromParts[0] && upperCaseDriveLetter.test(fromParts[0])) {
                fromParts[0] = fromParts[0].toLowerCase();
            }
            if (toParts[0] && upperCaseDriveLetter.test(toParts[0])) {
                toParts[0] = toParts[0].toLowerCase();
            }
        }

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

    export function normalize(uri: URI | string): string {
        return URI.parse(uri.toString()).toString();
    }

}
