# Kaggle-MCP: Enhanced Kaggle API Integration for Claude Code

```
     ██╗  ██╗ █████╗  ██████╗  ██████╗ ██╗     ███████╗       ███╗   ███╗ ██████╗██████╗
     ██║ ██╔╝██╔══██╗██╔════╝ ██╔════╝ ██║     ██╔════╝       ████╗ ████║██╔════╝██╔══██╗
     █████╔╝ ███████║██║  ███╗██║  ███╗██║     █████╗         ██╔████╔██║██║     ██████╔╝
     ██╔═██╗ ██╔══██║██║   ██║██║   ██║██║     ██╔══╝  ████─  ██║╚██╔╝██║██║     ██╔═══╝
     ██║  ██╗██║  ██║╚██████╔╝╚██████╔╝███████╗███████╗       ██║ ╚═╝ ██║╚██████╗██║
     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝╚══════╝       ╚═╝     ╚═╝ ╚═════╝╚═╝
```

**Enhanced Kaggle-MCP** connects Claude Code to the Kaggle API through the Model Context Protocol (MCP), enabling automated machine learning workflows with a complete **push→run→fetch** cycle for Kaggle kernels.

## 🚀 What This Enables

- **Automated Kernel Development**: Create, edit, and deploy Kaggle notebooks programmatically
- **Competition Research**: Analyze leaderboards, download data, and study top solutions
- **Real-time Monitoring**: Track kernel execution status and automatically fetch results
- **Error Analysis**: Automatically detect and debug execution errors
- **Iterative Workflows**: Seamlessly improve models based on performance feedback

## 📋 Prerequisites

Before you begin, ensure you have:

- **VS Code** with the **Claude Code extension** installed
- **Python 3.8+** on your system
- A **Kaggle account** with API credentials
- **Git** (for cloning this repository)

> **Note**: This guide is specifically for **Claude Code** (VS Code extension), not Claude Desktop.

## 🛠️ Quick Setup Guide

### Step 1: Clone and Install

```bash
# Clone this enhanced version
git clone https://github.com/yakuraku/kaggle-mcp.git
cd kaggle-mcp

# Install dependencies
pip install -e .
pip install nbformat
```

### Step 2: Get Kaggle API Credentials

