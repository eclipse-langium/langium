import { Action, Alternatives, AssignableAlternatives, AssignableTerminal, Assignment, Grammar, Group, ParserRule, RuleCall, UnorderedGroup } from "../gen/ast";
import { getTypeName } from "../grammar/grammar-utils";
import { CompositeGeneratorNode, IndentNode, NewLineNode } from "./node/node";
import { process } from "./node/node-processor";

type Cardinality = "?" | "*" | "+" | undefined;

type TypeAlternative = {
    name: string,
    superType?: string,
    fields: Field[]
    ruleCalls: string[]
}

type Field = {
    name: string,
    array: boolean,
    optional: boolean,
    types: string[]
}

export class Type {

    name: string;
    alternatives: string[];

    constructor(name: string, alternatives: string[]) {
        this.name = name;
        this.alternatives = alternatives;
    }

    toString(): string {
        return "export type " + this.name + " = " + this.alternatives.join(" | ") + ";\n";
    }
}

export class Interface {
    name: string;
    superType: string;
    fields: Field[];

    constructor(name: string, superType: string | undefined, fields: Field[]) {
        this.name = name;
        this.superType = superType ?? "AstNode";
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        interfaceNode.children.push("export interface ", this.name, " extends ", this.superType, " {", new NewLineNode());
        const fieldsNode = new IndentNode(4);
        for (const field of this.fields) {
            fieldsNode.children.push(field.name, field.optional ? "?" : "", ": ", field.types.join(" | "), field.array ? "[]" : "", new NewLineNode());
        }
        interfaceNode.children.push(fieldsNode, "}", new NewLineNode(), new NewLineNode());
        interfaceNode.children.push("export namespace ", this.name, " {", new NewLineNode());
        const isMethodNode = new IndentNode(4);
        const isMethodBody = new IndentNode(4);
        isMethodNode.children.push("export function is(item: any): item is ", this.name, " {", new NewLineNode(), isMethodBody, "}");
        isMethodBody.children.push("return item && item.kind === '", this.name, "';", new NewLineNode());
        interfaceNode.children.push(isMethodNode, new NewLineNode(), "}", new NewLineNode());

        return process(interfaceNode);
    }
}

export function collectAst(grammar: Grammar): Array<Type | Interface> {
    const collector = new TypeCollector();

    const parserRules = grammar.rules.filter(e => e.kind === "ParserRule").map(e => e as ParserRule);

    for (const rule of parserRules) {
        collectAlternatives(collector, rule.Alternatives, getTypeName(rule));
    }

    return collector.calculateAst();
}

function collectAlternatives(collector: TypeCollector, alternatives: Alternatives, name?: string): void {
    if (alternatives.kind === "Alternatives") {
        alternatives.Elements.forEach(e => {
            if (name) {
                collector.addAlternative(name);
            }
            collectUnorderedGroup(collector, e);
        });
    } else {
        if (name) {
            collector.addAlternative(name);
        }
        collectUnorderedGroup(collector, alternatives);
    }
}

function collectUnorderedGroup(collector: TypeCollector, unorderedGroup: UnorderedGroup): void {
    if (unorderedGroup.kind === "UnorderedGroup") {
        unorderedGroup.Elements.forEach(e => {
            collectGroup(collector, e);
        });
    } else {
        collectGroup(collector, unorderedGroup);
    }
}

function collectGroup(collector: TypeCollector, group: Group): void {
    for (const element of group.Elements) {
        if (element.kind === "Action") {
            collector.addAction(element);
        } else if (element.kind === "Assignment") {
            collector.addAssignment(element);
        } else if (element.kind === "RuleCall") {
            collector.addRuleCall(element);
        } else if (element.kind === "Alternatives" || element.kind === "Group" || element.kind === "UnorderedGroup") {
            collector.enterGroup(element.Cardinality);
            collectAlternatives(collector, element);
            collector.leaveGroup();
        }
    }
}

export class TypeCollector {

    private alternatives: TypeAlternative[] = [];
    private cardinalities: Cardinality[] = [];
    private lastRuleCall?: RuleCall;

