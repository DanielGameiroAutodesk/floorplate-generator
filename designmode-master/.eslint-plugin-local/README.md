# Custom ESLint rules

Useful resources to help working with this:

- https://astexplorer.net/

  Understand what AST nodes exists based on the code you have.
  Change the parser to `@typescript-eslint/parser` or `espree` (native ESLint)
  depending on what rule you are working on.

- Writing rules using `@typescript-eslint`:

  https://typescript-eslint.io/developers/custom-rules

  Using this over native ESLint rules allows us to write TypeScript-aware
  rules that can use the inferred types from TypeScript. For instance
  this allows us to know if a variable represents a Preact signal.

- Writing native ESLint rules:

  https://eslint.org/docs/latest/extend/custom-rules

## Performance debugging

To debug potential performance problems, run linting with:

```
TIMING=1 pnpm lint
```

See https://eslint.org/docs/latest/extend/custom-rules#profile-rule-performance for more details.

Be aware that caching might show a slightly incorrect picture of
the various rules. E.g. some rules do a lot of file system lookups
to resolve files, and this penalty is typically visible only for
the first rule. Example of this is `local/import-src-path` vs
`import/no-restricted-paths`. Similar applies to rules that uses
the type checker.
