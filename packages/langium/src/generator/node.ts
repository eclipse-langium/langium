/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EOL } from 'os';

export type GeneratorNode = CompositeGeneratorNode | IndentNode | TextNode | NewLineNode | string;

export class CompositeGeneratorNode {

    private _children: GeneratorNode[] = [];

    public get children(): GeneratorNode[] {
        return this._children;
    }
}

export class IndentNode extends CompositeGeneratorNode {

    private _indentation?: string;

    public get indentation(): string | undefined {
        return this._indentation;
    }
    public set indentation(v: string | undefined) {
        this._indentation = v;
    }

    private _indentImmediately  = true;

    public get indentImmediately(): boolean {
        return this._indentImmediately;
    }
    public set indentImmediately(v: boolean) {
        this._indentImmediately = v;
    }

    private _indentEmptyLines  = false;

    public get indentEmptyLines(): boolean {
        return this._indentEmptyLines;
    }
    public set indentEmptyLines(v: boolean) {
        this._indentEmptyLines = v;
    }

    constructor(indentation?: string | number, indentImmediately = true, indentEmptyLines = false) {
        super();
        if (typeof(indentation) === 'string') {
            this.indentation = indentation;
        } else if (typeof(indentation) === 'number') {
            this.indentation = ''.padStart(indentation);
        }
        this._indentImmediately = indentImmediately;
        this._indentEmptyLines = indentEmptyLines;
    }
}

export class TextNode {

    private _text?: string;
    public get text(): string | undefined {
        return this._text;
    }
    public set text(v: string | undefined) {
        this._text = v;
    }

    constructor(text: string | undefined) {
        this._text = text;
    }
}

export class NewLineNode {

    private _lineDelimiter: string;

    public get lineDelimiter(): string {
        return this._lineDelimiter;
    }
    public set lineDelimiter(v: string) {
        this._lineDelimiter = v;
    }

    private _ifNotEmpty  = false;

    public get ifNotEmpty(): boolean {
        return this._ifNotEmpty;
    }
    public set ifNotEmpty(v: boolean) {
        this._ifNotEmpty = v;
    }

    constructor(lineDelimiter?: string, ifNotEmpty = false) {
        this._lineDelimiter = lineDelimiter ?? EOL;
        this._ifNotEmpty = ifNotEmpty;
    }
}

export const NL = new NewLineNode();