    private get currentAlternative(): TypeAlternative {
        return this.alternatives[this.alternatives.length - 1];
    }

    clear(): void {
        this.cardinalities = [];
        this.alternatives = [];
    }

    addAlternative(name: string): void {
        this.alternatives.push({ name, fields: [], ruleCalls: [] });
    }

    addAction(action: Action): void {
        this.currentAlternative.name = action.Type;
        if (action.Feature && action.Operator) {
            if (this.lastRuleCall) {
                this.currentAlternative.fields.push({
                    name: this.clean(action.Feature),
                    array: action.Operator === "+=",
                    optional: this.isOptional(),
                    types: [getTypeName(this.lastRuleCall.Rule)]
                });
            } else {
                throw new Error("Actions with features can only be called after an unassigned rule call");
            }
        }
    }

    addAssignment(assignment: Assignment): void {
        this.currentAlternative.fields.push({
            name: this.clean(assignment.Feature),
            array: assignment.Operator === "+=",
            optional: this.isOptional(),
            types: assignment.Operator === "?=" ? ["boolean"] : this.findTypes(assignment.Terminal)
        });
    }

    addRuleCall(ruleCall: RuleCall): void {
        this.currentAlternative.ruleCalls.push(getTypeName(ruleCall.Rule));
        this.lastRuleCall = ruleCall;
    }

    enterGroup(cardinality: Cardinality): void {
        this.cardinalities.push(cardinality);
    }

    leaveGroup(): void {
        this.cardinalities.pop();
    }

    protected isOptional(): boolean {
        return this.cardinalities.some(e => e === "*" || e === "?");
    }

    protected findTypes(terminal: AssignableTerminal): string[] {
        const types: string[] = [];

        if (terminal.kind === "AssignableAlternatives") {
            types.push(...this.findInAlternatives(terminal));
        } else if (terminal.kind === "Keyword") {
            types.push(terminal.Value);
        } else if (terminal.kind === "RuleCall") {
            types.push(getTypeName(terminal.Rule));
        } else if (terminal.kind === "CrossReference") {
            types.push(getTypeName(terminal.Type));
        }
        return types;
    }

    protected findInAlternatives(alternatives: AssignableAlternatives): string[] {
        const types: string[] = [];
        for (const terminal of alternatives.Elements) {
            types.push(...this.findTypes(terminal));
        }
        return types;
    }

    // TODO: Optimize this method
    protected flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
        const names = new Set<string>(alternatives.map(e => e.name));
        const types: TypeAlternative[] = [];

        for (const name of Array.from(names)) {
            const fields: Field[] = [];
            const ruleCalls = new Set<string>();
            const type = { name, fields, ruleCalls: <string[]>[] };
            const namedAlternatives = alternatives.filter(e => e.name === name);
            for (const alt of namedAlternatives) {
                const altFields = alt.fields;
                for (const altField of altFields) {
                    const existingField = fields.find(e => e.name === altField.name);
                    if (existingField) {
                        existingField.optional = existingField.optional && altField.optional;
                        const typeSet = new Set(existingField.types);
                        altField.types.forEach(e => typeSet.add(e));
                        existingField.types = Array.from(typeSet.values());
                    } else {
                        fields.push({ ...altField });
                    }
                }
                if (altFields.length === 0) {
                    alt.ruleCalls.forEach(e => ruleCalls.add(e));
                }
            }
            type.ruleCalls = Array.from(ruleCalls);
            types.push(type);
        }

        return types;
    }

    calculateAst(): Array<Type | Interface> {
        const types: Array<Type | Interface> = [];
        const flattened = this.flattenTypes(this.alternatives);

        for (const flat of flattened) {
            if (flat.ruleCalls.length > 0) {
                const type = new Type(flat.name, flat.ruleCalls);
                types.push(type);
            } else if (flat.fields.length > 0) {
                const type = new Interface(flat.name, flat.superType, flat.fields);
                types.push(type);
            }
        }

        return types;
    }

    private clean(value: string): string {
        if (value.startsWith("^")) {
            return value.substring(1);
        } else {
            return value;
        }
    }

}