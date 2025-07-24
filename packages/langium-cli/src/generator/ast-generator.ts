/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { type Grammar, type LangiumCoreServices } from 'langium';
import { expandToNode, joinToNode, toString, type Generated } from 'langium/generate';
import type { AstTypes, Property, PropertyDefaultValue } from 'langium/grammar';
import { collectAst, collectTypeHierarchy, escapeQuotes, findReferenceTypes, isAstType, mergeTypesAndInterfaces } from 'langium/grammar';
import type { LangiumConfig, LangiumLanguageConfig } from '../package-types.js';
import { collectKeywords, collectTerminalRegexps } from './langium-util.js';
import { generatedHeader } from './node-util.js';

function generateAstHeader(langiumConfig: LangiumConfig): Generated {
    const importFrom = langiumConfig.langiumInternal ? `../../syntax-tree${langiumConfig.importExtension}` : 'langium';
    return expandToNode`
        ${generatedHeader}

        /* eslint-disable */
        import * as langium from '${importFrom}';
    `;
}

export function generateAstSingleLanguageProject(services: LangiumCoreServices, embeddedGrammar: Grammar, config: LangiumConfig): string {
    const astTypes = collectAst(embeddedGrammar, { services });
    const astTypesFiltered: AstTypes = { // some operations with in-place changes are done on these filtered AsTypes!
        interfaces: [...astTypes.interfaces],
        unions: astTypes.unions.filter(e => isAstType(e.type)),
    };
    const fileNode = expandToNode`
        ${generateAstHeader(config)}

        ${generateTerminalsAndKeywords([embeddedGrammar], config.projectName)}

        ${joinToNode(generateTypeDefinitions(astTypes), t => t.generatedCode, { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })}
        ${generateAstType(config.projectName, astTypesFiltered)}

        ${generateAstReflection(config.projectName, astTypesFiltered)}
    `.appendNewLine();
    return toString(fileNode);
}

export function generateAstMultiLanguageProject(services: LangiumCoreServices, languages: LanguageInfo[], config: LangiumConfig): string {
    const astTypes = collectAst(languages.map(l => l.embeddedGrammar), { services });

    const fileNode = expandToNode`
        ${generateAstHeader(config)}

        ${joinToNode( // a namespace for each each language with its language-specific elements: reachable terminals & keywords, complete AstType list
            languages,
            language => expandToNode`
                /** Contains the reachable terminals & keywords and all available types of the '${language.identifier}' language. */
                export namespace ${language.identifier} {

                    ${generateTerminalsAndKeywords([language.embeddedGrammar], '')}

                    ${generateAstType('', collectAst([language.embeddedGrammar], { services, filterNonAstTypeUnions: true }))}

                }
            `.appendNewLine().appendNewLine(),
        )}

        // the terminals, keywords and types of the whole '${config.projectName}' project

        ${ // reachable terminals & keywords for the whole project
            generateTerminalsAndKeywordsComposed(languages.map(l => l.identifier), config.projectName)
        }

        ${ // AstType list for the whole project
            generateAstTypeComposed(languages.map(l => l.identifier), config.projectName)
        }


        // all type definitions of the the whole '${config.projectName}' project

        ${joinToNode(generateTypeDefinitions(astTypes), t => t.generatedCode, { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true })}
        ${ // reflection for the whole project
            astTypes.unions = astTypes.unions.filter(e => isAstType(e.type)), // Note that the `unions` are changed in-place here!
            generateAstReflection(config.projectName, astTypes) // Note that here are some more in-place changes!
        }
    `.appendNewLine();
    return toString(fileNode);
}

interface TypeWithCode {
    typeName: string;
    generatedCode: string;
}

function generateTypeDefinitions(astTypes: AstTypes): TypeWithCode[] {
    return [
        ...astTypes.unions.map(union => <TypeWithCode>{ typeName: union.name, generatedCode: union.toAstTypesString(isAstType(union.type)) }),
        ...astTypes.interfaces.map(iFace => <TypeWithCode>{ typeName: iFace.name, generatedCode: iFace.toAstTypesString(true) }),
    ].sort((l, r) => l.typeName.localeCompare(r.typeName));
}

