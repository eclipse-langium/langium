/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import _ from 'lodash';
import { CompositeGeneratorNode, IndentNode, NL, processGeneratorNode } from 'langium';
import { AbstractElement, Domainmodel, Entity, Feature, isEntity, isPackageDeclaration, Type } from '../language-server/generated/ast';

export function generateJava(domainmodel: Domainmodel, fileName: string, destination = '.'): string {
    const path = fileName.replace(/\..*$/, '').replace(/[.-]/g, '');

    generateAbstractElements(destination, domainmodel.elements, path);
    return `${destination}/${path}`;
}

function generateAbstractElements(destination: string, elements: Array<AbstractElement | Type>, path: string): void {

    function generateAbstractElementsInternal(elements: Array<AbstractElement | Type>, path: string) {
        const fullPath = `${destination}/${path}`;
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        const packagePath = path.replace(/\//g, '.').replace(/^\.+/, '');
        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                generateAbstractElementsInternal(elem.elements, `${path}/${elem.name.replace(/\./g, '/')}`);
            } else if (isEntity(elem)) {
                const fileNode = new CompositeGeneratorNode();
                fileNode.append(`package ${packagePath};`, NL, NL);
                generateEntity(elem, fileNode);
                fs.writeFileSync(`${fullPath}/${elem.name}.java`, processGeneratorNode(fileNode));
            }
        }
    }

    generateAbstractElementsInternal(elements, path);
}

function generateEntity(entity: Entity, fileNode: CompositeGeneratorNode): void {
    const maybeExtends = entity.superType ? ` extends ${entity.superType.$refName}` : '';
    fileNode.append(`class ${entity.name}${maybeExtends} {`, NL);
    fileNode.indent(classBody => {
        const featureData = entity.features.map(f => generateFeature(f, classBody));
        featureData.forEach(([generateField, , ]) => generateField());
        featureData.forEach(([, generateSetter, generateGetter]) => { generateSetter(); generateGetter(); } );
    });
    fileNode.append('}', NL);
}

function generateFeature(feature: Feature, classBody: IndentNode): [() => void, () => void, () => void] {
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
