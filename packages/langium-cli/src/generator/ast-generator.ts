/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    GeneratorNode, Grammar, IndentNode, CompositeGeneratorNode, NL, processGeneratorNode, streamAllContents, isCrossReference, MultiMap, LangiumServices, collectAst
} from 'langium';
import { AstTypes } from 'langium/src/typification/types-util';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateAst(services: LangiumServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(services.shared.workspace.LangiumDocuments, grammars);
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

    for (const type of astTypes.types) {
        fileNode.append(type.toString(), NL);
    }
    for (const interfaceType of astTypes.interfaces) {
        fileNode.append(interfaceType.toString(), NL);
    }

    astTypes.types =  astTypes.types.filter(e => e.reflection);
    fileNode.append(generateAstReflection(config, astTypes));

    return processGeneratorNode(fileNode);
}

function hasCrossReferences(grammar: Grammar): boolean {
    return !!streamAllContents(grammar).find(isCrossReference);
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): GeneratorNode {
    const typeNames: string[] = astTypes.interfaces.map(t => `'${t.name}'`)
        .concat(astTypes.types.map(t => `'${t.name}'`))
        .sort();
    const crossReferenceTypes = buildCrossReferenceTypes(astTypes);
    const reflectionNode = new CompositeGeneratorNode();

    reflectionNode.append(
        `export type ${config.projectName}AstType = ${typeNames.join(' | ')};`, NL, NL,
        `export type ${config.projectName}AstReference = `,
        crossReferenceTypes.map(e => `'${e.type}:${e.feature}'`).join(' | ') || 'never', ';', NL, NL,
        `export class ${config.projectName}AstReflection implements AstReflection {`, NL, NL
    );

    reflectionNode.indent(classBody => {
        classBody.append('getAllTypes(): string[] {', NL);
        classBody.indent(allTypes => {
            allTypes.append(`return [${typeNames.join(', ')}];`, NL);
        });
        classBody.append('}', NL, NL, 'isInstance(node: unknown, type: string): boolean {', NL);
        classBody.indent(isInstance => {
            isInstance.append('return isAstNode(node) && this.isSubtype(node.$type, type);', NL);
        });
        classBody.append(
            '}', NL, NL,
            'isSubtype(subtype: string, supertype: string): boolean {', NL,
            buildIsSubtypeMethod(astTypes), '}', NL, NL,
            `getReferenceType(referenceId: ${config.projectName}AstReference): string {`, NL,
            buildReferenceTypeMethod(crossReferenceTypes), '}', NL,
        );
    });

    reflectionNode.append(
        '}', NL, NL,
        `export const reflection = new ${config.projectName}AstReflection();`, NL
    );

    return reflectionNode;
}

function buildReferenceTypeMethod(crossReferenceTypes: CrossReferenceType[]): GeneratorNode {
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

type CrossReferenceType = {
    type: string,
    feature: string,
    referenceType: string
}

function buildCrossReferenceTypes(astTypes: AstTypes): CrossReferenceType[] {
    const crossReferences: CrossReferenceType[] = [];
    for (const typeInterface of astTypes.interfaces) {
        for (const field of typeInterface.fields.sort((a, b) => a.name.localeCompare(b.name))) {
            field.typeAlternatives.filter(e => e.reference).flatMap(e => e.types).forEach(type =>
                crossReferences.push({
                    type: typeInterface.name,
                    feature: field.name,
                    referenceType: type
                })
            );
        }
    }
    return crossReferences.sort((a, b) => a.type.localeCompare(b.type));
}

function buildIsSubtypeMethod(astTypes: AstTypes): GeneratorNode {
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
        const groups = groupBySupertypes(astTypes);

        for (const superTypes of groups.keys()) {
            const typeGroup = groups.get(superTypes);
            for (const typeName of typeGroup) {
                switchNode.append(`case ${typeName}:`, NL);
            }
            switchNode.contents.pop();
            switchNode.append(' {', NL);
            switchNode.indent(caseNode => {
                caseNode.append(`return ${superTypes.split(':').map(e => `this.isSubtype(${e}, supertype)`).join(' || ')};`);
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

type ChildToSuper = {
    name: string,
    superTypes: string[]
}

function groupBySupertypes(astTypes: AstTypes): MultiMap<string, string> {
    const allTypes: ChildToSuper[] = (astTypes.interfaces as ChildToSuper[])
        .concat(astTypes.types)
        .filter(e => e.superTypes.length > 0);

    const superToChild = new MultiMap<string, string>();
    for (const item of allTypes) {
        superToChild.add(item.superTypes.join(':'), item.name);
    }

    return superToChild;
}
