# Forma Extension Examples

This folder contains example code for learning how to build Forma extensions.

## Available Examples

### [minimal/](./minimal/)

A ~50 line example demonstrating the 5 core Forma extension concepts:
- **Connect**: Initialize the SDK
- **Select**: Get user selection
- **Read**: Fetch geometry
- **Process**: Analyze data
- **Display**: Show results

Perfect for understanding the basics before diving into the full Floorplate implementation.

## Learning Path

1. **Start Here**: Read `minimal/README.md` and understand the 5 core concepts
2. **Try It**: Run the minimal example in Forma
3. **Modify**: Add your own analysis or visualization
4. **Level Up**: Study the full Floorplate source code

## Quick Start

```bash
# Serve the minimal example locally
cd examples/minimal
python -m http.server 8080
# Open http://localhost:8080
```

Or use any static file server of your choice.

## From Example to Production

The minimal example shows concepts but lacks:
- TypeScript for type safety
- Build system for optimization
- State management for complex UIs
- Error handling and edge cases

See the main `src/` folder for a production-ready implementation that addresses all these concerns.
