# Contributing to Langium

Thank you for your interest in the Langium project! The following is a set of guidelines for contributing to Langium.

## Code of Conduct

This project is governed by the [Eclipse Community Code of Conduct](https://github.com/eclipse/.github/blob/master/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Eclipse Contributor Agreement

If you're planning to contribute to this or any other repository in the [`eclipse-langium` GitHub organization](https://github.com/eclipse-langium), please sign the [Eclipse Contributor Agreement (ECA)](https://www.eclipse.org/legal/ECA.php).

By signing the ECA you promise that your contributions adhere to the license used in the repository of the corresponding Eclipse project. This ensures that Langium can be used by any adopter without any legal issues.

For more information, see the [Eclipse Foundation Project Handbook](https://www.eclipse.org/projects/handbook/#resources-commit).

## Communication

The following communication channels are available:

 * [GitHub issues](https://github.com/eclipse-langium/langium/issues) – for bug reports, feature requests, etc.
 * [GitHub discussions](https://github.com/eclipse-langium/langium/discussions) – for questions, ideas, announcements, etc.
 * [Weekly dev meeting](https://github.com/eclipse-langium/langium/discussions/564?sort=new) – for project-related discussions
 * [Gitter chat](https://app.gitter.im/#/room/#langium:gitter.im) – for questions
 * [Developer mailing list](https://accounts.eclipse.org/mailing-list/langium-dev) – for organizational issues (e.g. elections of new committers)

In case you have a question, please look into the [documentation](https://langium.org/docs/) first. If you don't find any answer there, feel free to use the discussions or chat to get help.

## Prerequisites

For developing Langium, you require at least Node.js version 16 and at least npm version 7.7.0 to be able to use npm workspaces.

## Local Development Guide

We outline three use-cases:

1. Developing Langium itself
2. Developing your own language and use Langium as tool
3. Developing Langium itself and developing your own language in parallel.

The first two use-cases are the common ones. The third one is less common, but there are some recommendations you should know.

### Developing Langium

Development of Langium does not necessarily require VSCode ([download vscode](https://code.visualstudio.com/download)), but without it you will not be able to use the language server and its extension for VSCode.
Langium is an npm workspace project with multiple [packages](./packages). Once you cloned this repository, perform `npm install` and afterwards `npm run watch` either from your terminal of choice or from a terminal within VSCode.  The second command runs the TypeScript compiler (`tsc`) in watch mode which generates new JavaScript code every time you save a TypeScript file in one of the Langium packages.

Take a look at the examples readily available inside the repository to get started:

* [Arithmetics](./examples/arithmetics/README.md)
* [Domain Model](./examples/domainmodel/README.md)
* [State Machine](./examples/statemachine/README.md)

### Developing your own language

Please follow the instructions outlined in the [Langium package documentation](./packages/langium/README.md) to get started.

### Developing Langium and your own language in parallel

If for whatever reason you want to:

* Develop or change Langium locally
* Use your Langium changes in your own language project (independent of Langium repository)
* Debug all code in all projects

then you should follow some recommendations.

#### npm dependency resolution pitfalls

If you have long experience in using node and npm this sub-chapter will likely offer no new info an you can skip it. But, if you are more familiar with other languages, build and dependency management eco-systems then this sub-chapter could be helpful to you.

When you add a dependency to a `package.json` npm resolves this from the configured registry (default is [registry.npmjs.org](https://registry.npmjs.org/)). In other dependency management systems you can create something like a dev or snapshot version and install it locally, but this is not possible as such with npm. If you want to achieve a similar behavior you need to link your packages globally (global refers to you user's account scope, local refers to the project's scope). When you do this you forcefully overwrite what was downloaded from the npm registry. Incrementing the version of Langium itself will lead to problems, because npm will not be able to resolve those from its registry and therefore fail any install attempts in projects referring to Langium.

 If you execute `npm install` on the top-level of your Langium checkout all dependencies will be gathered locally inside `node_modules` and all four packages or sub-projects will be built. **Warning**: Do not run npm install directly inside the four Langium packages as it will mess up dependency resolution once you link packages globally.

#### Altered Langium for own language projects

There is an npm build target available (`npm run dev-build`) linking all Langium packages to your global scope. It unlinks and uninstalls the Langium packages from the global scope, deletes any `node_modules` folders below the packages directory (see warning above), afterwards performs `npm install` and then links all packages to the global scope again. Then your are able to use `yo langium` or `langium generate` containing your local Langium adjustments from everywhere with your local user.

A project you created with `yo langium` contains a dependency to `langium` (e.g. `2.0.0`) and a dev-dependency to `langium-cli`) inside `package.json` by default. Now, you have to link your own global Langium build to your own language project.
Issue the following commands in a shell from the root of your language project:

```shell
npm link -S langium
npm link -D langium-cli
```

The first command above will change the dependency entry for `langium` in `package.json` from:

```json
"langium": "X.Y.Z"
```

to

```json
"langium": "file:../langium/packages/langium"
```

assuming your local Langium checkout resides on the same level as your own language project.

#### Use VSCode workspace to simplify debugging

When debugging a project that depends on another project under development using a `code-workspace` makes life easier. Open an empty VSCode instance and *"Add Folder to Workspace..."* and add the Langium directory and your language project directory to the workspace. Save it with *"Save Workspace As..."*. It is recommended to have your language project and Langium itself reside on the same level on the same directory level.

**Reminder:** Don't forget to run `npm run watch` in your language project and the Langium package or any other package where you want to change code and see the effects when executing and debugging.

In `.vscode/launch.json` of your language project add the following launch configuration:

```json
    {
        "name": "Attach",
        "port": 6009,
        "request": "attach",
        "skipFiles": [
            "<node_internals>/**"
        ],
        "sourceMaps": true,
        "outFiles": [
            "${workspaceFolder}/out/**/*.js",
            "${workspaceFolder}/node_modules/langium"
        ],
        "type": "node"
    }
```

With the above configuration you can attach the debugger to the language server which effectively means you are able to debug your local version of Langium.

**Hint:** If you want to halt the language server start until you attach the debugger you have to change `--inspect=6009` to `--inspect-brk=6009` in the language project's `src/extension.ts` like shown below:

```javascript
const debugOptions = { execArgv: ['--nolazy', '--inspect-brk=6009'] };
```

## Release Process

The release process is mostly automated and requires running only a few commands.
After commiting, pushing, tagging and releasing the changes, a GitHub Action will publish all artifacts (npm packages and vscode extensions).

1. Pull the latest changes
2. Uplift the package versions
    * Run `npm version major|minor|patch --no-git-tag-version --workspaces`
3. Update the dependency versions
    * Run `npm run version:dependencies`
4. Update the generated files
    * Run `npm run langium:generate`
5. Create a PR with your updated changes, get a review and merge it
6. Create a version tag on the latest commit on `main` and push it
7. Create a GitHub release from the new tag (this will automatically publish all artifacts)
8. Close the corresponding GitHub milestone

In order to publish `next` versions from the current state of the `main` branch, use `npm run publish:next`, and don't update the `version` numbers manually as this is done by the npm script.
The changes must not be committed to the repository after publishing a `next` version.
Usually we don't publish `next` versions for the VS Code extension, only for the npm packages.
