/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, Grammar, LangiumServices, NL, processGeneratorNode } from 'langium';
import { collectAst, distinctAndSorted, PropertyType } from 'langium/lib/grammar/type-system';
import { LangiumGrammarGrammar } from 'langium/lib/grammar/generated/grammar';
import { collectKeywords } from './util';

export function generateTypesFile(services: LangiumServices, grammars: Grammar[]): string {
    const astTypes = collectAst(services.shared.workspace.LangiumDocuments, grammars);
    const fileNode = new CompositeGeneratorNode();
    const reservedWords = new Set(collectKeywords(LangiumGrammarGrammar()));
    astTypes.unions.filter((union) => !astTypes.interfaces.find((iface) =>
        iface.name === union.name
    )).forEach((union) => {
        fileNode.append(`type ${escapeReservedWords(union.name, reservedWords)} = ${propertyTypesToString(union.union)};`);
        fileNode.append(NL).append(NL);
    });
    astTypes.interfaces.forEach((iFace) => {
        fileNode.append(`interface ${escapeReservedWords(iFace.name, reservedWords)}${iFace.interfaceSuperTypes.length > 0 ? (' extends ' + Array.from(iFace.interfaceSuperTypes).join(', ')) : ''} {`);
        fileNode.append(NL);
        fileNode.indent((body) => {
            iFace.properties.forEach(property => {
                const optional = property.optional && !property.typeAlternatives.some(e => e.array) && !property.typeAlternatives.every(e => e.types.length === 1 && e.types[0] === 'boolean') ? '?' : '';
                body.append(`${escapeReservedWords(property.name, reservedWords)}${optional ? '?' : ''}: ${propertyTypesToString(property.typeAlternatives)}`).append(NL);
            });
        });
        fileNode.append('}').append(NL).append(NL);
    }
    );
    return processGeneratorNode(fileNode);
}

function propertyTypesToString(alternatives: PropertyType[]): string {
    return distinctAndSorted(alternatives.map(typePropertyToString)).join(' | ');
}

function typePropertyToString(propertyType: PropertyType): string {
    let res = distinctAndSorted(propertyType.types).join(' | ');
    res = propertyType.reference ? `@${res}` : res;
    res = propertyType.array ? `${res}[]` : res;
    return res;
}

function escapeReservedWords(name: string, reserved: Set<string>): string {
    return reserved.has(name) ? `^${name}` : name;
}