export interface LanguageInfo {
    /** the grammar which is defined as entry/main grammar */
    entryGrammar: Grammar
    /** copy of the entry grammar, all imports are (recursively) replaced by the content of the imported grammar(s) */
    embeddedGrammar: Grammar
    /** the whole configuration for this language, by default done in a langium-config.json file */
    languageConfig: LangiumLanguageConfig
    /** used to identify/name this language in the generated ast.ts */
    identifier: string
}

export function getLanguageIdentifier(_config: LangiumConfig, grammar: Grammar): string {
    return grammar.name!; // there is a check in the CLI, that the top-level grammar of a language always has a 'name' value!
}

function generateAstType(name: string, astTypes: AstTypes): Generated {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();

    return expandToNode`
        export type ${name}AstType = {
            ${joinToNode(typeNames, name => name + ': ' + name, { appendNewLineIfNotEmpty: true })}
        }
    `;
}

function generateAstTypeComposed(identifiers: string[], name: string): Generated {
    identifiers.sort(); // in-place, for a stable order
    return expandToNode`
        export type ${name}AstType = ${joinToNode(identifiers, identifier => `${identifier}.AstType`, { separator: ' & ' })}
    `;
}

function generateAstReflection(name: string, astTypes: AstTypes): Generated {
    const typeNames: string[] = astTypes.interfaces.map(t => t.name)
        .concat(astTypes.unions.map(t => t.name))
        .sort();
    const typeHierarchy = collectTypeHierarchy(mergeTypesAndInterfaces(astTypes));

    return expandToNode`
        export class ${name}AstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                ${joinToNode(typeNames, typeName => {
                    const interfaceType = astTypes.interfaces.find(t => t.name === typeName);
                    const unionType = astTypes.unions.find(t => t.name === typeName);
                    if (interfaceType || unionType) {
                        const props = interfaceType?.superProperties ?? [];
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

function generateTerminalsAndKeywords(grammars: Grammar[], name: string): Generated {
    // Collects only reached/used terminals and keywords, i.e. elements which are not reachable, when transitively following the entry rule of the grammars.
    // For grammars without entry rule, all elements are collected.

    // Called terminal fragments are ignored "because referenced terminals are expanded/inlined
    //  before registering the relevant terminals in the lexer/generating the regexes to ast.ts.
    //  You might argue that generating sub terminals might still be useful.
    //  However, the value converter is always asked for converting terminals being accepted by a expanded terminal regex.
    //  Thus, using the expanded terminal definition and doing finer evaluations by checking for matched groups according to the actual terminal regex is the natural way to go"
    //  (https://github.com/eclipse-langium/langium/pull/1979#issuecomment-3089241029).
    let collection: Record<string, RegExp> = {};
    const keywordTokens = new Set<string>();
    grammars.forEach(grammar => {
        const terminalConstants = collectTerminalRegexps(grammar); // collects only reachable terminals, ignore called terminal fragments, ignores imported grammars
        collection = {...collection, ...terminalConstants};
        for (const keyword of collectKeywords(grammar)) { // collects only reachable keywords, ignores imported grammars
            keywordTokens.add(keyword);
        }
    });

    const keywordStrings = Array.from(keywordTokens).sort().map((keyword) => JSON.stringify(keyword));

    return expandToNode`
        export const ${name}Terminals = {
            ${joinToNode(Object.entries(collection), ([name, regexp]) => `${name}: ${regexp.toString()},`, { appendNewLineIfNotEmpty: true })}
        };

        export type ${name}TerminalNames = keyof typeof ${name}Terminals;

        export type ${name}KeywordNames =${keywordStrings.length > 0 ? undefined : ' never;'}
            ${joinToNode(
                keywordStrings,
                keyword => `| ${keyword}`,
                { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true }
            )?.append(';')}

        export type ${name}TokenNames = ${name}TerminalNames | ${name}KeywordNames;
    `;
}

function generateTerminalsAndKeywordsComposed(identifiers: string[], name: string): Generated {
    identifiers.sort(); // in-place, for a stable order
    return expandToNode`
        export const ${name}Terminals = {
            ${joinToNode(
                identifiers,
                identifier => `...${identifier}.Terminals,`,
                { appendNewLineIfNotEmpty: true }
            )}
        };

        export type ${name}TerminalNames = keyof typeof ${name}Terminals;

        export type ${name}KeywordNames = ${joinToNode(
            identifiers,
            identifier => `${identifier}.KeywordNames`,
            { separator: ' | ' }
        )};

        export type ${name}TokenNames = ${name}TerminalNames | ${name}KeywordNames;
    `;
}
