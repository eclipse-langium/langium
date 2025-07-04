/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { type Grammar, type LangiumCoreServices } from 'langium';
import type { CompositeGeneratorNode } from 'langium/generate';
import { EOL, expandToNode, joinToNode, toString, type Generated } from 'langium/generate';
import type { AstTypes, Property, PropertyDefaultValue } from 'langium/grammar';
import { collectAst, collectTypeHierarchy, escapeQuotes, findReferenceTypes, isAstType, mergeTypesAndInterfaces, resolveTransitiveImports } from 'langium/grammar';
import type { LangiumConfig, LangiumLanguageConfig } from '../package-types.js';
import { collectKeywords, collectTerminalRegexps, getAstIdentifierForGrammarFile } from './langium-util.js';
import { generatedHeader } from './node-util.js';

function generateAstHeader(langiumConfig: LangiumConfig): CompositeGeneratorNode {
    const importFrom = langiumConfig.langiumInternal ? `../../syntax-tree${langiumConfig.importExtension}` : 'langium';
    return expandToNode`
        ${generatedHeader}

        /* eslint-disable */
        import * as langium from '${importFrom}';
    `;
}

export function generateAstSingleFileProject(services: LangiumCoreServices, grammars: Grammar[], config: LangiumConfig): string {
    const astTypes = collectAst(grammars, { services });
    const astTypesFiltered: AstTypes = { // some operations with in-place changes are done on these filtered AsTypes!
        interfaces: [...astTypes.interfaces],
        unions: astTypes.unions.filter(e => isAstType(e.type)),
    };
    const fileNode = expandToNode`
        ${generateAstHeader(config)}

        ${generateTerminalConstants(grammars, config.projectName)}
        ${joinToNode(astTypes.unions, union => union.toAstTypesString(isAstType(union.type)), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(astTypes.interfaces, iFace => iFace.toAstTypesString(true), { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })}
        ${generateAstType(config.projectName, astTypesFiltered)}
        ${generateAstReflection(config.projectName, astTypesFiltered)}
    `.appendNewLine();
    return toString(fileNode);
}

export function generateAstMultiFileProject(services: LangiumCoreServices, config: LangiumConfig, allGrammarFiles: Grammar[]): string {
    const astTypes = collectAst(allGrammarFiles, { services });
    const fileNode = expandToNode`
        ${generateAstHeader(config)}

        ${joinToNode( // terminals & keywords for each *.langium file (without terminals & keywords from imported grammars)
            allGrammarFiles,
            grammar => generateTerminalConstants([grammar], getFileIdentifier(config, grammar)),
        )}
        ${ // terminals & keywords for the whole project
            generateTerminalConstantsComposed(allGrammarFiles.map(f => getFileIdentifier(config, f)), config.projectName)
        }
        ${joinToNode(astTypes.unions, union => union.toAstTypesString(isAstType(union.type)), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(astTypes.interfaces, iFace => iFace.toAstTypesString(true), { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })}
        ${joinToNode( // AstType list for each *.langium file (with types from imported grammars)
            allGrammarFiles,
            grammar => generateAstType(getFileIdentifier(config, grammar), collectAst([grammar], { services, filterNonAstTypeUnions: true })),
        )}
        ${ // AstType list for the whole project
            generateAstTypeComposed(allGrammarFiles.map(f => getFileIdentifier(config, f)), config.projectName)
        }
        ${ // reflection for the whole project
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)), // Note that the `unions` are changed in-place here!
            generateAstReflection(config.projectName, astTypes) // Note that here are some more in-place changes!
        }
    `.appendNewLine();
    return toString(fileNode);
}

export function generateAstMultiLanguageProject(services: LangiumCoreServices, configMap: Map<Grammar, LangiumLanguageConfig>, config: LangiumConfig, allGrammarFiles: Grammar[]): string {
    const astTypes = collectAst(allGrammarFiles, { services });
    const languages = Array.from(configMap.entries())
        .map(e => <LanguageInfo>{
            grammar: e[0],
            config: e[1],
            allImported: resolveTransitiveImports(services.shared.workspace.LangiumDocuments, e[0]),
            identifier: getLanguageIdentifier(config, e[0]), // the name defined after the 'grammar' keyword inside the *.langium file
        })
        .sort((e1, e2) => e1.identifier.localeCompare(e2.identifier));

    const fileNode = expandToNode`
        ${generateAstHeader(config)}

        ${joinToNode( // terminals & keywords for each *.langium file (without terminals & keywords from imported grammars)
            allGrammarFiles,
            grammar => generateTerminalConstants([grammar], getFileIdentifier(config, grammar)),
        )}
        ${joinToNode( // terminals & keywords for each language
            languages,
            language => generateTerminalConstantsComposed([language.grammar, ...language.allImported].map(g => getFileIdentifier(config, g)), language.identifier),
        )}
        ${ // terminals & keywords for the whole project
            generateTerminalConstantsComposed(languages.map(l => l.identifier), config.projectName)
        }
        ${joinToNode(astTypes.unions, union => union.toAstTypesString(isAstType(union.type)), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(astTypes.interfaces, iFace => iFace.toAstTypesString(true), { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })}
        ${joinToNode( // AstType list for each *.langium file (with types from imported grammars)
            allGrammarFiles,
            grammar => generateAstType(getFileIdentifier(config, grammar), collectAst([grammar], { services, filterNonAstTypeUnions: true })),
        )}
        ${joinToNode( // AstType list for each language
            languages,
            language => generateAstTypeComposed([language.grammar, ...language.allImported].map(g => getFileIdentifier(config, g)), language.identifier),
        )}
        ${ // AstType list for the whole project
            generateAstTypeComposed(languages.map(l => l.identifier), config.projectName)
        }
        ${ // reflection for the whole project
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)), // Note that the `unions` are changed in-place here!
            generateAstReflection(config.projectName, astTypes) // Note that here are some more in-place changes!
        }
    `.appendNewLine();
    return toString(fileNode);
}

