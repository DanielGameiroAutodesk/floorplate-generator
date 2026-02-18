# Contributing to Floorplate Generator

Thank you for your interest in contributing to the Floorplate Generator! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Questions?](#questions)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- Git
- A code editor (VS Code recommended)
- Basic understanding of TypeScript
- (Optional) Autodesk Forma account for testing

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/floorplate-generator.git
   cd floorplate-generator
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/DanielGameiroAutodesk/floorplate-generator.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check existing issues to avoid duplicates
2. Collect relevant information:
   - Browser and version
   - Forma version (if applicable)
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if helpful

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) when creating an issue.

### Suggesting Features

We welcome feature suggestions! Please:

1. Check existing issues and discussions first
2. Describe the problem your feature would solve
3. Explain your proposed solution
4. Consider alternatives you've thought about

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) when creating an issue.

### Code Contributions

#### Good First Issues

Look for issues labeled `good first issue` - these are great for newcomers!

#### Types of Contributions Welcome

- **Bug fixes**: Fix reported issues
- **Features**: Implement new functionality (discuss first in an issue)
- **Documentation**: Improve or add documentation
- **Tests**: Add or improve test coverage
- **Performance**: Optimize algorithms or rendering
- **Accessibility**: Improve UI accessibility

#### What to Work On

1. Check the [Issues](https://github.com/DanielGameiroAutodesk/floorplate-generator/issues) page
2. Comment on an issue to let others know you're working on it
3. For significant changes, open an issue first to discuss the approach

## Pull Request Process

### Before Submitting

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Keep your branch updated**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Make your changes** following our code style guidelines

4. **Write/update tests** for your changes

5. **Run the test suite**:
   ```bash
   npm test
   ```

6. **Run the linter**:
   ```bash
   npm run lint
   ```

7. **Test in Forma** if your changes affect the extension functionality

### Submitting Your PR

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub

3. **Fill out the PR template** completely:
   - Describe what the PR does
   - Link related issues
   - Include screenshots for UI changes
   - List testing steps

4. **Wait for review** - maintainers will review your PR and may request changes

### PR Requirements

- All tests must pass
- Linting must pass
- Code must be reviewed by at least one maintainer
- Significant features should include documentation updates

## Code Style Guidelines

### TypeScript

We use TypeScript with strict mode enabled. Follow these conventions:

```typescript
// Use explicit types for function parameters and return values
function calculateArea(width: number, height: number): number {
  return width * height;
}

// Use interfaces for object shapes
interface UnitConfig {
  type: string;
  area: number;
  isCornerEligible: boolean;
}

// Use const for immutable values
const DEFAULT_CORRIDOR_WIDTH = 1.524; // 5 feet in meters

// Use descriptive variable names
const maximumTravelDistanceFeet = 250;
// NOT: const mtd = 250;
```

### File Organization

- One class/major function per file when possible
- Group related files in directories
- Use index.ts files for public exports

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `storage-service.ts` |
| Classes | PascalCase | `FloorplateGenerator` |
| Interfaces | PascalCase | `UnitBlock` |
| Functions | camelCase | `generateFloorplate` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_CORRIDOR_WIDTH` |
| Variables | camelCase | `unitCount` |

### Comments

```typescript
// Use single-line comments for brief explanations
const area = width * height; // in square meters

/**
 * Use JSDoc for functions that are part of the public API.
 *
 * @param footprint - The building footprint polygon
 * @param config - Generation configuration
 * @returns Generated floorplate data
 */
function generateFloorplate(
  footprint: Polygon,
  config: GenerationConfig
): FloorplateData {
  // Implementation
}
```

### ESLint

We use ESLint for code quality. Run before committing:

```bash
npm run lint
```

To auto-fix issues:

```bash
npm run lint -- --fix
```

## Testing Guidelines

### Writing Tests

- Place tests next to source files: `generator.test.ts` alongside `generator.ts`
- Or in `__tests__` directories for larger test suites
- Use descriptive test names

```typescript
describe('FloorplateGenerator', () => {
  describe('generateFloorplate', () => {
    it('should create three layout options for a rectangular building', () => {
      // Test implementation
    });

    it('should respect minimum unit sizes', () => {
      // Test implementation
    });

    it('should add additional cores when egress requirements are not met', () => {
      // Test implementation
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test -- generator.test.ts
```

### Test Coverage

We aim for good test coverage, especially for:

- Core algorithm logic (`src/algorithm/`)
- Geometry utilities (`src/geometry/`)
- Critical business logic

## Documentation

### Code Documentation

- Add JSDoc comments to public functions and classes
- Explain complex algorithms with inline comments
- Keep comments up to date with code changes

### Project Documentation

If your changes affect:

- **User-facing features**: Update README.md
- **Architecture**: Update docs/ARCHITECTURE.md
- **Algorithm**: Update docs/ALGORITHM.md
- **Forma integration**: Update docs/FORMA_EXTENSION_GUIDE.md

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for L-shaped buildings

- Detect L-shaped footprints in geometry analysis
- Add wing detection algorithm
- Place cores at wing intersections
- Update tests for new functionality

Closes #42
```

Format:
- First line: type + brief description (50 chars max)
- Body: detailed explanation if needed
- Footer: reference issues

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system architecture, module dependencies, and design decisions.

## Questions?

- **General questions**: Open a [Discussion](https://github.com/DanielGameiroAutodesk/floorplate-generator/discussions)
- **Bug reports**: Open an [Issue](https://github.com/DanielGameiroAutodesk/floorplate-generator/issues)
- **Feature requests**: Open an [Issue](https://github.com/DanielGameiroAutodesk/floorplate-generator/issues) with the feature template

---

Thank you for contributing to Floorplate Generator!
