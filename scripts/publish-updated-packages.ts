import fs from 'fs';
import path from 'path';
import { compare } from 'semver';
import { exec, execSync } from 'child_process';

const isDry = process.argv.includes('--dry');

if (isDry) {
    console.log('Running in dry mode. No packages will be published.');
}

const ignore = [
    'packages/langium-vscode',
    'examples/requirements'
];

async function updateAndPublish() {
    const ownPackage = await readPackageJson();
    const workspaces: string[] = ownPackage.workspaces || [];
    const packagesToPublish: string[] = [];
    for (const workspace of workspaces) {
        if (ignore.includes(workspace)) {
            continue;
        }
        try {
            if (await isUpToDate(workspace)) {
                console.log(`Package at ${workspace} is up to date. Skipping publish.`);
                continue;
            }
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Package at ${workspace} has updates. Adding to publish list.`);
        packagesToPublish.push(workspace);
    }
    for (const pkg of packagesToPublish) {
        await publishPackage(pkg);
    }
    const ext = await tryPublishExtension();
    if (!ext && packagesToPublish.length === 0) {
        console.log('All packages are up to date. Nothing to publish.');
        if (process.env.RUN_ID) {
            console.log(`Marking GitHub Action run ${process.env.RUN_ID} as cancelled.`);
            execSync(`gh run cancel ${process.env.RUN_ID}`);
        }
    }
}

async function publishPackage(packagePath: string) {
    return new Promise<void>((resolve, reject) => {
        if (isDry) {
            console.log(`[Dry Run] Would publish package at ${packagePath}`);
            resolve();
            return;
        }
        exec('npm publish --provenance --access public', { cwd: packagePath }, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || new Error(stderr));
                return;
            }
            console.log(`Successfully published package at ${packagePath}:`, stdout);
            resolve();
        });
    });
}

async function isUpToDate(packagePath: string): Promise<boolean> {
    const { name, version } = await readPackageJson(packagePath);
    return new Promise((resolve, reject) => {
        exec(`npm view ${name} version`, { cwd: packagePath }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            } else if (stderr.includes('code E404')) {
                reject(new Error(`Package ${name} not found on npm registry.`));
                return;
            }
            const publishedVersion = stdout.trim();
            resolve(compare(version, publishedVersion) !== 1);
        });
    });
}

async function readPackageJson(packagePath?: string) {
    const filePath = path.join(packagePath || '.', 'package.json');
    const packageJson = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(packageJson);
}

async function tryPublishExtension(): Promise<boolean> {
    const packagePath = path.join('packages', 'langium-vscode');
    const { name, publisher, version } = await readPackageJson(packagePath);
    const fullName = `${publisher}.${name}`;
    try {
        const vsceVersion = await getVsceVersion(fullName);
        const ovsxVersion = await getOvsxVersion(fullName);
        const shouldPublishVsce = compare(version, vsceVersion) === 1;
        const shouldPublishOvsx = compare(version, ovsxVersion) === 1;
        const fileName = `langium-vscode-${version}.vsix`;
        if (shouldPublishVsce || shouldPublishOvsx) {
            console.log(`Extension ${fullName} has updates. Generating vsix...`);
            execSync(`npx vsce package -o ${fileName}`, { cwd: packagePath });
        }
        if (shouldPublishVsce) {
            console.log(`Publishing VSCE extension ${fullName}...`);
            await publishVsce(packagePath, fileName);
        } else {
            console.log(`VSCE extension ${fullName} is up to date. Skipping publish.`);
        }
        if (shouldPublishOvsx) {
            console.log(`Publishing OVSX extension ${fullName}...`);
            await publishOvsx(packagePath, fileName);
        } else {
            console.log(`OVSX extension ${fullName} is up to date. Skipping publish.`);
        }
        return shouldPublishVsce || shouldPublishOvsx;
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

async function getVsceVersion(id: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`npx vsce show ${id} --json`, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || new Error(stderr));
                return;
            }
            const info = JSON.parse(stdout);
            resolve(info.versions[0].version);
        });
    });
}

async function publishVsce(packagePath: string, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isDry) {
            console.log(`[Dry Run] Would publish VSCE extension at ${packagePath}`);
            resolve();
            return;
        }
        exec(`npx vsce publish ${fileName} -p ${process.env.VSCE_TOKEN}`, { cwd: packagePath }, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || new Error(stderr));
                return;
            }
            console.log(`Successfully published VSCE extension at ${packagePath}:`, stdout);
            resolve();
        });
    });
}

async function getOvsxVersion(id: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`npx ovsx get ${id} --metadata`, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || new Error(stderr));
                return;
            }
            const info = JSON.parse(stdout);
            resolve(info.version);
        });
    });
}

async function publishOvsx(packagePath: string, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isDry) {
            console.log(`[Dry Run] Would publish OVSX extension at ${packagePath}`);
            resolve();
            return;
        }
        exec(`npx ovsx publish ${fileName} -p ${process.env.OVSX_TOKEN}`, { cwd: packagePath }, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || new Error(stderr));
                return;
            }
            console.log(`Successfully published OVSX extension at ${packagePath}:`, stdout);
            resolve();
        });
    });
}

updateAndPublish();
