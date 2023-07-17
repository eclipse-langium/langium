/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { GeneratorNode, Grammar, LangiumServices } from 'langium';
import type { AstTypes, Property } from 'langium/types';
import type { LangiumConfig } from '../package.js';
import { IndentNode, CompositeGeneratorNode, NL, toString, streamAllContents, MultiMap, GrammarAST } from 'langium';
import { collectAst, collectTypeHierarchy, findReferenceTypes, hasArrayType, isAstType, hasBooleanType, mergeTypesAndInterfaces } from 'langium/types';
import { collectTerminalRegexps, generatedHeader } from './util.js';

export function generateAst(services: LangiumServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const fileNode = new CompositeGeneratorNode();
    fileNode.append(
        generatedHeader,
        '/* eslint-disable */', NL,
    );
    const crossRef = grammars.some(grammar => hasCrossReferences(grammar));
    const importFrom = config.langiumInternal ? `../../syntax-tree${config.importExtension}` : 'langium';
    fileNode.append(
        `import type { AstNode${crossRef ? ', Reference' : ''}, ReferenceInfo, TypeMetaData } from '${importFrom}';`, NL,
        `import { AbstractAstReflection } from '${importFrom}';`, NL, NL
    );

    generateTerminalConstants(fileNode, grammars, config);

    astTypes.unions.forEach(union => fileNode.append(union.toAstTypesString(isAstType(union.type)), NL));
    astTypes.interfaces.forEach(iFace => fileNode.append(iFace.toAstTypesString(true), NL));
    astTypes.unions = astTypes.unions.filter(e => isAstType(e.type));
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

    reflectionNode.append(`export type ${config.projectName}AstType = {`, NL);
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
        for (const interfaceType of astTypes.interfaces) {
            const props = interfaceType.properties;
            const arrayProps = props.filter(e => hasArrayType(e.type));
            const booleanProps = props.filter(e => hasBooleanType(e.type));
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
            const refTypes = findReferenceTypes(property.type);
            for (const refType of refTypes) {
                crossReferences.add(typeInterface.name, {
                    type: typeInterface.name,
                    feature: property.name,
                    referenceType: refType
                });
            }
        }
        // Since the types are topologically sorted we can assume
        // that all super type properties have already been processed
        for (const superType of typeInterface.interfaceSuperTypes) {
            const superTypeCrossReferences = crossReferences.get(superType.name).map(e => ({
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
                caseNode.append(`return ${superTypes.split(':').sort().map(e => `this.isSubtype(${e}, supertype)`).join(' || ')};`);
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

function groupBySupertypes(astTypes: AstTypes): MultiMap<string, string> {
    const hierarchy = collectTypeHierarchy(mergeTypesAndInterfaces(astTypes));
    const superToChild = new MultiMap<string, string>();
    for (const [name, superTypes] of hierarchy.superTypes.entriesGroupedByKey()) {
        superToChild.add(superTypes.join(':'), name);
    }

    return superToChild;
}

function generateTerminalConstants(fileNode: CompositeGeneratorNode, grammars: Grammar[], config: LangiumConfig) {
    let collection: Record<string, RegExp> = {};
    grammars.forEach(grammar => {
        const terminalConstants = collectTerminalRegexps(grammar);
        collection = {...collection, ...terminalConstants};
    });

    fileNode.append(`export const ${config.projectName}Terminals = {`, NL);
    fileNode.indent(node => {
        for (const [name, regexp] of Object.entries(collection)) {
            node.append(`${name}: ${regexp.toString()},`, NL);
        }
    });
    fileNode.append('};', NL, NL);
}

