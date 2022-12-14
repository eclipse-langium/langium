/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    GeneratorNode, Grammar, IndentNode, CompositeGeneratorNode, NL, toString, streamAllContents, MultiMap, LangiumServices, GrammarAST
} from 'langium';
import { AstTypes, collectAllProperties, collectAst, Property } from 'langium/lib/grammar/type-system';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateAst(services: LangiumServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const fileNode = new CompositeGeneratorNode();
    fileNode.append(
        generatedHeader,
        '/* eslint-disable */', NL,
    );
    const crossRef = grammars.some(grammar => hasCrossReferences(grammar));
    const importFrom = config.langiumInternal ? '../../syntax-tree' : 'langium';
    fileNode.append(
        `import { AstNode, AbstractAstReflection${crossRef ? ', Reference' : ''}, ReferenceInfo, TypeMetaData } from '${importFrom}';`, NL, NL
    );

    astTypes.unions.forEach(union => fileNode.append(union.toAstTypesString(), NL));
    astTypes.interfaces.forEach(iFace => fileNode.append(iFace.toAstTypesString(), NL));

    astTypes.unions = astTypes.unions.filter(e => e.reflection);
    fileNode.append(generateAstReflection(config, astTypes));

    return toString(fileNode);
}

function hasCrossReferences(grammar: Grammar): boolean {
    return Boolean(streamAllContents(grammar).find(GrammarAST.isCrossReference));
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): GeneratorNode {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const crossReferenceTypes = buildCrossReferenceTypes(astTypes);
    const reflectionNode = new CompositeGeneratorNode();

    reflectionNode.append(`export interface ${config.projectName}AstType {`, NL);
    reflectionNode.indent(astTypeBody => {
        for (const type of typeNames) {
            astTypeBody.append(type, ': ', type, NL);
        }
    });
    reflectionNode.append('}', NL, NL);

    reflectionNode.append(
        `export class ${config.projectName}AstReflection extends AbstractAstReflection {`, NL, NL
    );

    reflectionNode.indent(classBody => {
        classBody.append('getAllTypes(): string[] {', NL);
        classBody.indent(allTypes => {
            allTypes.append(`return [${typeNames.map(e => `'${e}'`).join(', ')}];`, NL);
        });
        classBody.append(
            '}', NL, NL,
            'protected override computeIsSubtype(subtype: string, supertype: string): boolean {', NL,
            buildIsSubtypeMethod(astTypes), '}', NL, NL,
            'getReferenceType(refInfo: ReferenceInfo): string {', NL,
            buildReferenceTypeMethod(crossReferenceTypes), '}', NL, NL,
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

function buildReferenceTypeMethod(crossReferenceTypes: CrossReferenceType[]): GeneratorNode {
    const typeSwitchNode = new IndentNode();
    const buckets = new MultiMap<string, string>(crossReferenceTypes.map(e => [e.referenceType, `${e.type}:${e.feature}`]));
    typeSwitchNode.append('const referenceId = `${refInfo.container.$type}:${refInfo.property}`;', NL);
    typeSwitchNode.append('switch (referenceId) {', NL);
    typeSwitchNode.indent(caseNode => {
        for (const [target, refs] of buckets.entriesGroupedByKey()) {
            for (let i = 0; i < refs.length; i++) {
                const ref = refs[i];
                caseNode.append(`case '${ref}':`);
                if (i === refs.length - 1) {
                    caseNode.append(' {', NL);
                } else {
                    caseNode.append(NL);
                }
            }
            caseNode.indent(caseContent => {
                caseContent.append(`return ${target};`, NL);
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
    const crossReferences = new MultiMap<string, CrossReferenceType>();
    for (const typeInterface of astTypes.interfaces) {
        for (const property of typeInterface.properties.sort((a, b) => a.name.localeCompare(b.name))) {
            property.typeAlternatives.filter(e => e.reference).flatMap(e => e.types).forEach(type =>
                crossReferences.add(typeInterface.name, {
                    type: typeInterface.name,
                    feature: property.name,
                    referenceType: type
                })
            );
        }
        // Since the types are topologically sorted we can assume
        // that all super type properties have already been processed
        for (const superType of typeInterface.printingSuperTypes) {
            const superTypeCrossReferences = crossReferences.get(superType).map(e => ({
                ...e,
                type: typeInterface.name
            }));
            crossReferences.addAll(typeInterface.name, superTypeCrossReferences);
        }
    }
    return Array.from(crossReferences.values()).sort((a, b) => a.type.localeCompare(b.type));
}

function buildIsSubtypeMethod(astTypes: AstTypes): GeneratorNode {
    const methodNode = new IndentNode();
    methodNode.append(
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
    realSuperTypes: Set<string>
}

function groupBySupertypes(astTypes: AstTypes): MultiMap<string, string> {
    const allTypes: ChildToSuper[] = (astTypes.interfaces as ChildToSuper[])
        .concat(astTypes.unions)
        .filter(e => e.realSuperTypes.size > 0);

    const superToChild = new MultiMap<string, string>();
    for (const item of allTypes) {
        superToChild.add([...item.realSuperTypes].join(':'), item.name);
    }

    return superToChild;
}
