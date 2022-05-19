/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { isAssignment, isInterface, isParserRule } from '../generated/ast';
import { DefaultGoToResolverProvider, GoToLink } from '../../lsp';
import { CstNode } from '../../syntax-tree';
import { getContainerOfType, getDocument } from '../../utils/ast-util';
import { findNodeForFeature } from '../..';

export class LangiumGrammarGoToResolver extends DefaultGoToResolverProvider {

    protected findLink(source: CstNode): GoToLink | undefined {
        if (isAssignment(source.element)){
            let goToLink: GoToLink | undefined;
            const parserRule = getContainerOfType(source.element, isParserRule);
            // check that the parser rule has a return type
            if (parserRule && parserRule.returnType) {
                const returnType = parserRule.returnType;
                const returnTypeCstNode = returnType.ref?.$cstNode;
                if (returnTypeCstNode && isInterface(returnTypeCstNode.element)){
                    const sourcePropertyName = source.element.feature;
                    returnTypeCstNode.element.attributes.forEach(attribute => {
                        // find attribute corresponding to the property
                        if (attribute.name === sourcePropertyName) {
                            const target = findNodeForFeature(attribute.$cstNode, 'name');
                            if (target) {
                                const targetDocument = getDocument(returnTypeCstNode.element);
                                goToLink = { source, target, targetDocument };
                            }
                        }
                    });
                }
            }
            return goToLink;
        }
        return super.findLink(source);
    }
}
