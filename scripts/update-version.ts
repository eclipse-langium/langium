import fs from 'fs-extra';
import path from 'path';

async function runUpdate() {
    const langiumPath = getPath('langium', true);
    const langiumPackage = await fs.readJson(langiumPath);
    const version = langiumPackage.version;
    await Promise.all([
        replaceAll('langium', true, version),
        replaceAll('langium-railroad', true, version),
        replaceAll('langium-cli', true, version),
        replaceAll('langium-sprotty', true, version),
        replaceAll('langium-vscode', true, version),
        replaceAll('generator-langium/templates/packages/language-example', true, version),
        replaceAll('generator-langium/templates/packages/language-minimal', true, version),
        replaceAll('arithmetics', false, version),
        replaceAll('domainmodel', false, version),
        replaceAll('requirements', false, version),
        replaceAll('statemachine', false, version),
    ]);
}

async function replaceAll(project: string, isPackage: boolean, version: string) {
    const path = getPath(project, isPackage);
    let content = await fs.readFile(path, 'utf-8');
    content = content
        .replace(/(?<="langium": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-cli": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-railroad": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-sprotty": "[~\^]?)\d+\.\d+\.\d+/g, version);
    await fs.writeFile(path, content);
}

function getPath(project: string, isPackage: boolean) {
    return path.join(isPackage ? 'packages' : 'examples', project, 'package.json');
}

runUpdate();
