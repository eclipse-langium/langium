/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
******************************************************************************/

import * as core from '@actions/core';
import { publishPackages } from './publish.js';

function parseList(input: string): string[] {
    return input.split('\n').map(s => s.trim()).filter(Boolean);
}

async function run(): Promise<void> {
    const npmPackages = parseList(core.getInput('npm-packages'));
    const vscodePackages = parseList(core.getInput('vscode-packages'));
    const dryRun = core.getInput('dry-run') === 'true';
    const npmToken = core.getInput('npm-token') || undefined;
    const vsceToken = core.getInput('vsce-token') || undefined;
    const ovsxToken = core.getInput('ovsx-token') || undefined;
    const vsceVersion = core.getInput('vsce-version') || 'latest';
    const ovsxVersion = core.getInput('ovsx-version') || 'latest';

    try {
        await publishPackages({ npmPackages, vscodePackages, dryRun, npmToken, vsceToken, ovsxToken, vsceVersion, ovsxVersion });
    } catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}

run();
