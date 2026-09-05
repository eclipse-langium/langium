/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting, type NodeFormatter } from 'langium/lsp';
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
            if (node.args.length > 0) {
                // Format Definition of a function
                formatParameters(formatter);
                formatter.property('expr').prepend(Formatting.indent());
            } else {
                // Format Definition of a constant
                formatter.property('expr').prepend(Formatting.oneSpace());
            }

        } else if (ast.isFunctionCall(node)) {
            const formatter = this.getNodeFormatter(node);
            formatParameters(formatter);
        } else if (ast.isNestedExpression(node)) {
            const formatter = this.getNodeFormatter(node);
            // Keep parentheses tight with no spaces inside (but don't restrict spaces outside)
            formatter.keyword('(').append(Formatting.noSpace());
            formatter.keyword(')').prepend(Formatting.noSpace());
        } else if (ast.isBinaryExpression(node)) {
            // const formatter = this.getNodeFormatter(node);
            // FIXME: Infix rules assign incorrect CST nodes to left/right in some cases.
            /* Example:
            * ```calc
            * module Single
            *
            * def adaduf(x, y, z):
            *   x+y+z;
            * ```
            * The `+` between `x` and `y` is incorrectly represented with left CST text =`x+y+z`, right CST text = `z`
            * AST Nodes, however, seems to be attached correctly: on the left CST node we have a BinaryExpression with left=`x`, right=`y`
            *
            * For now, we don't apply spacing within BinaryExpressions at all, else it not only gets partial formatting,
            * but even unexpectedly affects rules *outside* of the BinaryExpression CST!
            */
            // operators cannot be formatted neither as keywords nor as properties
            // left/right property cannot be formatted either
            // formatter.node(node.left).append(getOperatorSpacing(node.operator));
            // formatter.node(node.right).prepend(getOperatorSpacing(node.operator));
        }

        // No space around semicolons in all cases
        const formatter = this.getNodeFormatter(node);
        formatter.keyword(';').surround(Formatting.noSpace());
    }
}

function formatParameters(formatter: NodeFormatter<ast.AbstractDefinition | ast.FunctionCall>): void {
    formatter.keywords('(', ')').surround(Formatting.noSpace());
    formatter.keywords(',')
        .prepend(Formatting.noSpace()).append(Formatting.oneSpace({ allowMore: false }));
}

// function getOperatorSpacing(operator: ast.BinaryExpression['operator']): FormattingAction {
//     switch (operator) {
//         case '+':
//         case '-':
//         case '%':
//             return Formatting.oneSpace({ allowMore: false });
//         case '*':
//         case '/':
//         case '^':
//             return Formatting.noSpace();
//     }
// }