interface LanguageInfo {
    grammar: Grammar
    allImported: Grammar[]
    config: LangiumLanguageConfig
    identifier: string
}

function getLanguageIdentifier(config: LangiumConfig, grammar: Grammar): string {
    return `${config.projectName}Language${grammar.name!}`; // there is a check, that the top-level grammar of a language has a 'name' value!
}

function getFileIdentifier(config: LangiumConfig, grammar: Grammar): string {
    return `${config.projectName}File${getAstIdentifierForGrammarFile(grammar)}`;
}

function generateAstType(name: string, astTypes: AstTypes): CompositeGeneratorNode {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();

    return expandToNode`
        export type ${name}AstType = {
            ${joinToNode(typeNames, name => name + ': ' + name, { appendNewLineIfNotEmpty: true })}
        }
    `.appendNewLine().appendNewLine();
}

function generateAstTypeComposed(identifiers: string[], name: string): CompositeGeneratorNode {
    identifiers.sort(); // in-place, for a stable order
    return expandToNode`
        export type ${name}AstType = ${joinToNode(
            identifiers.sort(),
            identifier => `${identifier}AstType`,
            { separator: ' & ' }
        )}
    `.appendNewLine().appendNewLine();
}

function generateAstReflection(name: string, astTypes: AstTypes): CompositeGeneratorNode {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const typeHierarchy = collectTypeHierarchy(mergeTypesAndInterfaces(astTypes));

    return expandToNode`
        export class ${name}AstReflection extends langium.AbstractAstReflection {
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
                    return undefined;
                }, { separator: ',', appendNewLineIfNotEmpty: true })}
            } as const satisfies langium.AstMetaData
        }

        export const reflection = new ${name}AstReflection();
    `;
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

function generateTerminalConstants(grammars: Grammar[], name: string): Generated {
    let collection: Record<string, RegExp> = {};
    const keywordTokens = new Set<string>();
    grammars.forEach(grammar => {
        const terminalConstants = collectTerminalRegexps(grammar); // ignores imported grammars
        collection = {...collection, ...terminalConstants};
        for (const keyword of collectKeywords(grammar)) {
            keywordTokens.add(keyword);
        }
    });

    const keywordStrings = Array.from(keywordTokens).sort().map((keyword) => JSON.stringify(keyword));

    return expandToNode`
        export const ${name}Terminals = {
            ${joinToNode(Object.entries(collection), ([name, regexp]) => `${name}: ${regexp.toString()},`, { appendNewLineIfNotEmpty: true })}
        };

        export type ${name}TerminalNames = keyof typeof ${name}Terminals;

        export type ${name}KeywordNames =${keywordStrings.length > 0 ? keywordStrings.map(keyword => `${EOL}    | ${keyword}`).join('') : ' never'};

        export type ${name}TokenNames = ${name}TerminalNames | ${name}KeywordNames;
    `.appendNewLine().appendNewLine();
}

function generateTerminalConstantsComposed(identifiers: string[], name: string): Generated {
    identifiers.sort(); // in-place, for a stable order
    return expandToNode`
        export const ${name}Terminals = {
            ${joinToNode(
                identifiers,
                identifier => `...${identifier}Terminals,`,
                { appendNewLineIfNotEmpty: true }
            )}
        };

        export type ${name}TerminalNames = keyof typeof ${name}Terminals;

        export type ${name}KeywordNames = ${joinToNode(
            identifiers,
            identifier => `${identifier}KeywordNames`,
            { separator: ' | ' }
        )};

        export type ${name}TokenNames = ${name}TerminalNames | ${name}KeywordNames;
    `.appendNewLine().appendNewLine();
}
