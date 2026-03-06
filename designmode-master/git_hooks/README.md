# How to setup local automated testing

Local tests can be run automatically when files change in certain monitored folders. These 3D sketch tests are executed locally because the necessary GPU hardware resources for efficient 3D rendering are not readily available in cloud-based services such as GitHub and AWS without incurring additional costs and maintenance.

## Proposal Access

Go to the following proposal and be sure you can open 3d sketch: https://app.autodeskforma.eu/designmode/pro_lze2pawcjj/cf18d3b6-f742-4362-9f41-3e292ae60570

> **WARNING: DO NOT MODIFY THE ORIGINAL TEST PROPOSAL!**

## Setup playwright/test scripts

### Change into checkly directory

Since all tests are run from the checkly directory, change into that directory first:

```bash
cd checkly
```

### Install modules

```bash
pnpm install
```

### Install playwright chromium

```bash
pnpm playwright install chromium
```

### Add spacemaker-cli to PATH

Since the test scripts depend on the `spacemaker-cli` application to fetch authorization tokens, ensure its location is added to your system's `PATH` or other environment variable.

## Test the script

To run the tests before linking them, use this command:

```bash
pnpm test3ds
```

## Debug the scripts

If you see a problem or cannot successfully run the tests, run the test in debug mode:

```bash
pnpm test3ds --debug
```

## Debug the global setup and teardown scripts

If you see a problem with the global setup or teardown steps, run the test with the following debug flag:

```bash
PWDEBUG=1 pnpm test3ds
```

## Symlink pre-push hook

Once the tests run successfully, create a symlink in the `.git/hooks` folder to the pre-push hook.

### macOS

1. Open your terminal.
2. Navigate to the root of your Git repository:
   ```bash
   cd /path/to/your/repo
   ```
3. Create a symlink from the `git_hooks/pre-push` file to the `.git/hooks` directory:
   ```bash
   ln -s ../../git_hooks/pre-push .git/hooks/pre-push
   ```
4. Verify that the symlink was created successfully:
   ```bash
   ls -l .git/hooks/pre-push
   ```

### Windows

1. Open Command Prompt or PowerShell.
2. Navigate to the root of your Git repository:
   ```cmd
   cd \path\to\your\repo
   ```
3. Create a symlink from the `git_hooks/pre-push` file to the `.git/hooks` directory:
   ```cmd
   mklink .git\hooks\pre-push ..\..\git_hooks\pre-push
   ```
4. Verify that the symlink was created successfully:
   ```cmd
   dir .git\hooks\pre-push
   ```

### Alternative: Copy the hook file directly

If you prefer not to use symlinks, you can copy the pre-push hook file directly into the `.git/hooks` folder. However, you will need to re-copy the git hook if any changes are made.

## Test the hook

To test run whether the pre-push hook will work, simply run the command directly:

```bash
./git_hooks/pre-push
```
