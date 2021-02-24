import { CompositeGeneratorNode, IGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node";

class Context {

    private lines: string[][] = [[]];
    private _pendingIndent: boolean = true;
    private _currentIndents: IndentNode[] = [];
    private indentLength: number = 0;

    public get pendingIndent(): boolean {
        return this._pendingIndent;
    }

    public set pendingIndent(v: boolean) {
        this._pendingIndent = v;
    }

    get content(): string {
        return this.lines.map(e => e.join('')).join('');
    }

    get currentIndents(): IndentNode[] {
        return this._currentIndents;
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
        this._currentIndents.push(node);
        this.indentLength += node.indentation.length;
    }

    decreaseIndent() {
        const lastNode = this._currentIndents.pop();
        if (lastNode) {
            this.indentLength -= lastNode.indentation.length;
        }
    }

    resetCurrentLine() {
        this.lines[this.currentLineNumber] = [];
    }

    addNewLine() {
        this.pendingIndent = true;
        this.lines.push([]);
    }
}

export function process(node: IGeneratorNode): string {
    const context = new Context();
    processNode(node, context);
    return context.content;
}

function processNode(node: IGeneratorNode, context: Context) {
    if (node instanceof TextNode) {
        processTextNode(node, context);
    } else if (node instanceof IndentNode) {
        processIndentNode(node, context);
    } else if (node instanceof CompositeGeneratorNode) {
        processCompositeNode(node, context);
    } else if (node instanceof NewLineNode) {
        processNewLineNode(node, context);
    }
}

function hasContent(node: IGeneratorNode, ctx: Context): boolean {
    if (node instanceof TextNode) {
        return !!node.text && hasNonWhitespace(node.text);
    } else if (node instanceof IndentNode || node instanceof CompositeGeneratorNode) {
        return node.children.some(e => hasContent(e, ctx));
    } else if (node instanceof NewLineNode) {
        return !(node.ifNotEmpty && ctx.currentLineContent.length == 0);
    } else {
        return false;
    }
}

function processTextNode(node: TextNode, context: Context) {
    if (node.text && node.text.length > 0) {
        if (context.pendingIndent) {
            handlePendingIndent(context, false);
        }
        context.append(node.text);
    }
}

function handlePendingIndent(ctx: Context, endOfLine: boolean) {
    let indent = "";
    ctx.currentIndents.filter(e => e.indentEmptyLines || !endOfLine).forEach(e => {
        indent += e.indentation;
    });
    ctx.append(indent);
    ctx.pendingIndent = false;
}

function processCompositeNode(node: CompositeGeneratorNode, context: Context) {
    node.children.forEach(child => {
        processNode(child, context);
    });
}

function processIndentNode(node: IndentNode, context: Context) {
    if (hasContent(node, context)) {
        if (node.indentImmediately && !context.pendingIndent) {
            context.append(node.indentation);
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