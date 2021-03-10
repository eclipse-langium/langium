import { PartialDeep } from "type-fest"

export type AstNode = {
    kind: string,
    '.references': Map<string, string | undefined>,
    '.node'?: ModelNode
}

export type ModelNode = {
    offset: number,
    length: number,
    children?: ModelNode[],
    parent?: ModelNode
}

export type RuleResult<T> = (idxInCallingRule?: number, ...args: any[]) => PartialDeep<T>