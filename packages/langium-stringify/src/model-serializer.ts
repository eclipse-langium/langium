/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST, LangiumDocument } from 'langium';

export interface ModelSerializer {
    serialize(document: LangiumDocument): string;
}

// export class DefaultModelSerializer implements ModelSerializer {
//     serialize(document: LangiumDocument): string {
//         return '';
//     }
//
//     protected serializeNode(node: AstNode, rule: GrammarAST.ParserRule): string {
//
//     }
//
//     protected serializeAtom(data: unknown, atom: AtomElement)
//
// }

export type AtomElement = GrammarAST.Keyword | GrammarAST.RuleCall | GrammarAST.TerminalRuleCall;

