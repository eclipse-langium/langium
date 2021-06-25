/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EOL } from 'os';

export type GeneratorNode = CompositeGeneratorNode | IndentNode | NewLineNode | string;

export class CompositeGeneratorNode {

    readonly children: GeneratorNode[] = [];

    append(...args: Array<GeneratorNode | ((node: CompositeGeneratorNode) => void)>): GeneratorNode {
        for (const arg of args) {
            if (typeof arg === 'function') {
                arg(this);
            } else {
                this.children.push(arg);
            }
        }
        return this;
    }

    indent(func?: (indentNode: IndentNode) => void): IndentNode {
        const node = new IndentNode();
        this.children.push(node);
        if (func) {
            func(node);
        }
        return node;
    }
}

export class IndentNode extends CompositeGeneratorNode {

    indentation?: string;
    indentImmediately  = true;
    indentEmptyLines  = false;

    constructor(indentation?: string | number, indentImmediately = true, indentEmptyLines = false) {
        super();
        if (typeof(indentation) === 'string') {
            this.indentation = indentation;
        } else if (typeof(indentation) === 'number') {
            this.indentation = ''.padStart(indentation);
        }
        this.indentImmediately = indentImmediately;
        this.indentEmptyLines = indentEmptyLines;
    }
}

export class NewLineNode {

    lineDelimiter: string;

    ifNotEmpty  = false;

    constructor(lineDelimiter?: string, ifNotEmpty = false) {
        this.lineDelimiter = lineDelimiter ?? EOL;
        this.ifNotEmpty = ifNotEmpty;
    }
}

export const NL = new NewLineNode();
export const NLEmpty = new NewLineNode(undefined, true);