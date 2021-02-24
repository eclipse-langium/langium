export type AstNode = {
    kind: string,
    '.references'?: Map<string, string | undefined>,
    '.node'?: ModelNode
}

export type ModelNode = {
    offset: number,
    length: number,
    children?: ModelNode[],
    parent?: ModelNode
}