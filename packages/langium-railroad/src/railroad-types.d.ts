/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

declare module 'railroad-diagrams' {

    export type Direction = 'cw' | 'ccw';
    export type CardinalDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
    export type DiagramItem = FakeSVG | string;

    export class FakeSVG {
        needsSpace: boolean;
        up: number;
        down: number;
        height: number;
        width: number;
        tagName: string;
        attrs: Record<string, string>;
        children: DiagramItem[] | string;
        constructor(tagName: string, attrs?: Record<string, string>, text?: DiagramItem[]);
        format(x: number, y: number, width: number): this;
        addTo(parent: unknown): this;
        toString(): string;
        walk(cb: (item: this) => void): void;
    }

    export class Path extends FakeSVG {
        constructor(x: number, y: number);
        m(x: number, y: number): this;
        h(val: number): this;
        right(val: number): this;
        left(val: number): this;
        v(val: number): this;
        down(val: number): this;
        up(val: number): this;
        arc(sweep: number): this;
        arc_8(start: CardinalDirection, dir: Direction): this;
        l(x: number, y: number): this;
        format(): this;
    }

    export class DiagramMultiContainer extends FakeSVG {
        items: DiagramItem[];
        constructor(tagName: string, items: DiagramItem[], attrs?: Record<string, string>, text?: string);
    }

    export class Diagram extends DiagramMultiContainer {
        formatted: boolean;
        constructor(items: DiagramItem[]);
        format(paddingt?: number, paddingr?: number, paddingb?: number, paddingl?: number): this;
        toStandalone(style?: string): string;
    }

    export class ComplexDiagram extends FakeSVG {
        constructor(items: DiagramItem[]): Diagram;
    }

    export class Sequence extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class Stack extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class OptionalSequence extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class AlternatingSequence extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class Choice extends DiagramMultiContainer {
        constructor(normal: number, items: DiagramItem[]);
    }

    export class HorizontalChoice extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class MultipleChoice extends DiagramMultiContainer {
        constructor(items: DiagramItem[]);
    }

    export class Optional extends FakeSVG {
        constructor(item: DiagramItem, skip?: 'skip'): Choice;
    }

    export class OneOrMore extends FakeSVG {
        constructor(item: DiagramItem, rep?: DiagramItem);
    }

    export class ZeroOrMore extends FakeSVG {
        constructor(item: DiagramItem, rep?: DiagramItem, skip?: 'skip'): Choice;
    }

    export class Group extends FakeSVG {
        item: FakeSVG;
        label?: FakeSVG;
        constructor(item: DiagramItem, label?: DiagramItem): Choice;
    }

    type StartOptions = {
        type?: string;
        label?: string;
    }

    export class Start extends FakeSVG {
        type: string;
        label?: string;
        constructor(options?: StartOptions)
    }

    type EndOptions = {
        type?: string;
    }

    export class End extends FakeSVG {
        type: string;
        constructor(options?: EndOptions);
    }

    type TerminalOptions = {
        href?: string;
        title?: DiagramItem;
        cls?: string;
    }

    export class Terminal extends FakeSVG {
        text: string;
        href?: string;
        title?: DiagramItem;
        cls?: string;
        constructor(text: string, options?: TerminalOptions);
    }

    type NonTerminalOptions = TerminalOptions;

    export class NonTerminal extends FakeSVG {
        text: string;
        href?: string;
        title?: DiagramItem;
        cls?: string;
        constructor(text: string, options?: NonTerminalOptions);
    }

    type CommentOptions = TerminalOptions;

    export class Comment extends FakeSVG {
        text: string;
        href?: string;
        title?: DiagramItem;
        cls?: string;
        constructor(text: string, options?: CommentOptions);
    }

    export class Skip extends FakeSVG {
        constructor();
    }

    type BlockOptions = {
        width?: number;
        up?: number;
        height?: number;
        down?: number;
        needsSpace?: boolean;
    }

    export class Block extends FakeSVG {
        constructor(options?: BlockOptions);
    }

    export default {
        FakeSVG,
        Path,
        DiagramMultiContainer,
        Diagram,
        ComplexDiagram,
        Sequence,
        Stack,
        OptionalSequence,
        AlternatingSequence,
        Choice,
        MultipleChoice,
        HorizontalChoice,
        Optional,
        OneOrMore,
        ZeroOrMore,
        Group,
        Start,
        End,
        Terminal,
        NonTerminal,
        Comment,
        Block,
        Skip,
        Direction,
        CardinalDirection,
        DiagramItem
    };
}