/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, LangiumCoreServices } from 'langium';
import { EOL, type Generated, expandToNode, joinToNode, toString } from 'langium/generate';
import type { AstTypes, Property, PropertyDefaultValue } from 'langium/grammar';
import type { LangiumConfig } from '../package-types.js';
import { collectAst, collectTypeHierarchy, findReferenceTypes, isAstType, mergeTypesAndInterfaces, escapeQuotes } from 'langium/grammar';
import { generatedHeader } from './node-util.js';
import { collectKeywords, collectTerminalRegexps } from './langium-util.js';

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
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)),
            generateAstReflection(config, astTypes)
        }
    `;
    return toString(fileNode);
}

function generateAstReflection(config: LangiumConfig, astTypes: AstTypes): Generated {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const typeHierarchy = collectTypeHierarchy(mergeTypesAndInterfaces(astTypes));

    return expandToNode`
        export type ${config.projectName}AstType = {
            ${joinToNode(typeNames, name => name + ': ' + name, { appendNewLineIfNotEmpty: true })}
        }

        export class ${config.projectName}AstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                ${joinToNode(typeNames, typeName => {
                    const interfaceType = astTypes.interfaces.find(t => t.name === typeName);
                    if (interfaceType) {
                        const props = interfaceType.superProperties;
                        const superTypes = typeHierarchy.superTypes.get(typeName) || [];
                        return expandToNode`
                            ${typeName}: {
                                name: ${typeName}.$type,
                                properties: {
                                    ${buildPropertyMetaData(props, typeName)}
                                },
                                superTypes: [${superTypes.map(t => `${t}.$type`).join(', ')}]
                            }
                        `;
                    }
                    const unionType = astTypes.unions.find(t => t.name === typeName);
                    if (unionType) {
                        const superTypes = typeHierarchy.superTypes.get(typeName) || [];
                        return expandToNode`
                            ${typeName}: {
                                name: ${typeName}.$type,
                                properties: {},
                                superTypes: [${superTypes.map(t => `'${t}'`).join(', ')}]
                            }
                        `;
                    }
                    return undefined;
                }, { separator: ',', appendNewLineIfNotEmpty: true })}
            } as const satisfies langium.AstMetaData
        }

        export const reflection = new ${config.projectName}AstReflection();
    `.appendNewLine();
}

function buildPropertyMetaData(props: Property[], ownerTypeName: string): Generated {
    const all = props.sort((a, b) => a.name.localeCompare(b.name));

    return joinToNode(
        all,
        property => {
            const defaultValue = stringifyDefaultValue(property.defaultValue);
            const refTypes = findReferenceTypes(property.type);
            const refType = refTypes.length > 0 ? refTypes[0] : undefined;

            const attributes: string[] = [`name: ${ownerTypeName}.${property.name}`];
            if (defaultValue) {
                attributes.push(`defaultValue: ${defaultValue}`);
            }
            if (refType) {
                attributes.push(`referenceType: ${refType}.$type`);
            }

            return expandToNode`
                ${property.name}: {
                    ${joinToNode(attributes, attr => attr, { separator: ',', appendNewLineIfNotEmpty: true })}
                }
            `;
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
