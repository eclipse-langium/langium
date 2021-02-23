export interface IGeneratorNode {

}

export class CompositeGeneratorNode implements IGeneratorNode {
    
    private _children: IGeneratorNode[] = [];

    public get children() : IGeneratorNode[] {
        return this._children;
    }
}

export class IndentNode extends CompositeGeneratorNode {

    private _indentation : string = "";

    public get indentation() : string {
        return this._indentation;
    }
    public set indentation(v : string) {
        this._indentation = v;
    }

    private _indentImmediately : boolean = true;

    public get indentImmediately() : boolean {
        return this._indentImmediately;
    }
    public set indentImmediately(v : boolean) {
        this._indentImmediately = v;
    }
    
    private _indentEmptyLines : boolean = false;

    public get indentEmptyLines() : boolean {
        return this._indentEmptyLines;
    }
    public set indentEmptyLines(v : boolean) {
        this._indentEmptyLines = v;
    }

    constructor(indentation: string, indentImmediately: boolean = true, indentEmptyLines: boolean = false) {
        super();
        this._indentation = indentation;
        this._indentImmediately = indentImmediately;
        this._indentEmptyLines = indentEmptyLines;
    }
}

export class TextNode {

    private _text?: string;
    public get text() : string | undefined {
        return this._text;
    }
    public set text(v: string | undefined) {
        this._text = v;
    }
    
    constructor(text: string | undefined) {
        this._text = text;
    }
}

export class NewLineNode implements IGeneratorNode {

    private _lineDelimiter : string = '\n';

    public get lineDelimiter() : string {
        return this._lineDelimiter;
    }
    public set lineDelimiter(v : string) {
        this._lineDelimiter = v;
    }
    
    private _ifNotEmpty : boolean = false;

    public get ifNotEmpty() : boolean {
        return this._ifNotEmpty;
    }
    public set ifNotEmpty(v : boolean) {
        this._ifNotEmpty = v;
    }
    
    constructor(lineDelimiter: string = '\n', ifNotEmpty: boolean = false) {
        this._lineDelimiter = lineDelimiter;
        this._ifNotEmpty = ifNotEmpty;
    }
}