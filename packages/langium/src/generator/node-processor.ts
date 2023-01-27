/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode } from './generator-node';
import { DocumentSegmentWithFileURI, getSourceRegion, TextRange, TraceRegion } from './generator-tracing';

class Context {

    defaultIndentation = '    ';
    pendingIndent = true;
    readonly currentIndents: IndentNode[] = [];
    readonly recentNonImmediateIndents: IndentNode[] = [];

    readonly traceData: InternalTraceRegion[] = [];

    private lines: string[][] = [[]];

    constructor(defaultIndent?: string | number) {
        if (typeof defaultIndent === 'string') {
            this.defaultIndentation = defaultIndent;
        } else if (typeof defaultIndent === 'number') {
            this.defaultIndentation = ''.padStart(defaultIndent);
        }
    }

    get content(): string {
        return this.lines.map(e => e.join('')).join('');
    }

    get currentLineNumber(): number {
        return this.lines.length - 1;
    }

    get currentLineContent(): string {
        return this.lines[this.currentLineNumber].join('');
    }

    append(value: string) {
        if (value.length > 0) {
            this.lines[this.currentLineNumber].push(value);
        }
    }

    increaseIndent(node: IndentNode) {
        this.currentIndents.push(node);
        if (!node.indentImmediately) {
            this.recentNonImmediateIndents.push(node);
        }
    }

    decreaseIndent() {
        this.currentIndents.pop();
    }

    get relevantIndents() {
        return this.currentIndents.filter(i => !this.recentNonImmediateIndents.includes(i));
    }

    resetCurrentLine() {
        this.lines[this.currentLineNumber] = [];
    }

    addNewLine() {
        this.pendingIndent = true;
        this.lines.push([]);
        this.recentNonImmediateIndents.length = 0;
    }
}

export function processGeneratorNode(node: GeneratorNode, defaultIndentation?: string | number): { text: string, trace: TraceRegion } {
    const context = new Context(defaultIndentation);
    context.traceData.push(createTraceRegion(undefined, 0));

    processNodeInternal(node, context);

    const trace = context.traceData.pop()!;
    trace.complete && trace.complete(context.content.length);

    const singleChild = trace.children && trace.children.length === 1 ? trace.children[0] : undefined;
    const singleChildTargetRegion = singleChild?.targetRegion;
    const rootTargetRegion = trace.targetRegion;

    if (singleChildTargetRegion && singleChild.sourceRegion
            && singleChildTargetRegion.offset === rootTargetRegion.offset
            && singleChildTargetRegion.length === rootTargetRegion.length) {
        // some optimization:
        // if (the root) `node` is traced (`singleChild.sourceRegion` !== undefined) and spans the entire `context.content`
        //  we skip the wrapping root trace object created above at the beginning of this method
        return { text: context.content, trace: singleChild };

    } else {
        return { text: context.content, trace };
    }
}

interface InternalTraceRegion extends TraceRegion {
    complete?: (targetEnd: number) => TraceRegion;
}

function createTraceRegion(sourceRegion: DocumentSegmentWithFileURI | undefined, targetStart: number): TraceRegion {
    const result = <InternalTraceRegion>{
        sourceRegion,
        targetRegion: undefined!,
        children: [],
        complete: (targetEnd: number) => {
            result.targetRegion = <TextRange>{ offset: targetStart, length: targetEnd - targetStart };
            if (result.children?.length === 0) {
                delete result.children;
            }
            delete result.complete;
            return result;
        }
    };
    return result;
}

function processNodeInternal(node: GeneratorNode | string, context: Context) {
    if (typeof(node) === 'string') {
        processStringNode(node, context);
    } else if (node instanceof IndentNode) {
        processIndentNode(node, context);
    } else if (node instanceof CompositeGeneratorNode) {
        processCompositeNode(node, context);
    } else if (node instanceof NewLineNode) {
        processNewLineNode(node, context);
    }
}

function hasContent(node: GeneratorNode | string, ctx: Context): boolean {
    if (typeof(node) === 'string') {
        return node.length !== 0; // cs: do not ignore ws only content here, enclosed within other nodes it will matter!
    } else if (node instanceof CompositeGeneratorNode) {
        return node.contents.some(e => hasContent(e, ctx));
    } else if (node instanceof NewLineNode) {
        return !(node.ifNotEmpty && ctx.currentLineContent.length === 0);
    } else {
        return false;
    }
}

function processStringNode(node: string, context: Context) {
    if (node) {
        if (context.pendingIndent) {
            handlePendingIndent(context, false);
        }
        context.append(node);
    }
}

function handlePendingIndent(ctx: Context, endOfLine: boolean) {
    let indent = '';
    for (const indentNode of ctx.relevantIndents.filter(e => e.indentEmptyLines || !endOfLine)) {
        indent += indentNode.indentation ?? ctx.defaultIndentation;
    }
    ctx.append(indent);
    ctx.pendingIndent = false;
}

function processCompositeNode(node: CompositeGeneratorNode, context: Context) {
    let traceRegion: InternalTraceRegion | undefined = undefined;

    const sourceRegion: DocumentSegmentWithFileURI | undefined = getSourceRegion(node.tracedSource);
    if (sourceRegion) {
        context.traceData.push(traceRegion = createTraceRegion(sourceRegion, context.content.length));
    }

    for (const child of node.contents) {
        processNodeInternal(child, context);
    }

    if (traceRegion?.complete) {
        traceRegion.complete(context.content.length);
        const droppedRegion = context.traceData.pop();

        // the following assertion can be dropped once the tracing is considered stable
        assertTrue(droppedRegion === traceRegion, 'Trace region mismatch!');

        const parentsFileURI = context.traceData.reduceRight<string|undefined>((prev, curr) => prev || curr.sourceRegion?.fileURI, undefined);
        if (parentsFileURI && sourceRegion?.fileURI === parentsFileURI) {
            // if some parent's sourceRegion refers to the same source file uri (and no other source file was referenced inbetween)
            // we can drop the file uri in order to reduce repeated strings
            delete sourceRegion.fileURI;
        }

        if (traceRegion.targetRegion?.length) {
            context.traceData[ context.traceData.length - 1 ]?.children?.push(traceRegion);
        }
    }
}

function assertTrue(condition: boolean, msg: string): asserts condition is true {
    if (!condition) {
        throw new Error(msg);
    }
}

function processIndentNode(node: IndentNode, context: Context) {
    if (hasContent(node, context)) {
        if (node.indentImmediately && !context.pendingIndent) {
            context.append(node.indentation ?? context.defaultIndentation);
        }
        try {
            context.increaseIndent(node);
            processCompositeNode(node, context);
        } finally {
            context.decreaseIndent();
        }
    }
}

function processNewLineNode(node: NewLineNode, context: Context) {
    if (node.ifNotEmpty && !hasNonWhitespace(context.currentLineContent)) {
        context.resetCurrentLine();
    } else {
        if (context.pendingIndent) {
            handlePendingIndent(context, true);
        }
        context.append(node.lineDelimiter);
        context.addNewLine();
    }
}

function hasNonWhitespace(text: string) {
    return text.trimStart() !== '';
}
