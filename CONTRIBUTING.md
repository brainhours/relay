# Contributing to Relay

First off, thank you for considering contributing to Relay! It's people like you that make Relay such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, configuration)
- **Describe the behavior you observed and what you expected**
- **Include logs and error messages**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing style
6. Issue the pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/relay.git
cd relay

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint
```

## Project Structure

```
relay/
├── packages/
│   └── core/              # @brainhours/relay-core package
│       └── src/
│           ├── providers/ # Provider implementations
│           ├── events/    # Event system
│           ├── queue/     # Queue helpers
│           └── utils/     # Utilities
├── examples/              # Usage examples
└── docs/                  # Documentation
```

## Coding Guidelines

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write meaningful commit messages

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests when relevant

## Adding a New Provider

1. Create a new directory under `packages/core/src/providers/`
2. Implement the `BaseProvider` interface
3. Add webhook parsing support
4. Add documentation
5. Add an example

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing!
