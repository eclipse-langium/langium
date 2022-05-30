/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { isAssignment, isInterface, isParserRule, ParserRule, Interface, Assignment } from '../generated/ast';
import { DefaultGoToResolverProvider, GoToLink } from '../../lsp';
import { CstNode } from '../../syntax-tree';
import { getContainerOfType, getDocument } from '../../utils/ast-util';
import { findNodeForFeature } from '../grammar-util';

export class LangiumGrammarGoToResolver extends DefaultGoToResolverProvider {

    protected findLink(source: CstNode): GoToLink | undefined {
        if (isAssignment(source.element)) {
            let goToLink: GoToLink | undefined;
            const parserRule = getContainerOfType(source.element, isParserRule);
            if(parserRule && parserRule.returnType) {
                goToLink = this.findLinkForDeclaredType(parserRule, source);
            }
            return goToLink;
        }
        return super.findLink(source);
    }

    findLinkForDeclaredType(parserRule: ParserRule, source: CstNode): GoToLink | undefined {
        const returnTypeCstNode = parserRule.returnType!.ref?.$cstNode;
        if (returnTypeCstNode && isInterface(returnTypeCstNode.element)){
            return this.getGoToLink(returnTypeCstNode.element, source);
        }
        return undefined;
    }

    private getGoToLink(returnTypeCstNodeElement: Interface, source: CstNode) {
        let goToLink: GoToLink | undefined;
        returnTypeCstNodeElement.attributes.forEach(attribute => {
            if (attribute.name === (source.element as Assignment).feature) {
                const target = findNodeForFeature(attribute.$cstNode, 'name');
                if (target) {
                    const targetDocument = getDocument(returnTypeCstNodeElement);
                    goToLink = { source, target, targetDocument };
                }
            }
        });
        return goToLink;
    }
}
