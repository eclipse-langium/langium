/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ExecException } from 'child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { exec } from 'child_process';
import { generateAction } from '../src/cli/generator.js';

describe('Test the domainmodel CLI', () => {
    let fullPath: string;
    const rawfileName = path.join(__dirname, '../example/qualified-names.dmodel');
    const destination = 'domainmodel-example-test';

    function commonExpectations() {
        const fileName = rawfileName.replace(/\..*$/, '').replace(/[.-]/g, '');
        fullPath = path.join(destination, path.basename(fileName));
        const generatedDirExists = fs.existsSync(fullPath);
        expect(generatedDirExists, 'Destination folder should exist').toBe(true);

        const dirContent = fs.readdirSync(fullPath);
        expect(dirContent.length, 'There should be 3 elements in destination').toBe(3);
        expect(dirContent.includes('E1.java')).toBe(true);
        expect(dirContent.includes('foo')).toBe(true);

        const fooDirContent = fs.readdirSync(path.join(fullPath, 'foo'));
        expect(fooDirContent.length, 'There should be 1 element in foo folder').toBe(1);
        expect(fooDirContent.includes('bar')).toBe(true);

        const barDirContent = fs.readdirSync(path.join(fullPath, 'foo', 'bar'));
        expect(barDirContent.length, 'There should be 1 element in bar folder').toBe(1);
        expect(barDirContent.includes('E2.java')).toBe(true);
    }

    test('Test action without CLI', async () => {
        await generateAction(rawfileName, { destination, quiet: true });
        commonExpectations();
    });

    test('Via CLI: Generator command returns code 0 and creates expected files', async () => {
        const result = await cli(['generate', rawfileName, '-d', destination, '-q']);
        if (result.code !== 0) {
            console.log('Error code:', result.code);
            console.log('Error message:', result.error);
        }
        expect(result.code, 'Result code should be 0').toBe(0);
        commonExpectations();
    });

    afterEach(() => {
        if (fs.existsSync(destination)) {
            fs.rmdirSync(destination, { recursive: true });
        }
    });

});

interface CliResult {
    code: number,
    error: ExecException | null,
    stdout: string,
    stderr: string
}

async function cli(args: string[]): Promise<CliResult> {
    return new Promise(resolve => {
        exec(`node "${path.join(__dirname, '../bin/cli')}" "${args.join('" "')}"`, (error, stdout, stderr) => {
            resolve({
                code: error && error.code ? error.code : 0,
                error,
                stdout,
                stderr
            });
        });
    });
}
