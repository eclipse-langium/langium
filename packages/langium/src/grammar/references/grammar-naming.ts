/******************************************************************************
* Copyright 2022 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { DefaultNameProvider } from '../../references/naming';
import { AstNode, CstNode } from '../../syntax-tree';
import { isAssignment } from '../generated/ast';
import { findNodeForFeature } from '../grammar-util';

export class LangiumGrammarNameProvider extends DefaultNameProvider {

    getName(node: AstNode): string | undefined {
        if (isAssignment(node)) {
            return node.feature;
        } else {
            return super.getName(node);
        }
    }

    getNameNode(node: AstNode): CstNode | undefined {
        if (isAssignment(node)) {
            return findNodeForFeature(node.$cstNode, 'feature');
        } else {
            return super.getNameNode(node);
        }
    }

}
