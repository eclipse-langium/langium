/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting } from 'langium/lsp';
import * as ast from './generated/ast.js';

export class ArithmeticsFormatter extends AbstractFormatter {
    protected override format(node: AstNode): void {
        if (ast.isModule(node)) {
            const formatter = this.getNodeFormatter(node);
            // Format module declaration: "module" keyword followed by space, then name
            formatter.keyword('module').append(Formatting.oneSpace());
            // All statements should be aligned to the root (no additional indentation)
            const statements = formatter.nodes(...node.statements);
            statements.prepend(Formatting.noIndent());
        } else if (ast.isDefinition(node)) {
            const formatter = this.getNodeFormatter(node);
            // Format definition: "def" keyword followed by space
            formatter.keyword('def').append(Formatting.oneSpace());
            // Space before colon and after colon
            formatter.keyword(':').surround(Formatting.oneSpace());
            // No space before semicolon
            formatter.keyword(';').prepend(Formatting.noSpace());
            // Format parentheses around parameters (if any)
            if (node.args.length > 0) {
                formatter.keyword('(').append(Formatting.noSpace());
                formatter.keyword(')').prepend(Formatting.noSpace());
                // Space after commas in parameter lists
                formatter.keywords(',').append(Formatting.oneSpace());
            }
        } else if (ast.isEvaluation(node)) {
            const formatter = this.getNodeFormatter(node);
            // No space before semicolon
            formatter.keyword(';').prepend(Formatting.noSpace());
        } else if (ast.isBinaryExpression(node)) {
            const formatter = this.getNodeFormatter(node);
            // Spaces around all binary operators (+, -, *, /, %, ^)
            formatter.keywords('+', '-', '*', '/', '%', '^').surround(Formatting.oneSpace());
        } else if (ast.isFunctionCall(node)) {
            const formatter = this.getNodeFormatter(node);
            // Format parentheses and arguments (if any)
            if (node.args.length > 0) {
                formatter.keyword('(').append(Formatting.noSpace());
                formatter.keyword(')').prepend(Formatting.noSpace());
                // Space after commas in argument lists
                formatter.keywords(',').append(Formatting.oneSpace());
            }
        }

        // Handle parentheses in expressions - no space inside parentheses
        const formatter = this.getNodeFormatter(node);
        formatter.keyword('(').append(Formatting.noSpace());
        formatter.keyword(')').prepend(Formatting.noSpace());
    }
}
