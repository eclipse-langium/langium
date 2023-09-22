import { cp, mkdirSync } from "fs";

mkdirSync('./src/syntaxes');
mkdirSync('./src/worker');
const logError = (err) => {
    if (err) {
        console.error(err);
    }
};
cp('./out/syntaxes', './src/syntaxes', { recursive: true }, logError);
