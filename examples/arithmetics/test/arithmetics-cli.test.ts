/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ExecException } from 'child_process';
import { describe, expect, test } from 'vitest';
import * as path from 'node:path';
import { exec } from 'child_process';

describe('Test the arithmetics CLI', () => {
    const fileName = path.join(__dirname, '../example/example.calc');

    test('Generator command returns code 0', async () => {
        const result = await cli(['eval', fileName]);
        if (result.code !== 0) {
            console.log('Error code:', result.code);
            console.log('Error message:', result.error);
        }
        expect(result.code, 'Result code should be 0').toBe(0);
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
