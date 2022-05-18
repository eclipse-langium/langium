/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { findParentParserRuleCstNode, isAssignment, isInterface, isParserRule } from '..';
import { DefaultGoToResolverProvider } from '../lsp';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { LangiumDocument } from '../workspace/documents';

export class LangiumGrammarGoToResolver extends DefaultGoToResolverProvider {

    constructor(services: LangiumServices) {
        super(services);
    }

    protected findTargetNode(sourceCstNode: CstNode, targetCstNodes: Array<{ source: CstNode; target: CstNode; targetDocument: LangiumDocument; }>): void {
        if (isAssignment(sourceCstNode.element)){
            const parserRule = findParentParserRuleCstNode(sourceCstNode);
            // check that the parser rule has a return type
            if (parserRule && isParserRule(parserRule.element) && parserRule.element.returnType) {
                const returnType = parserRule.element.returnType;
                const returnTypeCstNode = returnType.ref?.$cstNode;
                // check that returnTypeCstNode is an Interface
                if (returnTypeCstNode && isInterface(returnTypeCstNode.element)){
                    const sourcePropertyName = sourceCstNode.element.feature;
                    returnTypeCstNode.element.attributes.forEach(attribute => {
                        // find attribute which corresponds to the property and push it to targetCstNodes array
                        if (attribute.name === sourcePropertyName) {
                            const targetDocument = getDocument(returnTypeCstNode.element);
                            targetCstNodes.push({ source: sourceCstNode, target: attribute.$cstNode!, targetDocument: targetDocument});
                        }
                    });
                }
            }
            else {
                super.findTargetNode(sourceCstNode, targetCstNodes);
            }
        }
        else {
            super.findTargetNode(sourceCstNode, targetCstNodes);
        }
    }
}
