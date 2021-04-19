import { Action, Alternatives, AssignableAlternatives, AssignableTerminal, Assignment, Grammar, Group, ParserRule, RuleCall, UnorderedGroup } from "../gen/ast";
import { getTypeName } from "../grammar/grammar-utils";
import { CompositeGeneratorNode, IndentNode, NewLineNode } from "./node/node";
import { process } from "./node/node-processor";
import { Cardinality, isDataTypeRule, isOptionalCardinality } from "./utils";

type TypeAlternative = {
    name: string,
    super: string[],
    fields: Field[]
    ruleCalls: string[],
    hasAction: boolean
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
    superTypes: string[];
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = Array.from(new Set<string>(superTypes));
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.superTypes.length > 0 ? this.superTypes : [ "AstNode" ];
        interfaceNode.children.push("export interface ", this.name, " extends ", superTypes.join(", "), " {", new NewLineNode());
        const fieldsNode = new IndentNode(4);
        for (const field of this.fields) {
            fieldsNode.children.push(field.name, field.optional ? "?" : "", ": ", field.types.join(" | "), field.array ? "[]" : "", new NewLineNode());
        }
        interfaceNode.children.push(fieldsNode, "}", new NewLineNode(), new NewLineNode());
        interfaceNode.children.push("export namespace ", this.name, " {", new NewLineNode());
        const interfaceBody = new IndentNode(4);
        interfaceBody.children.push("export const kind: Kind = { value: Symbol('", this.name, "'), super: [ ", superTypes.join(".kind, "), ".kind ]}", new NewLineNode());
        const methodBody = new IndentNode(4);
        interfaceBody.children.push("export function is(item: any): item is ", this.name, " {", new NewLineNode(), methodBody, "}");
        methodBody.children.push("return AstNode.is(item, kind);", new NewLineNode());
        interfaceNode.children.push(interfaceBody, new NewLineNode(), "}", new NewLineNode());

        return process(interfaceNode);
    }
}

export function collectAst(grammar: Grammar): Array<Type | Interface> {
    const collector = new TypeCollector();

    const parserRules = grammar.rules.filter(e => e.kind === "ParserRule" && !e.fragment && !isDataTypeRule(e)).map(e => e as ParserRule);

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
        this.alternatives.push({ name, super: [], fields: [], ruleCalls: [], hasAction: false });
    }

    addAction(action: Action): void {
        if (action.Type !== this.currentAlternative.name) {
            this.currentAlternative.super.push(this.currentAlternative.name);
        }
        this.currentAlternative.hasAction = true;
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
        let card: Cardinality = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyConv = <any>assignment;
        if ('Cardinality' in anyConv) {
            card = <Cardinality>anyConv.Cardinality;
        }
        this.currentAlternative.fields.push({
            name: this.clean(assignment.Feature),
            array: assignment.Operator === "+=",
            optional: isOptionalCardinality(card) || this.isOptional(),
            types: assignment.Operator === "?=" ? ["boolean"] : this.findTypes(assignment.Terminal)
        });
    }

    addRuleCall(ruleCall: RuleCall): void {
        if (ruleCall.Rule.kind === "ParserRule" && ruleCall.Rule.fragment) {
            const collector = new TypeCollector();
            collectAlternatives(collector, ruleCall.Rule.Alternatives, ruleCall.Rule.Name);
            const types = collector.calculateAst();
            const type = types.find(e => e.name === ruleCall.Rule.Name);
            if (type) {
                this.currentAlternative.fields.push(...type.fields);
            }
        } else if (ruleCall.Rule.kind !== "TerminalRule") {
            this.currentAlternative.ruleCalls.push(getTypeName(ruleCall.Rule));
            this.lastRuleCall = ruleCall;
        }
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

    // TODO: Optimize/simplify this method
    protected flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
        const names = new Set<string>(alternatives.map(e => e.name));
        const types: TypeAlternative[] = [];

        for (const name of Array.from(names)) {
            const fields: Field[] = [];
            const ruleCalls = new Set<string>();
            const type = { name, fields, ruleCalls: <string[]>[], super: <string[]>[], hasAction: false };
            const namedAlternatives = alternatives.filter(e => e.name === name);
            for (const alt of namedAlternatives) {
                type.super.push(...alt.super);
                type.hasAction = type.hasAction || alt.hasAction;
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

    calculateAst(): Interface[] {
        const interfaces: Interface[] = [];
        const ruleCallAlternatives: TypeAlternative[] = [];
        const flattened = this.flattenTypes(this.alternatives);

        for (const flat of flattened) {
            if (flat.fields.length > 0 || flat.hasAction) {
                const type = new Interface(flat.name, flat.super, flat.fields);
                interfaces.push(type);
            }
            if (flat.ruleCalls.length > 0) {
                ruleCallAlternatives.push(flat);
            }
            // all other cases assume we have a data type rule
            // we do not generate an AST type for data type rules
        }

        for (const ruleCallType of ruleCallAlternatives) {
            let exists = false;
            for (const ruleCall of ruleCallType.ruleCalls) {
                const calledInterface = interfaces.find(e => e.name === ruleCall);
                if (calledInterface && calledInterface.name === ruleCallType.name) {
                    exists = true;
                } else if (calledInterface) {
                    calledInterface.superTypes.push(ruleCallType.name);
                }
            }
            if (!exists) {
                interfaces.push(new Interface(ruleCallType.name, ruleCallType.super, []));
            }
        }

        return interfaces;
    }

    private clean(value: string): string {
        if (value.startsWith("^")) {
            return value.substring(1);
        } else {
            return value;
        }
    }

}