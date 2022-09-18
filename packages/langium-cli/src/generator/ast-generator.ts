/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    GeneratorNode, Grammar, IndentNode, CompositeGeneratorNode, NL, processGeneratorNode, streamAllContents, isCrossReference, MultiMap, LangiumServices, collectAst, AstTypes, Property, collectAllProperties
} from 'langium';
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
            `import type { AstNode, AstReflection${crossRef ? ', Reference' : ''}, TypeMetaData } from '../../syntax-tree';`, NL,
            "import { isAstNode } from '../../utils/ast-util';", NL, NL
        );
    } else {
        fileNode.append(`import { AstNode, AstReflection${crossRef ? ', Reference' : ''}, isAstNode, TypeMetaData } from 'langium';`, NL, NL);
    }

    for (const type of astTypes.unions) {
        fileNode.append(type.toString(), NL);
    }
    for (const interfaceType of astTypes.interfaces) {
        fileNode.append(interfaceType.toString(), NL);
    }

    astTypes.unions = astTypes.unions.filter(e => e.reflection);
    fileNode.append(generateAstReflection(config, astTypes));

    return processGeneratorNode(fileNode);
}

function hasCrossReferences(grammar: Grammar): boolean {
    return !!streamAllContents(grammar).find(isCrossReference);
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): GeneratorNode {
    const typeNames: string[] = astTypes.interfaces.map(t => `'${t.name}'`)
        .concat(astTypes.unions.map(t => `'${t.name}'`))
        .sort();
    const reflectionNode = new CompositeGeneratorNode();

    reflectionNode.append(
        `export type ${config.projectName}AstType = ${typeNames.join(' | ')};`, NL, NL,
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
            'getTypeMetaData(type: string): TypeMetaData {', NL,
            buildTypeMetaDataMethod(astTypes), '}', NL
        );
    });

    reflectionNode.append(
        '}', NL, NL,
        `export const reflection = new ${config.projectName}AstReflection();`, NL
    );

    return reflectionNode;
}

function buildTypeMetaDataMethod(astTypes: AstTypes): GeneratorNode {
    const typeSwitchNode = new IndentNode();
    typeSwitchNode.append('switch (type) {', NL);
    typeSwitchNode.indent(caseNode => {
        const allProperties = collectAllProperties(astTypes.interfaces);
        for (const interfaceType of astTypes.interfaces) {
            const props = allProperties.get(interfaceType.name)!;
            const arrayProps = props.filter(e => e.typeAlternatives.some(e => e.array));
            const booleanProps = props.filter(e => e.typeAlternatives.every(e => !e.array && e.types.includes('boolean')));
            if (arrayProps.length > 0 || booleanProps.length > 0) {
                caseNode.append(`case '${interfaceType.name}': {`, NL);
                caseNode.indent(caseContent => {
                    caseContent.append('return {', NL);
                    caseContent.indent(returnType => {
                        returnType.append(`name: '${interfaceType.name}',`, NL);
                        returnType.append(
                            'mandatory: [', NL,
                            buildMandatoryType(arrayProps, booleanProps),
                            ']', NL);
                    });
                    caseContent.append('};', NL);
                });
                caseNode.append('}', NL);
            }
        }
        caseNode.append('default: {', NL);
        caseNode.indent(defaultNode => {
            defaultNode.append('return {', NL);
            defaultNode.indent(defaultType => {
                defaultType.append(
                    'name: type,', NL,
                    'mandatory: []', NL
                );
            });
            defaultNode.append('};', NL);
        });
        caseNode.append('}', NL);
    });
    typeSwitchNode.append('}', NL);
    return typeSwitchNode;
}

function buildMandatoryType(arrayProps: Property[], booleanProps: Property[]): GeneratorNode {
    const indent = new IndentNode();
    const all = arrayProps.concat(booleanProps).sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < all.length; i++) {
        const property = all[i];
        const type = arrayProps.includes(property) ? 'array' : 'boolean';
        indent.append("{ name: '", property.name, "', type: '", type, "' }", i < all.length - 1 ? ',' : '', NL);
    }
    return indent;
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

        for (const [superTypes, typeGroup] of groups.entriesGroupedByKey()) {
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
    superTypes: Set<string>
}

function groupBySupertypes(astTypes: AstTypes): MultiMap<string, string> {
    const allTypes: ChildToSuper[] = (astTypes.interfaces as ChildToSuper[])
        .concat(astTypes.unions)
        .filter(e => e.superTypes.size > 0);

    const superToChild = new MultiMap<string, string>();
    for (const item of allTypes) {
        superToChild.add([...item.superTypes].join(':'), item.name);
    }

    return superToChild;
}
