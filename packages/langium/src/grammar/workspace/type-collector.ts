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
import { AstResources, AstTypes, collectAllAstResources, InterfaceType, Property, UnionType } from '../type-system/types-util';

export class LangiumGrammarTypeCollector {
    readonly validationResources = new Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>();
    // todo using type graph allows to remove this `superPropertiesMap`
    readonly superPropertiesMap = new Map<string, Property[]>();

    private collectTypeResources(documents: LangiumDocuments, grammars: Grammar[]): TypeResources {
        const astResources = collectAllAstResources(grammars, documents);
        const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
        const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types));

        shareSuperTypesFromUnions(inferred, declared);
        this.addSuperProperties(inferred);
        this.addSuperProperties(declared);

        return { astResources, inferred, declared };
    }

    private addSuperProperties({ interfaces }: AstTypes) {
        function addSuperPropertiesInternal(type: InterfaceType) {
            if (visited.has(type)) return;
            visited.add(type);

            for (const superTypeName of type.printingSuperTypes) {
                const superType = interfaces.find(e => e.name === superTypeName);
                if (superType && isInterface(superType)) {
                    addSuperPropertiesInternal(superType);
                    superType.superProperties
                        .entriesGroupedByKey()
                        .forEach(propInfo => type.superProperties.addAll(propInfo[0], propInfo[1]));
                }
            }
        }

        const visited = new Set<InterfaceType>();
        for (const type of interfaces) {
            addSuperPropertiesInternal(type);
        }
    }

    // todo cimprove resources collection
    // currently, all previously collected resources will be lost after an update of any document
    // and data only from updated documents will exist
    collectValidationResources(documents: LangiumDocuments, grammars: Grammar[]) {
        this.clear();
        const { astResources, inferred, declared } = this.collectTypeResources(documents, grammars);

        const typeNameToRulesActions = new MultiMap<string, ParserRule | Action>();
        this.collectNameToRules(typeNameToRulesActions, astResources);
        this.collectNameToActions(typeNameToRulesActions, astResources);

        for (const type of mergeTypesAndInterfaces(inferred)) {
            this.validationResources.set(
                type.name,
                { inferred: type, inferredNodes: typeNameToRulesActions.get(type.name) }
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
                    inferred ? {...inferred, declared: type, declaredNode: node } : { declared: type, declaredNode: node }
                );
            }
        }

        this.collectSuperPropertiesMap(declared);
    }

    private clear() {
        this.validationResources.clear();
        this.superPropertiesMap.clear();
    }

    private collectSuperPropertiesMap({ interfaces }: AstTypes) {
        for (const type of interfaces) {
            this.superPropertiesMap.set(type.name, Array.from(type.superProperties.values()));
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

export function isType(type: TypeOption): type is UnionType {
    return type && 'union' in type;
}

export function isInterface(type: TypeOption): type is InterfaceType {
    return type && 'properties' in type;
}

export type InferredInfo = {
    inferred: TypeOption,
    inferredNodes: ReadonlyArray<ParserRule | Action>
}

export type DeclaredInfo = {
    declared: TypeOption,
    declaredNode: Type | Interface,
}

export function isDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is DeclaredInfo {
    return type && 'declared' in type;
}

export function isInferred(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo {
    return type && 'inferred' in type;
}

export function isInferredAndDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo & DeclaredInfo {
    return type && 'inferred' in type && 'declared' in type;
}

export type TypeResources = {
    inferred: AstTypes,
    declared: AstTypes,
    astResources: AstResources,
}
