/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstReflection, TypeMetaData } from '../syntax-tree';
import { isAstNode } from '../utils/ast-util';
import { LangiumDocuments } from '../workspace/documents';
import { Grammar } from './generated/ast';
import { collectAst } from './type-system/type-collector';
import { AstTypes } from './type-system/types-util';

export function interpreteAstReflection(langiumDocuments: LangiumDocuments, grammar: Grammar): AstReflection {
    const collectedTypes = collectAst(langiumDocuments, [grammar]);
    const allTypes = collectedTypes.interfaces.map(e => e.name).concat(collectedTypes.unions.map(e => e.name));
    const references = getReferenceTypes(collectedTypes);

    return {
        getAllTypes() {
            return allTypes;
        },
        getReferenceType(referenceId: string): string {
            const referenceType = references.get(referenceId);
            if (referenceType) {
                return referenceType;
            }
            throw new Error('Could not find reference type for ' + referenceId);
        },
        getTypeMetaData(type: string): TypeMetaData {
            return {
                name: type,
                mandatory: []
            };
        },
        isInstance(node: AstNode, type: string): boolean {
            return isAstNode(node) && this.isSubtype(node.$type, type);
        },
        isSubtype(subtype: string, supertype: string): boolean {
            if (subtype === supertype) {
                return true;
            }
            return true;
        }
    };
}

function getReferenceTypes(astTypes: AstTypes): Map<string, string> {
    const references = new Map<string, string>();
    for (const interfaceType of astTypes.interfaces) {
        for (const property of interfaceType.properties) {
            for (const propertyAlternative of property.typeAlternatives) {
                if (propertyAlternative.reference) {
                    references.set(`${interfaceType.name}:${property.name}`, propertyAlternative.types[0]);
                }
            }
        }
    }
    return references;
}