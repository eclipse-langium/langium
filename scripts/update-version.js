const fs = require('fs-extra');
const path = require('path');

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
        replaceAll('generator-langium/templates/core', true, version, true),
        replaceAll('arithmetics', false, version),
        replaceAll('domainmodel', false, version),
        replaceAll('requirements', false, version),
        replaceAll('statemachine', false, version),
    ]);
}

async function replaceAll(project, package, version, dot) {
    const path = getPath(project, package, dot);
    let content = await fs.readFile(path, 'utf-8');
    content = content
        .replace(/(?<="langium": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-cli": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-railroad": "[~\^]?)\d+\.\d+\.\d+/g, version)
        .replace(/(?<="langium-sprotty": "[~\^]?)\d+\.\d+\.\d+/g, version);
    await fs.writeFile(path, content);
}

function getPath(project, package, dot) {
    return path.join(package ? 'packages' : 'examples', project, (dot ? '.' : '') + 'package.json');
}

runUpdate();
