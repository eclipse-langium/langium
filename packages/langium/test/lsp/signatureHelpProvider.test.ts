/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { SignatureHelpOptions } from 'vscode-languageserver';
import { describe, expect, test } from 'vitest';
import { mergeSignatureHelpOptions } from 'langium/lsp';

describe('MergeSignatureHelpOptions', () => {
    test('Must merge SignatureHelpOptions triggerCharacters', async () => {
        const options: SignatureHelpOptions[] = [
            {
                triggerCharacters: ['.']
            },
            {
                triggerCharacters: ['(']
            },
            {
                triggerCharacters: ['[']
            }
        ];
        const mergedOptions: SignatureHelpOptions = {
            triggerCharacters: ['.', '[', '(']
        };
        expectMergeSignatureHelpOptions({ options, mergedOptions });
    });

    test('Must merge SignatureHelpOptions retriggerCharacters', async () => {
        const options: SignatureHelpOptions[] = [
            {
                triggerCharacters: ['.'],
                retriggerCharacters: ['.']
            },
            {
                triggerCharacters: ['('],
                retriggerCharacters: ['(']
            },
            {
                triggerCharacters: ['['],
                retriggerCharacters: ['[']
            }
        ];
        const mergedOptions: SignatureHelpOptions = {
            triggerCharacters: ['.', '[', '('],
            retriggerCharacters: ['.', '[', '(']
        };
        expectMergeSignatureHelpOptions({ options, mergedOptions });
    });

    test('Must remove duplicates from triggerCharacters', async () => {
        const options: SignatureHelpOptions[] = [
            {
                triggerCharacters: ['(']
            },
            {
                triggerCharacters: ['(']
            }
        ];
        const mergedOptions: SignatureHelpOptions = {
            triggerCharacters: ['(']
        };
        expectMergeSignatureHelpOptions({ options, mergedOptions });
    });

    test('Must remove duplicates from retriggerCharacters', async () => {
        const options: SignatureHelpOptions[] = [
            {
                triggerCharacters: ['('],
                retriggerCharacters: ['(']
            },
            {
                triggerCharacters: ['('],
                retriggerCharacters: ['(']
            }
        ];
        const mergedOptions: SignatureHelpOptions = {
            triggerCharacters: ['('],
            retriggerCharacters: ['(']
        };
        expectMergeSignatureHelpOptions({ options, mergedOptions });
    });
});

interface TestSignatureHelpOptions {
    options: SignatureHelpOptions[];
    mergedOptions: SignatureHelpOptions;
}

function expectMergeSignatureHelpOptions(testOptions: TestSignatureHelpOptions): void {
    const mergedSignatureHelp = mergeSignatureHelpOptions(testOptions.options);

    expect(mergedSignatureHelp?.triggerCharacters?.length).toEqual(testOptions.mergedOptions.triggerCharacters?.length);
    expect(mergedSignatureHelp?.retriggerCharacters?.length).toEqual(testOptions.mergedOptions.retriggerCharacters?.length);

    expect(mergedSignatureHelp?.triggerCharacters).toEqual(testOptions.mergedOptions.triggerCharacters?.sort());
    expect(mergedSignatureHelp?.retriggerCharacters).toEqual(testOptions.mergedOptions.retriggerCharacters?.sort());
}
