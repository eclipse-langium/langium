/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting } from 'langium/lsp';
import * as ast from './generated/ast.js';

export class StatemachineFormatter extends AbstractFormatter {
    protected format(node: AstNode): void {
        if (ast.isState(node)) {
            const formatter = this.getNodeFormatter(node);
            formatter.keyword('state')
                .prepend(Formatting.newLine({ allowMore: true }))
                .append(Formatting.oneSpace());

            formatter.keyword('actions').append(Formatting.oneSpace());
            const bracesOpen = formatter.keyword('{');
            bracesOpen.prepend(Formatting.fit(Formatting.oneSpace(), Formatting.newLine()));
            const bracesClose = formatter.keyword('}');
            bracesClose.prepend(Formatting.newLine());
            formatter.interior(bracesOpen, bracesClose).prepend(Formatting.indent());

            const stateName = formatter.property('name');
            const stateEnd = formatter.keyword('end');
            formatter.interior(stateName, stateEnd).prepend(Formatting.indent());
            stateEnd.prepend(Formatting.newLine());
        } else if (ast.isStatemachine(node)) {
            const formatter = this.getNodeFormatter(node);

            formatter.keyword('statemachine').append(Formatting.oneSpace());
            formatter.properties('name').append(Formatting.newLine({ allowMore: true }));

            formatter.keyword('initialState')
                .prepend(Formatting.newLine({ allowMore: true }))
                .append(Formatting.oneSpace());
            formatter.property('init').append(Formatting.newLine({ allowMore: true }));

            formatter.keyword('commands')
                .prepend(Formatting.newLine({ allowMore: true }));
            formatter.keyword('events')
                .prepend(Formatting.newLine({ allowMore: true }));
            const nodes = formatter.nodes(...node.commands, ...node.events);
            nodes.prepend(Formatting.indent());
        } else if (ast.isTransition(node)) {
            const formatter = this.getNodeFormatter(node);
            formatter.keyword('=>').surround(Formatting.oneSpace());
        }
    }
}
