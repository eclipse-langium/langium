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

    try {
        await publishPackages({ npmPackages, vscodePackages, dryRun, npmToken, vsceToken, ovsxToken });
    } catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}

run();
