/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, LangiumCoreServices } from 'langium';
import { EOL, type Generated, expandToNode, joinToNode, toString } from 'langium/generate';
import type { AstTypes, Property, PropertyDefaultValue } from 'langium/grammar';
import type { LangiumConfig } from '../package-types.js';
import { AstUtils, MultiMap, GrammarAST } from 'langium';
import { collectAst, collectTypeHierarchy, findReferenceTypes, isAstType, mergeTypesAndInterfaces, escapeQuotes } from 'langium/grammar';
import { generatedHeader } from './node-util.js';
import { collectKeywords, collectTerminalRegexps } from './langium-util.js';

export function generateAst(services: LangiumCoreServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const crossRef = grammars.some(grammar => hasCrossReferences(grammar));
    const importFrom = config.langiumInternal ? `../../syntax-tree${config.importExtension}` : 'langium';
    /* eslint-disable @typescript-eslint/indent */
    const fileNode = expandToNode`
        ${generatedHeader}

        /* eslint-disable */
        import type { AstNode${crossRef ? ', Reference' : ''}, ReferenceInfo, TypeMetaData } from '${importFrom}';
        import { AbstractAstReflection } from '${importFrom}';

        ${generateTerminalConstants(grammars, config)}

        ${joinToNode(astTypes.unions, union => union.toAstTypesString(isAstType(union.type)), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(astTypes.interfaces, iFace => iFace.toAstTypesString(true), { appendNewLineIfNotEmpty: true })}
        ${
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)),
            generateAstReflection(config, astTypes)
        }
    `;
    return toString(fileNode);
    /* eslint-enable @typescript-eslint/indent */
}

function hasCrossReferences(grammar: Grammar): boolean {
    return Boolean(AstUtils.streamAllContents(grammar).find(GrammarAST.isCrossReference));
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): Generated {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const crossReferenceTypes = buildCrossReferenceTypes(astTypes);
    return expandToNode`
        export type ${config.projectName}AstType = {
            ${joinToNode(typeNames, name => name + ': ' + name, { appendNewLineIfNotEmpty: true })}
        }

        export class ${config.projectName}AstReflection extends AbstractAstReflection {

            getAllTypes(): string[] {
                return [${typeNames.join(', ')}];
            }

            protected override computeIsSubtype(subtype: string, supertype: string): boolean {
                ${buildIsSubtypeMethod(astTypes)}
            }

            getReferenceType(refInfo: ReferenceInfo): string {
                ${buildReferenceTypeMethod(crossReferenceTypes)}
            }

            getTypeMetaData(type: string): TypeMetaData {
                ${buildTypeMetaDataMethod(astTypes)}
            }
        }

        export const reflection = new ${config.projectName}AstReflection();
    `.appendNewLine();
}

function buildTypeMetaDataMethod(astTypes: AstTypes): Generated {
    /* eslint-disable @typescript-eslint/indent */
    return expandToNode`
        switch (type) {
            ${
                joinToNode(
                    astTypes.interfaces,
                    interfaceType => {
                        const props = interfaceType.superProperties;
                        return (props.length > 0)
                            ? expandToNode`
                                case ${interfaceType.name}: {
                                    return {
                                        name: ${interfaceType.name},
                                        properties: [
                                            ${buildPropertyType(props)}
                                        ]
                                    };
                                }
                            `
                            : undefined;
                    },
                    {
                        appendNewLineIfNotEmpty: true
                    }
                )
            }
            default: {
                return {
                    name: type,
                    properties: []
                };
            }
        }
    `;
    /* eslint-enable @typescript-eslint/indent */
}

function buildPropertyType(props: Property[]): Generated {
    const all = props.sort((a, b) => a.name.localeCompare(b.name));

    return joinToNode(
        all,
        property => {
            const defaultValue = stringifyDefaultValue(property.defaultValue);
            return `{ name: '${escapeQuotes(property.name, "'")}'${defaultValue ? `, defaultValue: ${defaultValue}` : ''} }`;
        },
        { separator: ',', appendNewLineIfNotEmpty: true}
    );
}

