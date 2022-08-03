/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { SignatureHelpOptions } from 'vscode-languageserver';
import { expectMergeSignatureHelpOptions } from '../../src/test';

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