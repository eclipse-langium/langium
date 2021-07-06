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
    private path: string = 'dmodel';

    constructor(grammar: Grammar, dest: string) {
        if (!isDomainmodel(grammar)) {
            console.error('Please, apply this generator to Domainmodel file');
            process.exit(1);
        }
        this.domainmodel = grammar;

        if (dest === '') return;
        if (dest === '.' || dest === '..' || dest === '~') {
            this.path = `${dest}/${this.path}`;
        } else {
            this.path = dest;
        }
    }

    public generate(): void {
        this.generateAbstractElements(this.domainmodel.elements, this.path);
    }

    private generateAbstractElements(elements: (AbstractElement | Type)[], path: string): void {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
        const packagePath = path.replaceAll('\/', '.');

        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                this.generateAbstractElements(elem.elements, `${path}/${elem.name.replaceAll('\.', '/')}`);
            } else if (isEntity(elem)) {
                const fileNode = new CompositeGeneratorNode();
                fileNode.append(`package ${packagePath};`, NL, NL);
                this.generateEntity(elem, fileNode);
                fs.writeFileSync(`${path}/${elem.name}.java`, processGeneratorNode(fileNode));
            }
        }
    }

    private generateEntity(entity: Entity, fileNode: CompositeGeneratorNode): void {
        const maybeExtends = entity.superType ? ` extends ${entity.superType.$refName}` : '';
        fileNode.append(`class ${entity.name}${maybeExtends} {`, NL);    
        fileNode.indent(classBody => {
            const featureData = entity.features.map(f => new FeatureData(f));
            featureData.forEach(f => f.generateField(classBody));
            featureData.forEach(f => f.generateSetMethod(classBody));
            featureData.forEach(f => f.generateGetMethod(classBody));
        });
        fileNode.append(`}`, NL);
    }
}

class FeatureData {
    private name: string;
    private type: string = 'Object';
    
    constructor(feature: Feature) {
        this.name = feature.name;
        this.type = feature.type.$refName + (feature.many ? '[]' : '');
    }

    public generateField(classBody: IndentNode) {
        classBody.append(`private ${this.type} ${this.name};`, NL);
    }

    public generateSetMethod(classBody: IndentNode) {
        classBody.append(NL);
        classBody.append(`public void set${_.upperFirst(this.name)}(${this.type} ${this.name}) {`, NL);
        classBody.indent(methodBody => {
            methodBody.append(`this.${this.name} = ${this.name};`, NL);
        });
        classBody.append(`}`, NL);
    }

    public generateGetMethod(classBody: IndentNode) {
        classBody.append(NL);
        classBody.append(`public ${this.type} get${_.upperFirst(this.name)}() {`, NL);
        classBody.indent(methodBody => {
            methodBody.append(`return ${this.name};`, NL);
        });
        classBody.append(`}`, NL);
    }
}
