import { AstNode } from '../generator/ast-node';
import { ParseResult } from '../parser/langium-parser';
import { AstNodeDescription } from '../references/scope';

export interface LangiumDocument {
    documentUri: string // DocumentUri?
    parseResult: ParseResult<AstNode>
    precomputedScopes?: Map<AstNode, AstNodeDescription[]>
}
