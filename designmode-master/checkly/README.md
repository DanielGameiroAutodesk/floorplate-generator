# Checkly and Playwright

We use Checkly to continuously monitor the app. Browser
checks in Checkly uses Playwright to run the tests.

We also use Playwright directly to run tests against localhost,
which is also done in CI.

Useful resources:

- https://www.checklyhq.com/docs/cli/
- https://checklyhq.com/docs
- https://www.checklyhq.com/docs/cli/npm-packages/

## Running Playwright tests using localhost

```bash
pnpm install
pnpm playwright install chromium

# Login with your Autodesk account.
pnpm checkly login

# This will build and run the preview local server if you're
# not running a local devserver already.
pnpm test-local --ui
```

See `playwright.config.js` for what environment variables can be set
to test against a different env/project.

By default it will use credentials from Checkly and login as the Checkly user,
just as if the test run from Checkly itself.

## Running Checkly tests from local

All Checkly tests runs from Checkly's cloud infrastructure,
so it can only run against a deployed app. This is still useful
to verify changes to Checkly tests itself.

The `test` run-script uses `checkly test` under the hood. You can
pass regular Checkly arguments.

```bash
pnpm install

# Login with your Autodesk account.
pnpm checkly login

# List tests.
pnpm run test --list

# Run all tests.
pnpm run test
```

## Deploying changes

Automatically done when pushed to `master`.

To do a manual deploy:

```bash
pnpm run deploy
```
