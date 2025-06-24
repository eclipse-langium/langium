type AbstractRule = InfixRule | ParserRule | TerminalRule;

type AbstractType = InferredType | InfixRule | Interface | ParserRule | Type;

type Associativity = "left" | "right";

type Condition = BooleanLiteral | Conjunction | Disjunction | Negation | ParameterReference;

type FeatureName = "assoc" | "current" | "entry" | "extends" | "false" | "fragment" | "grammar" | "hidden" | "import" | "infer" | "infers" | "infix" | "interface" | "left" | "on" | "returns" | "right" | "terminal" | "true" | "type" | "with" | PrimitiveType | string;

type PrimitiveType = "Date" | "bigint" | "boolean" | "number" | "string";

type TypeDefinition = ArrayType | ReferenceType | SimpleType | UnionType;

type ValueLiteral = ArrayLiteral | BooleanLiteral | NumberLiteral | StringLiteral;

interface AbstractElement {
    cardinality?: "*" | "+" | "?";
    // parenthesized: boolean;
}

interface ArrayLiteral {
    elements: ValueLiteral[];
}

interface ArrayType {
    elementType: TypeDefinition;
}

interface BooleanLiteral {
    true: boolean;
}

interface Conjunction {
    left: Condition;
    right: Condition;
}

interface Disjunction {
    left: Condition;
    right: Condition;
}

interface Grammar {
    imports: GrammarImport[];
    interfaces: Interface[];
    isDeclared: boolean;
    name?: string;
    rules: AbstractRule[];
    types: Type[];
}

interface GrammarImport {
    path: string;
}

interface InferredType {
    name: string;
}

interface InfixRule {
    call: RuleCall;
    name: string;
    operators: InfixRuleOperators;
    parameters: Parameter[];
}

interface InfixRuleOperatorList {
    associativity?: Associativity;
    operators: Keyword[];
}

interface InfixRuleOperators {
    precedences: InfixRuleOperatorList[];
}

interface Interface {
    attributes: TypeAttribute[];
    name: string;
    superTypes: @AbstractType[];
}

interface NamedArgument {
    calledByName: boolean;
    parameter?: @Parameter;
    value: Condition;
}

interface Negation {
    value: Condition;
}

interface NumberLiteral {
    value: number;
}

interface Parameter {
    name: string;
}

interface ParameterReference {
    parameter: @Parameter;
}

interface ParserRule {
    dataType?: PrimitiveType;
    definition: AbstractElement;
    entry: boolean;
    fragment: boolean;
    inferredType?: InferredType;
    name: string;
    parameters: Parameter[];
    returnType?: @AbstractType;
}

interface ReferenceType {
    referenceType: TypeDefinition;
}

interface ReturnType {
    name: PrimitiveType | string;
}

interface SimpleType {
    primitiveType?: PrimitiveType;
    stringType?: string;
    typeRef?: @AbstractType;
}

interface StringLiteral {
    value: string;
}

interface TerminalRule {
    definition: TerminalElement;
    fragment: boolean;
    hidden: boolean;
    name: string;
    type?: ReturnType;
}

interface Type {
    name: string;
    type: TypeDefinition;
}

interface TypeAttribute {
    defaultValue?: ValueLiteral;
    isOptional: boolean;
    name: FeatureName;
    type: TypeDefinition;
}

interface UnionType {
    types: TypeDefinition[];
}

interface Action extends AbstractElement {
    feature?: FeatureName;
    inferredType?: InferredType;
    operator?: "+=" | "=";
    type?: @AbstractType;
}

interface Alternatives extends AbstractElement {
    elements: AbstractElement[];
}

interface Assignment extends AbstractElement {
    feature: FeatureName;
    operator: "+=" | "=" | "?=";
    predicate?: "->" | "=>";
    terminal: AbstractElement;
}

interface CharacterRange extends TerminalElement {
    left: Keyword;
    right?: Keyword;
}

interface CrossReference extends AbstractElement {
    deprecatedSyntax: boolean;
    terminal?: AbstractElement;
    type: @AbstractType;
}

interface EndOfFile extends AbstractElement {
}

interface Group extends AbstractElement {
    elements: AbstractElement[];
    guardCondition?: Condition;
    predicate?: "->" | "=>";
}

interface Keyword extends AbstractElement {
    predicate?: "->" | "=>";
    value: string;
}

interface NegatedToken extends TerminalElement {
    terminal: AbstractElement;
}

interface RegexToken extends TerminalElement {
    regex: string;
}

interface RuleCall extends AbstractElement {
    arguments: NamedArgument[];
    predicate?: "->" | "=>";
    rule: @AbstractRule;
}

interface TerminalAlternatives extends TerminalElement {
    elements: AbstractElement[];
}

interface TerminalElement extends AbstractElement {
    lookahead?: "?!" | "?<!" | "?<=" | "?=";
}

interface TerminalGroup extends TerminalElement {
    elements: AbstractElement[];
}

interface TerminalRuleCall extends TerminalElement {
    rule: @TerminalRule;
}

interface UnorderedGroup extends TerminalElement {
    elements: AbstractElement[];
}

interface UntilToken extends TerminalElement {
    terminal: AbstractElement;
}

interface Wildcard extends TerminalElement {
}

