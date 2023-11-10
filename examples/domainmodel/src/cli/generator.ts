/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import { type Generated, expandToNode, joinToNode, toString } from 'langium/generate';
import { NodeFileSystem } from 'langium/node';
import _ from 'lodash';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDomainModelServices } from '../language-server/domain-model-module.js';
import type { AbstractElement, Domainmodel, Entity, Feature, Type } from '../language-server/generated/ast.js';
import { isEntity, isPackageDeclaration } from '../language-server/generated/ast.js';
import { DomainModelLanguageMetaData } from '../language-server/generated/module.js';
import { extractAstNode, extractDestinationAndName, setRootFolder } from './cli-util.js';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    try {
        const services = createDomainModelServices(NodeFileSystem).domainmodel;
        await setRootFolder(fileName, services, opts.root);
        const domainmodel = await extractAstNode<Domainmodel>(fileName, DomainModelLanguageMetaData.fileExtensions, services);
        const generatedDirPath = generateJava(domainmodel, fileName, opts.destination);
        if (!opts.quiet) {
            console.log(chalk.green(`Java classes generated successfully: ${chalk.yellow(generatedDirPath)}`));
        }
    } catch (error) {
        if (!opts.quiet) {
            console.error(chalk.red(String(error)));
        }
    }
};

export type GenerateOptions = {
    destination?: string;
    root?: string;
    quiet: boolean;
}

export function generateJava(domainmodel: Domainmodel, fileName: string, destination?: string): string {
    const data = extractDestinationAndName(fileName, destination);
    return generateAbstractElements(data.destination, domainmodel.elements, data.name);
}

function generateAbstractElements(destination: string, elements: Array<AbstractElement | Type>, filePath: string): string {

    function generateAbstractElementsInternal(elements: Array<AbstractElement | Type>, filePath: string): string {
        const fullPath = path.join(destination, filePath);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        const packagePath = filePath.replace(/\//g, '.').replace(/^\.+/, '');
        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                generateAbstractElementsInternal(elem.elements, path.join(filePath, elem.name.replace(/\./g, '/')));
            } else if (isEntity(elem)) {
                const fileNode = expandToNode`
                    package ${packagePath};

                    ${generateEntity(elem)}
                `;
                fs.writeFileSync(path.join(fullPath, `${elem.name}.java`), toString(fileNode));
            }
        }
        return fullPath;
    }

    return generateAbstractElementsInternal(elements, filePath);
}

function generateEntity(entity: Entity): Generated {
    const maybeExtends = entity.superType ? ` extends ${entity.superType.$refText}` : '';
    const featureData = entity.features.map(generateFeature);
    return expandToNode`
        class ${entity.name}${maybeExtends} {
            ${joinToNode(featureData, ([field]) => field, { appendNewLineIfNotEmpty: true})}
            ${joinToNode(featureData, ([, setterAndGetter]) => setterAndGetter, { appendNewLineIfNotEmpty: true} )}
        }
    `.appendNewLine();
}

function generateFeature(feature: Feature): [ string, Generated ] {
    const name = feature.name;
    const type = feature.type.$refText + (feature.many ? '[]' : '');

    return [
        `private ${type} ${name};`,
        expandToNode`

            public void set${_.upperFirst(name)}(${type} ${name}) {
                this.${name} = ${name};
            }

            public ${type} get${_.upperFirst(name)}() {
                return ${name};
            }
        `
    ];
}
