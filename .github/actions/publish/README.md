# Publish updated packages

A GitHub Action that publishes npm packages, VS Code extensions, and Open VSX extensions — but only when the local version is newer than what is already published.

## Usage

```yaml
- name: Publish
  uses: ./.github/actions/publish
  with:
    npm-packages: |
      packages/my-lib
      packages/my-cli
    vscode-packages: |
      packages/my-extension
    vsce-token: ${{ secrets.VSCE_TOKEN }}
    ovsx-token: ${{ secrets.OVSX_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `npm-packages` | No | `''` | Newline-separated package directories to publish to npm. |
| `vscode-packages` | No | `''` | Newline-separated extension directories to publish to VS Marketplace and Open VSX. |
| `dry-run` | No | `false` | Log what would be published without actually publishing. |
| `npm-token` | No | `''` | npm auth token. Leave empty to use OIDC trusted publishing with `--provenance`. |
| `vsce-token` | No | `''` | VS Marketplace personal access token. |
| `ovsx-token` | No | `''` | Open VSX access token. |

## NPM authentication

By default the action publishes with `--provenance --access public`, relying on OIDC trusted publishing. To use that, the calling workflow needs:

```yaml
permissions:
  id-token: write
```

Alternatively, pass an explicit `npm-token` to use token-based authentication.

## Prerequisites

- Node.js must already be set up in the job (e.g. via `actions/setup-node`).
- For npm publishing with `--provenance`, `setup-node` should include `registry-url: 'https://registry.npmjs.org'`.
- `vsce` and `ovsx` must be available (e.g. as devDependencies and installed via `npm ci`).
