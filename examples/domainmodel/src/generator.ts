/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs';
import _ from 'lodash';
import { CompositeGeneratorNode, Grammar, IndentNode, NL, processGeneratorNode } from 'langium';
import { AbstractElement, Domainmodel, Entity, Feature, isDomainmodel, isEntity, isPackageDeclaration, Type } from './language-server/generated/ast';

export class DomainModelGenerator {
    private domainmodel: Domainmodel;
    private destination: string;
    private path: string;

    constructor(grammar: Grammar, fileName: string, destination = '.') {
        if (!isDomainmodel(grammar)) {
            console.error('Please, apply this generator to Domainmodel file');
            process.exit(1);
        }
        this.domainmodel = grammar;
        this.destination = destination;
        this.path = fileName.replace(/\..*$/, '').replaceAll(/[.-]/g, '');
    }

    public generate(): void {
        this.generateAbstractElements(this.domainmodel.elements, this.path);
    }

    private generateAbstractElements(elements: Array<AbstractElement | Type>, path: string): void {
        const fullPath = `${this.destination}/${path}`;
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        const packagePath = path.replaceAll('/', '.').replace(/^\.+/, '');
        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                this.generateAbstractElements(elem.elements, `${path}/${elem.name.replaceAll('.', '/')}`);
            } else if (isEntity(elem)) {
                const fileNode = new CompositeGeneratorNode();
                fileNode.append(`package ${packagePath};`, NL, NL);
                this.generateEntity(elem, fileNode);
                fs.writeFileSync(`${fullPath}/${elem.name}.java`, processGeneratorNode(fileNode));
            }
        }
    }

    private generateEntity(entity: Entity, fileNode: CompositeGeneratorNode): void {
        const maybeExtends = entity.superType ? ` extends ${entity.superType.$refName}` : '';
        fileNode.append(`class ${entity.name}${maybeExtends} {`, NL);
        fileNode.indent(classBody => {
            const featureData = entity.features.map(f => this.generateFeature(f, classBody));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            featureData.forEach(([generateField, _1, _2]) => generateField());
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            featureData.forEach(([_0, generateSetter, generateGetter]) => { generateSetter(); generateGetter(); } );
        });
        fileNode.append('}', NL);
    }

    private generateFeature(feature: Feature, classBody: IndentNode): [() => void, () => void, () => void] {
        const name = feature.name;
        const type = feature.type.$refName + (feature.many ? '[]' : '');

        return [
            () => { // generate the field
                classBody.append(`private ${type} ${name};`, NL);
            },
            () => { // generate the setter
                classBody.append(NL);
                classBody.append(`public void set${_.upperFirst(name)}(${type} ${name}) {`, NL);
                classBody.indent(methodBody => {
                    methodBody.append(`this.${name} = ${name};`, NL);
                });
                classBody.append('}', NL);
            },
            () => { // generate the getter
                classBody.append(NL);
                classBody.append(`public ${type} get${_.upperFirst(name)}() {`, NL);
                classBody.indent(methodBody => {
                    methodBody.append(`return ${name};`, NL);
                });
                classBody.append('}', NL);
            }
        ];
    }
}
