import { Grammar } from '../gen/ast';
import { ValidationAcceptor, Validator } from './validator';

export class LangiumValidator extends Validator {

    constructor() {
        super();
        this.register(Grammar.type, this.validateName);
    }

    validateName(grammar: Grammar, acceptor: ValidationAcceptor): void {
        if (grammar.name) {
            const firstChar = grammar.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                acceptor.warning('Grammar names should start with an upper case letter.', 'name');
            }
        }
    }
}