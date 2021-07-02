/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs';
import _ from 'lodash';
import { CompositeGeneratorNode, Grammar, IndentNode, NL, processGeneratorNode } from 'langium';
import { AbstractElement, Domainmodel, Entity, Feature, isDataType, isDomainmodel, isEntity, isPackageDeclaration, Type } from './language-server/generated/ast';

export class DomainModelGenerator {
    private domainmodel: Domainmodel;
    private dest: string;
    private basePackage: string = 'base';

    constructor(grammar: Grammar, dest: string) {
        if (!isDomainmodel(grammar)) {
            console.error('Please, apply this generator to Domainmodel file');
            process.exit(1);
        }
        this.domainmodel = grammar;
        this.dest = dest;
    }

    public generate(): void {
        const context = this.collectContext(this.domainmodel.elements);
        this.generateAbstractElements(this.domainmodel.elements, context);
    }

    private collectContext(elements: (AbstractElement | Type)[], context: Set<string> = new Set<string>(), path: string = ''): Set<string> {
        for (const elem of elements) {
            const fullQualifiedName = (path ? `${path}.` : ``) + elem.name;
            if (isPackageDeclaration(elem)) {
                this.collectContext(elem.elements, context, fullQualifiedName);
            } else if (isEntity(elem) || isDataType(elem)) {
                context.add(fullQualifiedName);
            }
        }
        return context;
    }

    private updateContext(path: string, context: Set<string>): Set<string> {
        let updContext = new Set<string>(context);
        for (const elem of context) {
            if (elem.startsWith(path)) {
                updContext.add(elem.substr(path.length + 1));
            }
        }
        return updContext;
    }

    private generateAbstractElements(elements: (AbstractElement | Type)[], context: Set<string>, path: string = ''): void {
        const fullPath = `${this.dest}/${path.replace('.', '/')}`;
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                const fullQualifiedName = `${path ? `${path}.` : ``}${elem.name}`;
                this.generateAbstractElements(elem.elements, this.updateContext(fullQualifiedName, context), fullQualifiedName);
            } else if (isEntity(elem)) {
                const fileNode = new CompositeGeneratorNode();
                fileNode.append(`package ${this.basePackage}${path ? `.${path}` : ''};`, NL, NL);
                this.generateEntity(elem, fileNode, context);
                fs.writeFileSync(`${fullPath}/${elem.name}.java`, processGeneratorNode(fileNode));
            }
        }
    }

    private generateEntity(entity: Entity, fileNode: CompositeGeneratorNode, context: Set<string>): void {
        fileNode.append(`class ${entity.name} `);
        if (entity.superType && context.has(entity.superType.$refName)) {
            fileNode.append(`extends ${entity.superType.$refName} `)
        }
        fileNode.append(`{`, NL);
    
        fileNode.indent(classBody => {
            const featureData = entity.features.map(f => new FeatureData(f, context));
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
    
    constructor(feature: Feature, context: Set<string>) {
        this.name = feature.name;
        if (context.has(feature.type.$refName)) {
            this.type = feature.type.$refName + (feature.many ? '[]' : '');
        } else {
            console.log(Array.from(context).toString());
            console.log(feature.name, '   ', feature.type.$refName);
            process.exit(1);
        }
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
