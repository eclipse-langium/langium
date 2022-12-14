/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { processGeneratorNode } from './node-processor';

export const EOL = (typeof process === 'undefined') ? '\n' : (process.platform === 'win32') ? '\r\n' : '\n';

/**
 * Common type of expected results of functions contributing to code generation.
 * Includes `undefined` for allowing contributing functions to explicitely contribute
 * nothing, if required, in contrast to contributing empty strings,
 * which facilitates better formatting of the desired output, for example.
 */
export type Generated = GeneratorNode | string | undefined;
export type GeneratorNode = CompositeGeneratorNode | IndentNode | NewLineNode;

export function isGeneratorNode(node: unknown): node is CompositeGeneratorNode | IndentNode | NewLineNode {
    return node instanceof CompositeGeneratorNode
        || node instanceof IndentNode
        || node instanceof NewLineNode;
}

export function isNewLineNode(node: unknown): node is NewLineNode {
    return node instanceof NewLineNode;
}

/**
 * Converts instances of {@link GeneratorNode} into a `string`, defaults to {@link String String(...)} for any other `input`.
 *
 * @param defaultIndentation the indentation to be applied if no explicit indentation is configured
 *  for particular {@link IndentNode IndentNodes}, either a `string` or a `number` of repeated single spaces,
 *  defaults to 4 single spaces, see {@link processGeneratorNode} -> `Context`.
 */
export function toString(input: unknown, defaultIndentation?: string | number): string {
    if (isGeneratorNode(input))
        return processGeneratorNode(input, defaultIndentation);
    else
        return String(input);
}

/**
 * Implementation of {@link GeneratorNode} serving as container for `string` segments, {@link NewLineNode newline indicators},
 * and further {@link CompositeGeneratorNode CompositeGeneratorNodes}, esp. {@link IndentNode IndentNodes}.
 *
 * See usage examples in the `append...` methods' documentations for details.
 */
export class CompositeGeneratorNode {

    readonly contents: Array<(GeneratorNode | string)> = [];

    /**
     * Constructor.
     *
     * @param content a var arg mixture of `strings` and {@link GeneratorNode GeneratorNodes}
     *   describing the initial content of this {@link CompositeGeneratorNode}
     *
     * @example
     *   new CompositeGeneratorNode(
     *      'Hello World!', NL
     *   );
     */
    constructor(...content: Generated[]) {
        this.append(...content);
    }

    isEmpty(): boolean {
        return this.contents.length === 0;
    }

    /**
     * Appends `strings` and instances of {@link GeneratorNode} to `this` generator node.
     *
     * @param content a var arg mixture of `strings`, {@link GeneratorNode GeneratorNodes}, or single param
     *  functions that are immediately called with `this` node as argument, and which may append elements themselves.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *      'Hello', ' ', `${name}!`, NL, someOtherNode, 'NL', node => generateContent(node)
     *   ).append(
     *      'The end!'
     *   );
     */
    append(...content: Array<Generated | ((node: CompositeGeneratorNode) => void)>): this {
        for (const arg of content) {
            if (typeof arg === 'function') {
                arg(this);
            } else if (arg) {
                this.contents.push(arg);
            }
        }
        return this;
    }

    /**
     * Appends `strings` and instances of {@link GeneratorNode} to `this` generator node, if `condition` is `truthy`.
     * The aim of this method is to extend this class' fluent interface API by enabling chained method calls for conditionally appended parts.
     *
     * If `condition` is `true` this method delegates to {@link append}, otherwise it returns just `this`.
     *
     * @param condition a boolean value indicating whether to append the elements of `args` to `this`.
     *
     * @param content a var arg mixture of `strings`, {@link GeneratorNode GeneratorNodes}, or single param
     *  functions that are immediately called with `this` node as argument, and which may append elements themselves.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *      'Hello World!'
     *   ).appendNewLine().appendIf(
     *      entity !== undefined, `Hello ${entity?.name}!`
     *   ).appendNewLineIfNotEmpty();
     */
    appendIf(condition: boolean, content: Array<Generated | ((node: CompositeGeneratorNode) => void)>): this {
        return condition ? this.append(...content) : this;
    }

    /**
     * Appends a strict {@link NewLineNode} to `this` node.
     * Strict {@link NewLineNode}s yield mandatory linebreaks in the derived generated text.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *      'Hello World!'
     *   ).appendNewLine();
     */
    appendNewLine(): this {
        return this.append(NL);
    }

    /**
     * Appends a strict {@link NewLineNode} to `this` node, if `condition` is `truthy`.
     * Strict {@link NewLineNode}s yield mandatory linebreaks in the derived generated text.
     *
     * @param condition a boolean value indicating whether to append a {@link NewLineNode} to `this`.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *      'Hello World!'
     *   ).appendNewLine(entity !== undefined).appendIf(
     *      entity !== undefined, `Hello ${entity?.name}!`
     *   )
     */
    appendNewLineIf(condition: boolean): this {
        return condition ? this.append(NL) : this;
    }

    /**
     * Appends a soft {@link NewLineNode} to `this` node.
     * Soft {@link NewLineNode}s yield linebreaks in the derived generated text only if the preceding line is non-empty,
     * i.e. there are non-whitespace characters added to the generated text since the last linebreak.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().appendIf(
     *      entity !== undefined, `Hello ${entity?.name}!`
     *   ).appendNewLineIfNotEmpty();
     */
    appendNewLineIfNotEmpty(): this {
        return this.append(NLEmpty);
    }

    /**
     * Appends a soft {@link NewLineNode} to `this` node, if `condition` is `truthy`.
     * Soft {@link NewLineNode}s yield linebreaks in the derived generated text only if the preceding line is non-empty,
     * i.e. there are non-whitespace characters added to the generated text since the last linebreak.
     *
     * @param condition a boolean value indicating whether to append a {@link NewLineNode} to `this`.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *      entity.label ?? ''
     *   ).appendNewLineIfNotEmptyIf(entity.description !== undefined).append(
     *      entity.description
     *   )
     */
    appendNewLineIfNotEmptyIf(condition: boolean): this {
        return condition ? this.appendNewLineIfNotEmpty() : this;
    }

    /**
     * Starts an area of indented text output.
     * The content to be indented shall be appended to `indentingNode` that is offered to the single argument `configurator` function.
     *
     * @param configurator a callback offering the container to append the indented content to
     *
     * @param indentation the indentation to be applied, either a `string` or a `number` of repeated single spaces,
     *    defaults to the indentation that might be determined when executing {@link toString}.
     *
     * @returns `this` {@link CompositeGeneratorNode} for convenience.
     *
     * @example
     *   new CompositeGeneratorNode().append(
     *       '{'
     *   ).indent(indentingNode =>
     *       indentingNode.append(
     *           'name:', name, ','
     *       ).appendNewLine().appendIf(description !== undefined,
     *           'description:', description
     *       ).appendNewLineIfNotEmpty()
     *   ).append(
     *       '}'
     *   );
     */
    indent(configurator?: (indentingNode: IndentNode) => void, indentation?: string|number): this {
        const node = new IndentNode(indentation, false);
        this.contents.push(node);
        if (configurator) {
            configurator(node);
        }
        return this;
    }
}

/**
 * Implementation of @{link GeneratorNode} denoting areas within the desired generated text of common increased indentation.
 */
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

/**
 * Implementation of @{link GeneratorNode} denoting linebreaks in the desired generated text.
 */
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
