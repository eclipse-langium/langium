/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, LangiumCoreServices } from 'langium';
import { MultiMap } from 'langium';
import { EOL, type Generated, expandToNode, joinToNode, toString } from 'langium/generate';
import type { AstTypes, Property, PropertyDefaultValue } from 'langium/grammar';
import { collectAst, collectTypeHierarchy, escapeQuotes, findReferenceTypes, isAstType, isReferenceType, mergeTypesAndInterfaces, propertyTypeToKind, propertyTypeToString } from 'langium/grammar';
import type { LangiumConfig } from '../package-types.js';
import { collectKeywords, collectTerminalRegexps } from './langium-util.js';
import { generatedHeader } from './node-util.js';

export function generateAst(services: LangiumCoreServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(grammars, services);
    const importFrom = config.langiumInternal ? `../../syntax-tree${config.importExtension}` : 'langium';
    const fileNode = expandToNode`
        ${generatedHeader}

        /* eslint-disable */
        import * as langium from '${importFrom}';

        ${generateTerminalConstants(grammars, config)}

        ${joinToNode(astTypes.unions, union => union.toAstTypesString(isAstType(union.type)), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(astTypes.interfaces, iFace => iFace.toAstTypesString(true), { appendNewLineIfNotEmpty: true })}
        ${
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)), // The astTypes.unions are filtered in-place here!
            generateAstReflection(config, astTypes)
        }
    `;
    return toString(fileNode);
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): Generated {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const crossReferenceTypes = buildCrossReferenceTypes(astTypes);
    // TODO properties: UnionTypes with common properties??
    // TODO getAllTypes(): MetaData vs Names
    // TODO Names of Properties in PropertyMetaData
    // TODO Properties: Multiplicities: 1, 0..1, * VS mandatory/multiValue
    return expandToNode`
        export type ${config.projectName}AstType = {
            ${joinToNode(typeNames, name => name + ': ' + name, { appendNewLineIfNotEmpty: true })}
        }

        export const properties: langium.AstTypeProperties<${config.projectName}AstType> = langium.deepFreeze({
            ${buildTypeMetaDataProperties(astTypes)}
        });

        export class ${config.projectName}AstReflection extends langium.AbstractAstReflection {

            ${buildTypeMetaData(astTypes)}

            getAllTypes(): string[] {
                return [${typeNames.join(', ')}];
            }

            protected override computeIsSubtype(subtype: string, supertype: string): boolean {
                ${buildIsSubtypeMethod(astTypes)}
            }

            getReferenceType(refInfo: langium.ReferenceInfo): string {
                ${buildReferenceTypeMethod(crossReferenceTypes, config)}
            }

            getTypeMetaData(type: string): langium.TypeMetaData | undefined {
                return this[type as keyof ${config.projectName}AstReflection] as (langium.TypeMetaData | undefined);
            }
        }

        export const reflection = new ${config.projectName}AstReflection();
    `.appendNewLine();
}

type TypeWithProperties = {
    name: string,
    properties: Property[], // own and inherited properties!
}

function calculateAllTypesWithProperties(astTypes: AstTypes): TypeWithProperties[] {
    const result: TypeWithProperties[] = [];
    // interfaces
    astTypes.interfaces.forEach(interfaceType => result.push({ name: interfaceType.name, properties: interfaceType.superProperties }));
    // types, including union types like "A = B | C"
    astTypes.unions.forEach(typeType => result.push({ name: typeType.name, properties: typeType.properties }));
    result.sort((t1, t2) => t1.name.localeCompare(t2.name)); // ensure stable and sorted order
    return result;
}

function buildTypeMetaDataProperties(astTypes: AstTypes): Generated {
    const types = calculateAllTypesWithProperties(astTypes);
    return joinToNode(
        types,
        typeWithProperties => expandToNode`
            ${typeWithProperties.name}: {
                $name: ${typeWithProperties.name},
                ${joinToNode(
                    typeWithProperties.properties,
                    property => `${property.name}: '${property.name}',`,
                    { appendNewLineIfNotEmpty: true }
                )}
            },
        `,
        {
            appendNewLineIfNotEmpty: true
        }
    );
}

function buildTypeMetaData(astTypes: AstTypes): Generated {
    const types = calculateAllTypesWithProperties(astTypes);
    return joinToNode(
        types, // this includes union types like "A = B | C"!
        typeWithProperties => expandToNode`
            readonly ${typeWithProperties.name} = {
                $name: ${typeWithProperties.name},
                $properties: {
                    ${buildPropertyType(typeWithProperties.properties /* own and inherited properties! */)}
                },
            };
        `,
        {
            appendNewLineIfNotEmpty: true
        }
    );
}

function buildPropertyType(props: Property[]): Generated {
    const all = props.sort((a, b) => a.name.localeCompare(b.name));

    return joinToNode(
        all,
        property => {
            // TODO "inheritedFrom: string|undefined" ??
            const propertyType = propertyTypeToString(isReferenceType(property.type) ? property.type.referenceType : property.type, 'Reflection');
            const name = escapeQuotes(property.name, "'");
            const type = escapeQuotes(propertyType, "'");
            const kind = propertyTypeToKind(property.type);
            const defaultValue = stringifyDefaultValue(property.defaultValue);
            return `${name}: { name: '${name}', type: '${type}', kind: '${kind}'${defaultValue ? `, defaultValue: ${defaultValue}` : ''} },`;
        },
        { appendNewLineIfNotEmpty: true}
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

function buildReferenceTypeMethod(_crossReferenceTypes: CrossReferenceType[], _config: LangiumConfig): Generated {
    return expandToNode`
        // TODO move both methods into the parent class?
        const containerTypeName = refInfo.container.$type;
        const containerTypeMetaData = this.getTypeMetaData(containerTypeName);
        if (containerTypeMetaData === undefined) {
            throw new Error(\`\${containerTypeName} is not a valid container $type.\`);
        }
        const propertyMetaData = containerTypeMetaData.$properties[refInfo.property]; //  as keyof langium.SpecificPropertiesToString<langium.AstNode>
        if (propertyMetaData === undefined) {
            throw new Error(\`'\${refInfo.property}' is not a valid property of the container $type \${containerTypeName}.\`);
        }
        if (propertyMetaData.kind !== 'Reference') {
            throw new Error(\`'\${refInfo.property}' is no Reference, but \${propertyMetaData.kind}.\`);
        }
        return propertyMetaData.type;
    `;
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
    }

    for (const typeInterface of astTypes.interfaces) {
        const superFeatures = new Set<string>();
        for (const superType of typeInterface.interfaceSuperTypes) {
            for (const superTypeCrossReference of crossReferences.get(superType.name)) {
                if (!superFeatures.has(superTypeCrossReference.feature)) {
                    crossReferences.add(typeInterface.name, { ...superTypeCrossReference, type: typeInterface.name });
                    superFeatures.add(superTypeCrossReference.feature);
                }
            }
        }
    }

    return Array.from(crossReferences.values()).sort((a, b) => a.type.localeCompare(b.type));
}

function buildIsSubtypeMethod(astTypes: AstTypes): Generated {
    const groups = groupBySupertypes(astTypes);
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

        export type ${config.projectName}KeywordNames =${keywordStrings.length > 0 ? keywordStrings.map(keyword => `${EOL}    | ${keyword}`).join('') : ' never'};

        export type ${config.projectName}TokenNames = ${config.projectName}TerminalNames | ${config.projectName}KeywordNames;
    `.appendNewLine();
}