1. Go to your [Kaggle Account Settings](https://www.kaggle.com/settings/account)
2. Scroll to the **API** section
3. Click **"Create New API Token"**
4. Download the `kaggle.json` file
5. Place it in the correct location:
   - **Windows**: `C:\Users\<username>\.kaggle\kaggle.json`
   - **macOS/Linux**: `~/.kaggle/kaggle.json`
6. Set permissions (macOS/Linux only): `chmod 600 ~/.kaggle/kaggle.json`

### Step 3: Configure Claude Code

Create or edit `.mcp.json` in your project folder:

```json
{
  "mcpServers": {
    "kaggle": {
      "command": "python",
      "args": ["-m", "kaggle_mcp.server"],
      "cwd": "/absolute/path/to/your/kaggle-mcp"
    }
  }
}
```

**Windows Example:**
```json
{
  "mcpServers": {
    "kaggle": {
      "command": "python",
      "args": ["-m", "kaggle_mcp.server"],
      "cwd": "D:\\Projects\\kaggle-mcp"
    }
  }
}
```

**macOS/Linux Example:**
```json
{
  "mcpServers": {
    "kaggle": {
      "command": "python",
      "args": ["-m", "kaggle_mcp.server"],
      "cwd": "/Users/username/Projects/kaggle-mcp"
    }
  }
}
```

### Step 4: Restart VS Code

**Close VS Code completely** and restart it to load the new MCP server.

### Step 5: Test the Connection

Open Claude Code in VS Code and ask:

```
"Are you connected to any MCP servers? Can you see kaggle tools?"
```

Claude should respond with access to **50+ Kaggle tools** including enhanced workflow features.

## 🔧 Enhanced Features

### 🎯 Core Workflow Tools

| Tool | Description |
|------|-------------|
| `kernel_push_and_watch` | Upload kernel and monitor execution until completion |
| `kernel_set_metadata` | Advanced metadata management with validation |
| `notebook_insert_cell` | Precisely insert cells into Jupyter notebooks |
| `notebook_patch` | Apply JSON Patch operations to modify notebooks |
| `kernel_analyze_errors` | Automatically analyze and suggest fixes for errors |

### 🆕 Extended Features

| Category | New Capabilities |
|----------|------------------|
| **Lifecycle Management** | `kernel_delete` - Programmatically delete kernels with safety checks |
| **Advanced Discovery** | Enhanced `kernels_list` with `mine=True`, competition, and dataset filtering |
| **Production Deployment** | `kernel_push` with timeout control for reliable execution windows |
| **Data Export** | `kernel_list_files` with CSV format for reporting and analysis |
| **Reliable Operations** | `kernel_output` with `force=True` for automated pipeline workflows |

### 📊 Research & Analysis Tools

| Category | Tools Available |
|----------|-----------------|
| **Competitions** | List, download data, view leaderboards, get details |
| **Datasets** | Search, download, create, manage versions |
| **Kernels** | Create, edit, push, monitor, debug, analyze |
| **Models** | Browse, download, manage pre-trained models |

### 🚀 Automated Workflows

**Complete ML Pipeline Example:**
```
1. Research competition → 2. Download data → 3. Create notebook →
4. Push to Kaggle → 5. Monitor execution → 6. Analyze errors →
7. Fix and iterate → 8. Submit results
```

## 💡 Example Conversations

**Getting Started:**
```
"Show me the top 5 active Kaggle competitions and help me choose one to work on"
```

**Competition Research:**
```
"Download the Titanic competition data and analyze the top 3 notebooks on the leaderboard"
```

**Automated Development:**
```
"Create a kernel for house prices prediction with XGBoost, push it to Kaggle, and monitor the execution"
```

**Error Debugging:**
```
"My kernel failed execution. Can you analyze the errors and fix the issues?"
```

## 📖 Complete Examples

For detailed examples and tutorials, see **[EXAMPLES.md](EXAMPLES.md)** and **[FAQ.md](FAQ.md)** including:

- 🏆 **Competition Research Workflow**: Analyze leaderboards and study winning solutions
- 🤖 **Automated Model Development**: End-to-end ML pipeline creation
- 🔍 **Error Analysis & Debugging**: Systematic error detection and fixing
- 📊 **Data Exploration Automation**: Automated EDA and feature engineering
- 🔄 **Iterative Improvement**: Performance optimization workflows
- ⚠️ **Critical Usage Notes**: Competition URLs, data access, notebook visibility
- 🔗 **MCP Integrations**: Sequential Thinking MCP pairing and optimization tips

## 🐛 Troubleshooting

### Common Issues

**MCP Server Not Connected:**
- Verify the `cwd` path in `.mcp.json` is absolute and correct
- Ensure Python can find the `kaggle_mcp` module
- Check that all dependencies are installed: `pip list | grep -E "(mcp|kaggle|nbformat)"`

**Authentication Errors:**
- Verify `kaggle.json` is in the correct location with proper permissions
- Test manually: `python -c "from kaggle import KaggleApi; KaggleApi().authenticate()"`

**Import Errors:**
- Install missing dependencies: `pip install nbformat`
- Ensure you're in the correct Python environment

### Debug Mode

Enable verbose logging by modifying `.mcp.json`:

```json
{
  "mcpServers": {
    "kaggle": {
      "command": "python",
      "args": ["-m", "kaggle_mcp.server", "--debug"],
      "cwd": "/path/to/kaggle-mcp"
    }
  }
}
```

## 🎓 What is MCP?

**Model Context Protocol (MCP)** is a standard for connecting AI assistants to external tools and data sources. This Kaggle-MCP server acts as a bridge between Claude Code and the Kaggle API, enabling:

- **Tool Integration**: Access to 50+ Kaggle API functions
- **Real-time Communication**: Live data exchange during conversations
- **Stateful Operations**: Persistent connections for complex workflows
- **Secure Authentication**: Encrypted credential handling

Think of it as giving Claude Code "hands" to interact with Kaggle directly!

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This enhanced version builds upon the excellent foundation created by **[@54yyyu](https://github.com/54yyyu)** in the original [kaggle-mcp](https://github.com/54yyyu/kaggle-mcp) project.

### Original Features by 54yyyu:
- Core Kaggle API integration
- Basic MCP server implementation
- Authentication system
- Competition, dataset, and kernel tools
- Installation and setup utilities

### Enhanced Features Added:
- **Complete push→run→fetch workflow** with `kernel_push_and_watch`
- **Advanced notebook editing** with `notebook_insert_cell` and `notebook_patch`
- **Intelligent metadata management** with validation and templates
- **Automated error analysis** with `kernel_analyze_errors`
- **Real-time execution monitoring** and status tracking
- **Enhanced documentation** with practical examples and tutorials
- **Improved Claude Code integration** with detailed setup guides

The original project provided the solid foundation that made these advanced workflow features possible. Special thanks to 54yyyu for creating and open-sourcing the initial Kaggle-MCP implementation!

## 🔗 Links

- **This Enhanced Project**: [yakuraku/kaggle-mcp](https://github.com/yakuraku/kaggle-mcp)
- **Original Project**: [54yyyu/kaggle-mcp](https://github.com/54yyyu/kaggle-mcp)
- **Claude Code**: [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code)
- **Sequential Thinking MCP**: [Recommended Pairing](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)
- **Kaggle API**: [Official Documentation](https://github.com/Kaggle/kaggle-api)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Ready to revolutionize your Kaggle workflow?** 🚀

📚 **[Get started with EXAMPLES.md](EXAMPLES.md)** | ❓ **[Check FAQ.md for common issues](FAQ.md)**