function stringifyDefaultValue(value?: PropertyDefaultValue): string | undefined {
    if (typeof value === 'string') {
        // Escape all double quotes
        return `'${escapeQuotes(value, "'")}'`;
    } else if (Array.isArray(value)) {
        return `[${value.map(e => stringifyDefaultValue(e)).join(', ')}]`;
    } else if (value !== undefined) {
        return value.toString();
    } else {
        return undefined;
    }
}

function buildReferenceTypeMethod(crossReferenceTypes: CrossReferenceType[]): Generated {
    const buckets = new MultiMap<string, string>(crossReferenceTypes.map(e => [e.referenceType, `${e.type}:${e.feature}`]));
    /* eslint-disable @typescript-eslint/indent */
    return expandToNode`
        const referenceId = ${'`${refInfo.container.$type}:${refInfo.property}`'};
        switch (referenceId) {
            ${
                joinToNode(
                    buckets.entriesGroupedByKey(),
                    ([target, refs]) => expandToNode`
                        ${joinToNode(refs, ref => `case '${escapeQuotes(ref, "'")}':`, { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true})} {
                            return ${target};
                        }
                    `,
                    { appendNewLineIfNotEmpty: true }
                )
            }
            default: {
                throw new Error(${'`${referenceId} is not a valid reference id.`'});
            }
        }
    `;
    /* eslint-enable @typescript-eslint/indent */
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

function buildIsSubtypeMethod(astTypes: AstTypes): Generated {
    const groups = groupBySupertypes(astTypes);
    /* eslint-disable @typescript-eslint/indent */
    return expandToNode`
        switch (subtype) {
            ${
                joinToNode(
                    groups.entriesGroupedByKey(),
                    ([superTypes, typeGroup]) => expandToNode`
                        ${joinToNode(typeGroup, typeName => `case ${typeName}:`, { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })} {
                            return ${superTypes.split(':').sort().map(e => `this.isSubtype(${e}, supertype)`).join(' || ')};
                        }
                    `,
                    { appendNewLineIfNotEmpty: true}
                )
            }
            default: {
                return false;
            }
        }
    `;
    /* eslint-enable @typescript-eslint/indent */
}

function groupBySupertypes(astTypes: AstTypes): MultiMap<string, string> {
    const hierarchy = collectTypeHierarchy(mergeTypesAndInterfaces(astTypes));
    const superToChild = new MultiMap<string, string>();
    for (const [name, superTypes] of hierarchy.superTypes.entriesGroupedByKey()) {
        superToChild.add(superTypes.join(':'), name);
    }

    return superToChild;
}

function generateTerminalConstants(grammars: Grammar[], config: LangiumConfig): Generated {
    let collection: Record<string, RegExp> = {};
    const keywordTokens = new Set<string>();
    grammars.forEach(grammar => {
        const terminalConstants = collectTerminalRegexps(grammar);
        collection = {...collection, ...terminalConstants};
        for (const keyword of collectKeywords(grammar)) {
            keywordTokens.add(keyword);
        }
    });

    const keywordStrings = Array.from(keywordTokens).sort().map((keyword) => JSON.stringify(keyword));

    return expandToNode`
        export const ${config.projectName}Terminals = {
            ${joinToNode(Object.entries(collection), ([name, regexp]) => `${name}: ${regexp.toString()},`, { appendNewLineIfNotEmpty: true })}
        };

        export type ${config.projectName}TerminalNames = keyof typeof ${config.projectName}Terminals;

        export type ${config.projectName}KeywordNames = ${keywordStrings.length > 0 ? keywordStrings.map(keyword => `${EOL}    | ${keyword}`).join('') : 'never'};

        export type ${config.projectName}TokenNames = ${config.projectName}TerminalNames | ${config.projectName}KeywordNames;
    `.appendNewLine();
}
