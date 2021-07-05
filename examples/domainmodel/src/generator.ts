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
        const scope = this.collectScope(this.domainmodel.elements);
        this.generateAbstractElements(this.domainmodel.elements, scope);
    }

    private collectScope(elements: (AbstractElement | Type)[], scope: Set<string> = new Set<string>(), path: string = ''): Set<string> {
        for (const elem of elements) {
            const fullQualifiedName = (path ? `${path}.` : ``) + elem.name;
            if (isPackageDeclaration(elem)) {
                this.collectScope(elem.elements, scope, fullQualifiedName);
            } else if (isEntity(elem) || isDataType(elem)) {
                scope.add(fullQualifiedName);
            }
        }
        return scope;
    }

    private updateScope(path: string, scope: Set<string>): Set<string> {
        const updScope = new Set<string>(scope);
        for (const elem of scope) {
            if (elem.startsWith(path)) {
                updScope.add(elem.substr(path.length + 1));
            }
        }
        return updScope;
    }

    private generateAbstractElements(elements: (AbstractElement | Type)[], scope: Set<string>, path: string = ''): void {
        const fullPath = `${this.dest}/${path.replace('.', '/')}`;
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                const fullQualifiedName = `${path ? `${path}.` : ``}${elem.name}`;
                this.generateAbstractElements(elem.elements, this.updateScope(fullQualifiedName, scope), fullQualifiedName);
            } else if (isEntity(elem)) {
                const fileNode = new CompositeGeneratorNode();
                fileNode.append(`package ${this.basePackage}${path ? `.${path}` : ''};`, NL, NL);
                this.generateEntity(elem, fileNode, scope);
                fs.writeFileSync(`${fullPath}/${elem.name}.java`, processGeneratorNode(fileNode));
            }
        }
    }

    private generateEntity(entity: Entity, fileNode: CompositeGeneratorNode, scope: Set<string>): void {
        fileNode.append(`class ${entity.name} `);
        if (entity.superType && scope.has(entity.superType.$refName)) {
            fileNode.append(`extends ${entity.superType.$refName} `)
        }
        fileNode.append(`{`, NL);
    
        fileNode.indent(classBody => {
            const featureData = entity.features.map(f => new FeatureData(f, scope));
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
    
    constructor(feature: Feature, scope: Set<string>) {
        this.name = feature.name;
        if (scope.has(feature.type.$refName)) {
            this.type = feature.type.$refName + (feature.many ? '[]' : '');
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
