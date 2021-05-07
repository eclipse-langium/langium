import { Grammar } from '../gen/ast';
import { Validator } from './validator';

export class LangiumValidator extends Validator {

    constructor() {
        super();
        this.register(Grammar.type, this.validateName);
    }

    validateName(grammar: Grammar): void {
        if (grammar.name) {
            const firstChar = grammar.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                this.warning(grammar, 'Grammar names should start with an upper case letter.', 'name');
            }
        }
    }
}