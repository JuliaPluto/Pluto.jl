# Pluto.jl Frontend

This directory contains the web-based frontend for [Pluto.jl](https://github.com/fonsp/Pluto.jl), a reactive notebook environment for Julia. The frontend provides an interactive web interface for creating, editing, and running Julia notebooks with real-time reactivity.

## About Pluto.jl

Pluto.jl is a simple reactive notebook for Julia that automatically updates cells when their dependencies change. Unlike traditional notebooks, Pluto notebooks are reactive, meaning that when you change a variable, all cells that depend on that variable automatically re-run. This creates a more dynamic and reliable computational environment.

Key features of Pluto:

- **Reactive execution**: Cells automatically re-run when their dependencies change
- **Clean dependency tracking**: No hidden state or execution order confusion
- **Lightweight and fast**: Built-in Julia with a modern web interface
- **Reproducible**: Notebooks include their own package environments
- **Interactive**: Built-in support for interactive widgets via `@bind`

## Frontend Architecture

The Pluto frontend is built with modern web technologies and provides a rich interactive experience:

- **JavaScript/TypeScript**: Core application logic
- **Preact**: Lightweight React-compatible UI framework
- **CodeMirror 6**: Advanced code editor with Julia syntax highlighting
- **WebSockets**: Real-time communication with the Julia backend
- **CSS Grid/Flexbox**: Responsive layout system

### Key Components

- **`editor.js`**: Main notebook editor interface and application entry point
- **`components/`**: Reusable UI components (cells, outputs, controls)
- **`common/`**: Shared utilities and connection management
- **`imports/`**: External library integrations and polyfills
- **`standalone/`**: Programmatic API library (Pluto Rainbow 🌈)

## Pluto Rainbow 🌈

**Pluto Rainbow** is a standalone JavaScript/TypeScript library that provides programmatic access to Pluto notebooks without requiring the full Editor UI. It's perfect for automation, testing, CI/CD pipelines, and building custom notebook interfaces.

### Features

- **Headless notebook execution**: Run Pluto notebooks programmatically
- **Real-time state synchronization**: Full compatibility with Pluto's reactive model
- **TypeScript support**: Complete type definitions included
- **WebSocket API**: Direct communication with Pluto backend, using message-pack for optimal, binary representation of types and firebase-y for network optimization
- **In-Notebook Execution**: Easily execute a Julia expression in Pluto's latest module (side effects will be lost)
- **Notebook parsing**: Parse and serialize Pluto `.jl` notebook files

### Quick Start

```javascript
import { Host, parse } from "@plutojl/rainbow";

// Connect to Pluto server
const host = new Host("http://localhost:1234");

// Create a new notebook worker
const worker = await host.createWorker(`
### A Pluto.jl notebook ###
# v0.19.40

x = 1 + 1
`);

// Add and run cells
const cellId = await worker.addSnippet(0, "println(x)");

// Listen for updates
worker.onUpdate((event) => {
  console.log("Update:", event.type, event.data);
});

// Get notebook state
const state = worker.getState();
console.log("Current cells:", state.cell_order);
```

### API Overview

**Host Class**: Main interface for connecting to Pluto servers

- `new Host(server_url)` - Connect to a Pluto server
- `host.workers()` - Get list of running notebooks
- `host.worker(notebook_id)` - Get/create worker for specific notebook
- `host.createWorker(notebook_text)` - Create new notebook from text

**Worker Class**: Interface for individual notebook instances

- `worker.connect()` - Establish WebSocket connection
- `worker.execute()` - Execute code in the latest worker Module. Best for pure operations. Returns `[success:boolean, result:any]`. Only works for simple types.
- `worker.waitSnippet(index, code)` - Add new snippet and wait for its result. Supports full Pluto output
- `worker.addSnippet(index, code)` - Async version of the above, returns cell id when the server gets the request
- `worker.updateSnippetCode(cell_id, code)` - Update cell code
- `worker.getSnippets()` - Get all cells
- `worker.onUpdate(callback)` - Listen for state changes
- `worker.shutdown()` - Shutdown notebook process

**Parser Functions**: Parse and serialize Pluto notebook files

- `parse(notebook_text)` - Parse `.jl` file to NotebookData
- `serialize(notebook_data)` - Convert NotebookData back to `.jl` format

### Use Cases

- **Automated Testing**: Run notebook tests in CI/CD pipelines
- **Batch Processing**: Execute notebooks with different parameters
- **Custom UIs**: Build specialized interfaces for specific workflows
- **Integration**: Embed Pluto functionality in other applications
- **Analysis Tools**: Extract data and results from notebook executions

# Integrations

## Node.js integration

To use from node.js, you need a special browser polyfill, based on jsdom:

You need to import this (for its side-effects) first, as below:


```
import "@plutojl/rainbow/node-polyfill"
import { Host, Worker } from "@plutojl/rainbow"
// [...]
```

## React integration

We provide three react hooks: 

```js
import { Host, Worker } from "@plutojl/rainbow"
import { RainbowProvider, usePlutoRainbow, useSnippetState, useSnippetLogs } from "@plutojl/rainbow/react"

```

- **RainbowProvider** provides a host and a worker context, along with setter and getter methods
- **usePlutoRainbow** provides these valus
- **useSnippetState** returns the state of the snippet of a worker, by id
- **useSnippetLogs** returns the logs of the snippet of a worker, by id

## Development

### Building the Frontend

The full frontend is built using a custom bundler setup:

```bash
# Build production assets
cd ../frontend-bundler && npm run build
```

While to build the standalone library, run

```bash
npm run build
```

Note that this will not generate code for any React elements.

### Testing

```bash
# Run frontend tests
cd test/frontend && npm test
```

### Project Structure

```
frontend/
├── editor.js              # Main application entry point
├── components/            # React components
│   ├── Cell.js           # Individual notebook cells
│   ├── CellInput/        # Code editor components
│   ├── CellOutput.js     # Cell output rendering
│   └── ...
├── common/               # Shared utilities
│   ├── PlutoConnection.js # WebSocket communication
│   └── ...
├── imports/              # External libraries
├── standalone/           # Pluto Rainbow 🌈 library
│   ├── index.js         # Main exports
│   ├── client.js        # Host/Worker classes
│   └── parser.js        # Notebook file parser
│   └── ...
└── themes/              # CSS themes (light/dark)
```

## Contributing

See the main [CONTRIBUTING.md](../CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
