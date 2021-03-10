export function replaceTokens(input: string): string {
    let result = input.substring(1, input.length - 1);
    result = result.replace(/:/g, "Colon");
    result = result.replace(/\./g, "Dot");
    result = result.replace(/\//g, "Slash");
    result = result.replace(/,/g, "Comma");
    result = result.replace(/\(/g, "ParenthesisOpen");
    result = result.replace(/\)/g, "ParenthesisClose");
    result = result.replace(/\[/g, "BracketOpen");
    result = result.replace(/\]/g, "BracketClose");
    result = result.replace(/\{/g, "CurlyOpen");
    result = result.replace(/\}/g, "CurlyClose");
    result = result.replace(/\+/g, "Plus");
    result = result.replace(/\*/g, "Asterisk");
    result = result.replace(/\?/g, "QuestionMark");
    result = result.replace(/\!/g, "ExclamationMark");
    result = result.replace(/\^/g, "Caret");
    result = result.replace(/</g, "LessThan");
    result = result.replace(/>/g, "MoreThan");
    result = result.replace(/&/g, "Ampersand");
    result = result.replace(/\|/g, "Pipe");
    result = result.replace(/=/g, "Equals");
    result = result.replace(/\-/g, "Dash");
    result = result.replace(/;/g, "Semicolon");
    result = result.replace(/@/g, "At");
    result = result[0].toUpperCase() + result.substring(1);
    return result;
}