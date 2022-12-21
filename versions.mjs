// eslint-disable-next-line header/header
import shell from 'shelljs';

const version = '1.0.0-dev.0';
const versionPattern = '.*[0-9]\\.[0-9]\\.[0-9].*';

function updateLangium() {
    shell.exec(`npm version --workspace packages/langium ${version}`);
    shell.sed('-i', `"langium-cli": "${versionPattern}"`, `"langium-cli": "${version}"`, 'packages/langium/package.json');
}

function updateLangiumCli() {
    shell.exec(`npm version --workspace packages/langium-cli ${version}`);
    shell.sed('-i', `"langium": "${versionPattern}"`, `"langium": "${version}"`, 'packages/langium-cli/package.json');
}

function updateLangiumSprotty() {
    shell.exec(`npm version --workspace packages/langium-sprotty ${version}`);
    shell.sed('-i', `"langium": "${versionPattern}"`, `"langium": "${version}"`, 'packages/langium-sprotty/package.json');
}

function updateLangiumVscode() {
    shell.exec(`npm version --workspace packages/langium-vscode ${version}`);
    shell.sed('-i', `"langium": "${versionPattern}"`, `"langium": "${version}"`, 'packages/langium-vscode/package.json');
}

function updateGenerateLangium() {
    shell.exec(`npm version --workspace packages/generate-langium ${version}`);
}

function updateExamples(name) {
    shell.exec(`npm version --workspace examples/${name} ${version}`);
    shell.sed('-i', `"langium": "${versionPattern}"`, `"langium": "${version}"`, `examples/${name}/package.json`);
    shell.sed('-i', `"langium-cli": "${versionPattern}"`, `"langium-cli": "${version}"`, `examples/${name}/package.json`);
    // should work, but does not
    //shell.exec(`npm install --workspace examples/${name} langium@${version} --save-exact`);
    //shell.exec(`npm install --workspace examples/${name} langium-cli@${version} --save-exact --save-dev`);
}

updateLangium();
updateLangiumCli();
updateLangiumSprotty();
updateLangiumVscode();
updateGenerateLangium();

updateExamples('arithmetics');
updateExamples('domainmodel');
updateExamples('requirements');
updateExamples('statemachine');

// ensures all sed manipulations are taken into account
shell.exec('npm install');
