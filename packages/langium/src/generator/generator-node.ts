/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

const EOL = (typeof process === 'undefined') ? '\n' : (process.platform === 'win32') ? '\r\n' : '\n';

export type GeneratorNode = CompositeGeneratorNode | IndentNode | NewLineNode | string;

export class CompositeGeneratorNode {

    readonly contents: GeneratorNode[] = [];

    constructor(...contents: GeneratorNode[]) {
        this.append(...contents);
    }

    append(...args: Array<GeneratorNode | ((node: CompositeGeneratorNode) => void)>): CompositeGeneratorNode {
        for (const arg of args) {
            if (typeof arg === 'function') {
                arg(this);
            } else {
                this.contents.push(arg);
            }
        }
        return this;
    }

    indent(func?: (indentNode: IndentNode) => void): CompositeGeneratorNode {
        const node = new IndentNode();
        this.contents.push(node);
        if (func) {
            func(node);
        }
        return this;
    }
}

export class IndentNode extends CompositeGeneratorNode {

    indentation?: string;
    indentImmediately = true;
    indentEmptyLines = false;

    constructor(indentation?: string | number, indentImmediately = true, indentEmptyLines = false) {
        super();
        if (typeof (indentation) === 'string') {
            this.indentation = indentation;
        } else if (typeof (indentation) === 'number') {
            this.indentation = ''.padStart(indentation);
        }
        this.indentImmediately = indentImmediately;
        this.indentEmptyLines = indentEmptyLines;
    }
}

export class NewLineNode {

    lineDelimiter: string;

    ifNotEmpty = false;

    constructor(lineDelimiter?: string, ifNotEmpty = false) {
        this.lineDelimiter = lineDelimiter ?? EOL;
        this.ifNotEmpty = ifNotEmpty;
    }
}

export const NL = new NewLineNode();
export const NLEmpty = new NewLineNode(undefined, true);
