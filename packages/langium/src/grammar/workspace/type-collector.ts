/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { MultiMap } from '../../utils/collections';
import { stream } from '../../utils/stream';
import { LangiumDocuments } from '../../workspace/documents';
import { AbstractElement, Action, Grammar, Interface, isAction, isAlternatives, isGroup, isUnorderedGroup, ParserRule, Type } from '../generated/ast';
import { getActionType, getRuleType } from '../internal-grammar-util';
import { collectDeclaredTypes } from '../type-system/declared-types';
import { collectInferredTypes } from '../type-system/inferred-types';
import { shareSuperTypesFromUnions } from '../type-system/type-collector';
import { AstResources, AstTypes, collectAllAstResources, InterfaceType, UnionType } from '../type-system/types-util';

export class LangiumGrammarTypeCollector {
    private validationResources = new Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>();

    private collectTypeResources(documents: LangiumDocuments, grammars: Grammar[]): TypeResources {
        const astResources = collectAllAstResources(grammars, documents);
        const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
        const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types));
        shareSuperTypesFromUnions(inferred, declared);
        return { astResources, inferred, declared };
    }

    getValidationResources() {
        return this.validationResources;
    }

    collectValidationResources(documents: LangiumDocuments, grammars: Grammar[]) {
        const { astResources, inferred, declared } = this.collectTypeResources(documents, grammars);

        const typeNameToRulesActions = new MultiMap<string, ParserRule | Action>();
        this.collectNameToRules(typeNameToRulesActions, astResources);
        this.collectNameToActions(typeNameToRulesActions, astResources);

        for (const type of mergeTypesAndInterfaces(inferred)) {
            this.validationResources.set(
                type.name,
                { inferred: type, infNodes: typeNameToRulesActions.get(type.name) }
            );
        }

        const typeNametoInterfacesUnions = stream(astResources.interfaces)
            .concat(astResources.types)
            .reduce((acc, type) => acc.set(type.name, type),
                new Map<string, Type | Interface>()
            );
        for (const type of mergeTypesAndInterfaces(declared)) {
            const node = typeNametoInterfacesUnions.get(type.name);
            if (node) {
                const inferred = this.validationResources.get(type.name);
                this.validationResources.set(
                    type.name,
                    inferred ? {...inferred, declared: type, deckNode: node } : { declared: type, deckNode: node }
                );
            }
        }
    }

    private collectNameToRules(acc: MultiMap<string, ParserRule | Action>, {parserRules, datatypeRules}: AstResources) {
        return stream(parserRules)
            .concat(datatypeRules)
            .forEach(rule => acc.add(getRuleType(rule), rule));
    }

    private collectNameToActions(acc: MultiMap<string, ParserRule | Action>, {parserRules}: AstResources) {
        function collectActions(element: AbstractElement) {
            if (isAction(element)) {
                const name = getActionType(element);
                if (name) {
                    acc.add(name, element);
                }
            } if (isAlternatives(element) || isGroup(element) || isUnorderedGroup(element)) {
                element.elements.forEach(e => collectActions(e));
            }
        }

        for (const rule of parserRules) {
            collectActions(rule.definition);
        }
    }
}

function mergeTypesAndInterfaces(astTypes: AstTypes): TypeOption[] {
    return (astTypes.interfaces as TypeOption[]).concat(astTypes.unions);
}

export type ValidationResources = Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>;

export type TypeOption = UnionType | InterfaceType;

export type InferredInfo = {
    inferred: TypeOption,
    infNodes: ReadonlyArray<ParserRule | Action>
}

export type DeclaredInfo = {
    declared: TypeOption,
    deckNode: Type | Interface,
}

export type TypeResources = {
    inferred: AstTypes,
    declared: AstTypes,
    astResources: AstResources,
}
