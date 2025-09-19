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
            formatter.property('name').append(Formatting.newLine());
            // All statements should be aligned to the root (no additional indentation)
            const statements = formatter.nodes(...node.statements);
            statements.prepend(Formatting.noIndent());
        } else if (ast.isDefinition(node)) {
            const formatter = this.getNodeFormatter(node);
            formatter.keyword('def').append(Formatting.oneSpace());
            formatter.keyword(':').prepend(Formatting.noSpace());

            // Format Definition of a function
            if (node.args.length > 0) {
                formatter.keywords('(', ')').surround(Formatting.noSpace());
                // Space after commas in parameter lists
                formatter.keywords(',').append(Formatting.oneSpace());
                formatter.property('expr').prepend(Formatting.indent());
            // Format Definition of a constant
            } else {
                formatter.property('expr').prepend(Formatting.oneSpace());
            }
        } else if (ast.isEvaluation(node)) {
            const formatter = this.getNodeFormatter(node);
            // No space before semicolon
            formatter.keyword(';').prepend(Formatting.noSpace());
        } else if (ast.isExpression(node)) {
            const formatter = this.getNodeFormatter(node);
            formatter.keyword('(').append(Formatting.noSpace());
            formatter.keyword(')').prepend(Formatting.noSpace());
            if (ast.isBinaryExpression(node)) {
                // const formatter = this.getNodeFormatter(node);
                // Spaces around all binary operators
                // TODO: Infix rules cannot be formatted
                // operators cannot be formatted neither as keywords nor as properties
                // left/right property cannot be formatted either
            }
        } else if (ast.isFunctionCall(node)) {
            const formatter = this.getNodeFormatter(node);
            // Format parentheses and arguments (if any)
            if (node.args.length > 0) {
                formatter.keywords('(', ')').surround(Formatting.noSpace());
                // Space after commas in argument lists
                formatter.keywords(',').append(Formatting.oneSpace());
            }
        }

        // No space around semicolons in all cases
        const formatter = this.getNodeFormatter(node);
        formatter.keyword(';').surround(Formatting.noSpace());
    }
}
