import { Grammar } from "../gen/ast";
import { decycle, retrocycle } from 'json-cycle';

export function serialize(grammar: Grammar): string {
    return JSON.stringify(decycle(grammar));
}

export function deserialize(content: string): Grammar {
    return <Grammar>retrocycle(JSON.parse(content));
}