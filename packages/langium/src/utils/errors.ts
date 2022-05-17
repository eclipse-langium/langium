import { CstNode } from "..";

export class ErrorWithLocation extends Error {
    constructor(node: CstNode|undefined, message: string) {
        super(`${message} at ${node?.range.start.line || 0}:${node?.range.start.character || 0}`);
    }
}

export function assertUnreachable(x: never): never {
    throw new Error("Error! Please fulfill the logic also for the other types in the inheritence hierarchy.");
}