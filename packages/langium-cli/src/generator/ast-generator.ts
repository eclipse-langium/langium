/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GeneratorNode, Grammar, IndentNode, CompositeGeneratorNode, NL, processGeneratorNode, stream, isAlternatives, isKeyword, isParserRule, isDataTypeRule, ParserRule, streamAllContents, isCrossReference, LangiumServices } from 'langium';
import { LangiumConfig } from '../package';
import { collectAst, Interface } from './type-collector';
import { generatedHeader } from './util';

export function generateAst(services: LangiumServices, grammars: Grammar[], config: LangiumConfig): string {
    const types = collectAst(services.shared.workspace.LangiumDocuments, grammars);
    const fileNode = new CompositeGeneratorNode();
    fileNode.append(
        generatedHeader,
        '/* eslint-disable @typescript-eslint/array-type */', NL,
        '/* eslint-disable @typescript-eslint/no-empty-interface */', NL,
    );
    const crossRef = grammars.some(grammar => hasCrossReferences(grammar));
    if (config.langiumInternal) {
        fileNode.append(
            `import { AstNode, AstReflection${crossRef ? ', Reference' : ''} } from '../../syntax-tree';`, NL,
            "import { isAstNode } from '../../utils/ast-util';", NL, NL
        );
    } else {
        fileNode.append(`import { AstNode, AstReflection${crossRef ? ', Reference' : ''}, isAstNode } from 'langium';`, NL, NL);
    }

    for (const type of types) {
        fileNode.append(type.toString(), NL);
    }
    for (const primitiveRule of stream(grammars.flatMap(e => e.rules)).distinct().filter(isParserRule).filter(e => isDataTypeRule(e))) {
        fileNode.append(buildDatatype(primitiveRule), NL, NL);
    }

    fileNode.append(generateAstReflection(config, types));

    return processGeneratorNode(fileNode);
}

function buildDatatype(rule: ParserRule): GeneratorNode {
    if (isAlternatives(rule.alternatives) && rule.alternatives.elements.every(e => isKeyword(e))) {
        return `export type ${rule.name} = ${stream(rule.alternatives.elements).filter(isKeyword).map(e => `'${e.value}'`).join(' | ')}`;
    } else {
        return `export type ${rule.name} = ${rule.type ?? 'string'}`;
    }
}

function hasCrossReferences(grammar: Grammar): boolean {
    let result = false;
    streamAllContents(grammar).forEach(e => {
        if (isCrossReference(e.node)) {
            result = true;
        }
    });
    return result;
}

type CrossReferenceType = {
    type: string,
    feature: string,
    referenceType: string
}

function generateAstReflection(config: LangiumConfig, interfaces: Interface[]): GeneratorNode {
    const reflectionNode = new CompositeGeneratorNode();
    const crossReferenceTypes = buildCrossReferenceTypes(interfaces);

    reflectionNode.append(
        'export type ', config.projectName, 'AstType = ',
        interfaces.map(t => `'${t.name}'`).join(' | '),
        ';', NL, NL,
        'export type ', config.projectName, 'AstReference = ',
        crossReferenceTypes.map(e => `'${e.type}:${e.feature}'`).join(' | ') || 'never',
        ';', NL, NL,
        'export class ', config.projectName, 'AstReflection implements AstReflection {', NL, NL
    );

    reflectionNode.indent(classBody => {
        classBody.append('getAllTypes(): string[] {', NL);
        classBody.indent(allTypes => {
            allTypes.append('return [', interfaces.map(t => `'${t.name}'`).join(', '), '];', NL);
        });
        classBody.append('}', NL, NL, 'isInstance(node: unknown, type: string): boolean {', NL);
        classBody.indent(isInstance => {
            isInstance.append('return isAstNode(node) && this.isSubtype(node.$type, type);', NL);
        });
        classBody.append(
            '}', NL, NL,
            'isSubtype(subtype: string, supertype: string): boolean {', NL,
            buildIsSubtypeMethod(interfaces), '}', NL, NL,
            'getReferenceType(referenceId: ', config.projectName, 'AstReference): string {', NL,
            buildReferenceTypeMethod(interfaces), '}', NL,
        );
    });

    reflectionNode.append(
        '}', NL, NL,
        'export const reflection = new ', config.projectName, 'AstReflection();', NL
    );

    return reflectionNode;
}

function buildReferenceTypeMethod(interfaces: Interface[]): GeneratorNode {
    const crossReferenceTypes = buildCrossReferenceTypes(interfaces);
    const typeSwitchNode = new IndentNode();
    typeSwitchNode.append('switch (referenceId) {', NL);
    typeSwitchNode.indent(caseNode => {
        for (const crossRef of crossReferenceTypes) {
            caseNode.append(`case '${crossRef.type}:${crossRef.feature}': {`, NL);
            caseNode.indent(caseContent => {
                caseContent.append(`return ${crossRef.referenceType};`, NL);
            });
            caseNode.append('}', NL);
        }
        caseNode.append('default: {', NL);
        caseNode.indent(defaultNode => {
            defaultNode.append('throw new Error(`${referenceId} is not a valid reference id.`);', NL);
        });
        caseNode.append('}', NL);
    });
    typeSwitchNode.append('}', NL);
    return typeSwitchNode;
}

function buildCrossReferenceTypes(interfaces: Interface[]): CrossReferenceType[] {
    const crossReferences: CrossReferenceType[] = [];
    for (const type of interfaces) {
        for (const field of type.fields.filter(e => e.reference)) {
            crossReferences.push({ type: type.name, feature: field.name, referenceType: field.types[0] });
        }
    }
    return crossReferences;
}

function buildIsSubtypeMethod(interfaces: Interface[]): GeneratorNode {
    const methodNode = new IndentNode();
    methodNode.append('if (subtype === supertype) {', NL);
    methodNode.indent(ifNode => {
        ifNode.append('return true;', NL);
    });
    methodNode.append(
        '}', NL,
        'switch (subtype) {', NL
    );
    methodNode.indent(switchNode => {
        const groups = groupBySupertypes(interfaces.filter(e => e.superTypes.length > 0));

        for (const [superTypes, typeGroup] of groups.entries()) {
            for (const typeItem of typeGroup) {
                switchNode.append(`case ${typeItem.name}:`, NL);
            }
            switchNode.contents.pop();
            switchNode.append(' {', NL);
            switchNode.indent(caseNode => {
                caseNode.append('return ', superTypes.split(':').map(e => `this.isSubtype(${e}, supertype)`).join(' || '), ';');
            });
            switchNode.append(NL, '}', NL);
        }

        switchNode.append('default: {', NL);
        switchNode.indent(defaultNode => {
            defaultNode.append('return false;', NL);
        });
        switchNode.append('}', NL);
    });
    methodNode.append('}', NL);
    return methodNode;
}

function groupBySupertypes(interfaces: Interface[]): Map<string, Interface[]> {
    const map = new Map<string, Interface[]>();
    for (const item of interfaces) {
        const key = item.superTypes.join(':');
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    }
    return map;
}
