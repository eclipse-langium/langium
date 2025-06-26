sed -E -i '' 's/{ name: '\''([a-zA-Z0-9]+)'\'', type:/\1: { name: '\''\1'\'', type:/' packages/langium/src/languages/generated/ast.ts
# negative lookbehind does not work: (?<!: )
#sed -E -i '' 's/old/new/' packages/langium/src/languages/generated/ast.ts
