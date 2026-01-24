# jessewilliams_ai-service

[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.115-009485)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

A production-grade **AI Real Estate Investment Assistant** powered by FastAPI and OpenAI. This service provides intelligent deal analysis, offer outreach, and underwriting capabilities using advanced language models with enterprise-grade security and scalability.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🎯 **Deal Hunter Agent** - Analyzes real estate opportunities and identifies promising deals with market insights
- 📧 **Offer Outreach Agent** - Generates professional, personalized outreach communications
- 📊 **Underwriting Analyzer** - Provides detailed financial analysis and comprehensive risk assessment
- 📄 **Multi-Format Export** - Exports analysis results in PDF, Excel, Word, and PowerPoint formats
- 🔐 **Enterprise Security** - Internal API key authentication with bcrypt password hashing
- ⚡ **High Performance** - Async/await patterns for handling concurrent requests at scale
- 🔄 **Stateful Processing** - Memory management for maintaining conversation context
- 🌐 **Web Integration** - Real-time web search capabilities for market research

## Quick Start

### TL;DR (macOS/Linux)

```bash
# Clone, setup, and run in 30 seconds
git clone <repository-url> && cd jessewilliams_ai-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your OpenAI API key
uvicorn app.main:app --reload
```

Visit http://localhost:8000/docs to explore the API.

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | FastAPI | 0.115.x |
| **Server** | Uvicorn | 0.30.x |
| **Language Model** | LangChain + OpenAI | 0.3.x |
| **Database** | PostgreSQL + SQLAlchemy | 2.0.x |
| **Authentication** | Python-Jose + Bcrypt | 3.3.0 |
| **Data Processing** | Pandas + NumPy | 2.2.x / 2.1.x |
| **Document Export** | ReportLab, python-docx, xlsxwriter, python-pptx | Latest |

## System Requirements

### Minimum Requirements

- **Python**: 3.8+ (Recommended: 3.11 LTS)
- **RAM**: 2GB minimum (4GB+ recommended)
- **Disk Space**: 500MB for installation + dependencies
- **OS**: Windows, macOS, or Linux

### External Dependencies

- **OpenAI API Account** - Required for LLM functionality ([Get API Key](https://platform.openai.com/api-keys))
- **PostgreSQL 12+** - Optional, for production database (SQLite works for development)
- **Git** - For repository cloning

### Platform-Specific Setup

#### Windows

```powershell
# Verify Python installation
python --version  # Should be 3.8+
pip --version

# If not installed, download from: https://www.python.org/downloads/
# Or use: winget install Python.Python.3.11
```

#### macOS

```bash
# Using Homebrew (recommended)
brew install python3 python3-pip

# Verify installation
python3 --version
pip3 --version
```

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Python 3.8+** (Recommended: Python 3.11 or higher)
- **pip** (Python package installer)
- **Git** (for cloning the repository)
- **OpenAI API Key** (for LLM functionality)

### System-Specific Prerequisites

**Windows:**
```bash
# Python installation via Microsoft Store or python.org
# Verify installation
python --version
pip --version
```

**macOS/Linux:**
```bash
# Using Homebrew (macOS)
brew install python3

# Using apt (Ubuntu/Debian)
sudo apt-get install python3 python3-pip python3-venv

# Verify installation
python3 --version
pip3 --version
```

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd jessewilliams_ai-service
```

### Step 2: Create Virtual Environment

A virtual environment isolates project dependencies from your system Python.

**Windows:**
```bash
# Create the virtual environment
python -m venv venv

# Activate the virtual environment
venv\Scripts\activate
```

**macOS/Linux:**
```bash
# Create the virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate
```

Once activated, your terminal prompt should show `(venv)` at the beginning.

### Step 3: Upgrade pip (Optional but Recommended)

```bash
# Windows
python -m pip install --upgrade pip

# macOS/Linux
python3 -m pip install --upgrade pip
```

### Step 4: Install Dependencies

```bash
pip install -r requirements.txt
```

This will install all required packages including:
- FastAPI and Uvicorn
- LangChain and OpenAI integration
- Database drivers (AsyncPG, SQLAlchemy)
- Document generation libraries
- All other dependencies listed in requirements.txt

### Step 5: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy template (if available)
cp .env.example .env

# Or create new file
touch .env  # macOS/Linux
# or
type > .env  # Windows
```

**Edit `.env` with your configuration:**

```env
# ============================================
# REQUIRED: OpenAI Configuration
# ============================================
OPENAI_API_KEY=sk-your_api_key_here

# ============================================
# SECURITY: API Protection
# ============================================
INTERNAL_API_SECRET=your_strong_secret_key_here_min_32_chars

# ============================================
# DATABASE: PostgreSQL (Production)
# ============================================
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/jessewilliams_db

# ============================================
# API SERVER: Configuration
# ============================================
API_HOST=0.0.0.0
API_PORT=8000
API_ENVIRONMENT=development

# ============================================
# LOGGING: Optional
# ============================================
LOG_LEVEL=info
```

⚠️ **IMPORTANT**: Add `.env` to `.gitignore` - **Never commit secrets to version control!**

```bash
echo ".env" >> .gitignore
```

## Configuration

### Environment Variables Reference

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | ✅ | OpenAI API authentication | `sk-...` |
| `INTERNAL_API_SECRET` | ✅ | API security key (32+ chars) | `your_secret_key` |
| `DATABASE_URL` | ❌ | Database connection string | `postgresql+asyncpg://...` |
| `API_HOST` | ❌ | Server host binding | `0.0.0.0` |
| `API_PORT` | ❌ | Server port | `8000` |
| `API_ENVIRONMENT` | ❌ | Environment type | `development` or `production` |

## Running the Service

### Standard Startup (Development)

Ensure the virtual environment is activated:

```bash
uvicorn app.main:app --reload
```

The `--reload` flag enables hot-reloading on code changes (dev only).

### Production Deployment

```bash
# Run with multiple workers for production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Advanced Configuration

```bash
# Custom host and port
uvicorn app.main:app --host 127.0.0.1 --port 9000

# Verbose logging
uvicorn app.main:app --log-level debug

# Without auto-reload
uvicorn app.main:app --reload=false
```

### API Access Points

Once running, access the service at:

| Endpoint | Purpose | URL |
|----------|---------|-----|
| **Interactive Docs** | Swagger UI for testing | http://localhost:8000/docs |
| **Alternative Docs** | ReDoc format | http://localhost:8000/redoc |
| **OpenAPI Schema** | Machine-readable spec | http://localhost:8000/openapi.json |

## API Documentation

### Authentication

All endpoints (except health check) require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your_internal_api_secret" \
  http://localhost:8000/api/analyze
```

### Example Requests

#### Health Check (No Auth Required)

```bash
curl http://localhost:8000/
```

Response:
```json
{
  "status": "operational",
  "version": "2.0.0",
  "environment": "development"
}
```

#### Deal Analysis (Authenticated)

```bash
curl -X POST \
  -H "X-API-Key: your_internal_api_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "property_address": "123 Main St, Austin, TX",
    "purchase_price": 500000,
    "analysis_type": "investment_potential"
  }' \
  http://localhost:8000/api/deals/analyze
```

### Interactive Testing

1. Navigate to http://localhost:8000/docs
2. Click **Authorize** (lock icon) and enter your API secret
3. Expand any endpoint and click **Try it out**
4. Modify parameters and click **Execute**
5. View response in real-time

## Project Structure

```
jessewilliams_ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI application entry point
│   ├── agents/                      # AI agent implementations
│   │   ├── deal_hunter.py           # Real estate deal analysis
│   │   ├── offer_outreach.py        # Communication generation
│   │   └── underwriting_analyzer.py # Financial analysis
│   ├── core/                        # Core utilities
│   │   ├── context.py               # Context management
│   │   ├── intent_classifier.py     # Request intent detection
│   │   ├── llm_client.py            # LLM interaction
│   │   ├── security.py              # Authentication/authorization
│   │   └── web_search.py            # Web search capabilities
│   ├── prompts/                     # LLM prompt templates
│   │   ├── core_prompt.py
│   │   ├── deal_hunter_prompt.py
│   │   ├── offer_outreach_prompt.py
│   │   ├── underwriting_prompt.py
│   │   ├── examples_prompt.py
│   │   └── formatting_rules.py
│   └── utils/                       # Utility functions
│       ├── file_generator.py        # Multi-format file export
│       ├── formatters.py            # Data formatting
│       ├── sensitivity_analyzer.py  # Financial analysis
│       └── strategy_ranker.py       # Strategy ranking
├── requirements.txt                 # Python dependencies
├── .env                            # Environment variables (create locally)
└── README.md                       # This file
```

## Common Tasks

### Managing Dependencies

#### Adding New Packages

```bash
# Install new package
pip install package_name

# Update requirements.txt
pip freeze > requirements.txt

# Commit changes
git add requirements.txt && git commit -m "Add new dependency: package_name"
```

#### Viewing Installed Packages

```bash
pip list
pip list --outdated  # Check for updates
```

#### Updating All Packages

```bash
pip install --upgrade pip
pip install -U -r requirements.txt
```

### Virtual Environment Management

#### Deactivating the Environment

```bash
deactivate
```

Returns you to the system Python environment. Prompt loses `(venv)` prefix.

#### Removing the Virtual Environment

```bash
# Windows
rmdir /s /q venv

# macOS/Linux
rm -rf venv
```

#### Verifying Environment

```bash
which python      # macOS/Linux - should show .../venv/bin/python
where python      # Windows - should show ...\venv\Scripts\python.exe
python --version
pip show pip
```

### Database Operations

#### Initialize Database

```bash
# If using Alembic migrations (if implemented)
alembic upgrade head
```

#### Backup Database

```bash
# PostgreSQL
pg_dump jessewilliams_db > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Virtual Environment Issues

#### Activation Fails on Windows

```powershell
# Error: "cannot be loaded because running scripts is disabled"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Also ensure:**
- Using PowerShell or Command Prompt (not Git Bash)
- Running from project directory
- File exists: `venv\Scripts\activate`

#### Activation Fails on macOS/Linux

```bash
# Check if venv exists
ls -la venv/

# Fix permissions if needed
chmod +x venv/bin/activate

# Verify Python version in venv
venv/bin/python --version
```

### Dependency Issues

#### "ModuleNotFoundError" or "ImportError"

```bash
# Verify venv is activated (check for (venv) in prompt)
which python  # Should show .../venv/bin/python

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt

# Clear pip cache
pip cache purge
```

#### Package Version Conflicts

```bash
# Diagnose conflicts
pip check

# View package details
pip show package_name

# Install specific version
pip install package_name==1.2.3
```

### Runtime Issues

#### "Port Already in Use"

```bash
# Use different port
uvicorn app.main:app --port 8001

# Find and kill process using port 8000
# Linux/macOS:
lsof -i :8000
kill -9 <PID>

# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

#### "OPENAI_API_KEY not found"

```bash
# Verify .env file exists
ls -la .env  # macOS/Linux
dir .env     # Windows

# Verify key is set correctly
grep OPENAI_API_KEY .env

# Check Python can read it
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print('Key set:', bool(os.getenv('OPENAI_API_KEY')))"

# Restart the service after updating .env
```

#### "Connection refused" to Database

```bash
# Verify PostgreSQL is running
psql -U postgres -d jessewilliams_db

# Check database connection string in .env
grep DATABASE_URL .env

# Test connection
python -c "from sqlalchemy import create_engine; e = create_engine(os.getenv('DATABASE_URL')); print(e.connect())"
```

### API Issues

#### 401 Unauthorized Responses

```bash
# Verify you're passing API key header
curl -H "X-API-Key: your_secret" http://localhost:8000/docs

# Check INTERNAL_API_SECRET in .env
grep INTERNAL_API_SECRET .env
```

#### 500 Internal Server Error

```bash
# Check logs for detailed error
# Service logs should appear in your terminal

# Check service is healthy
curl http://localhost:8000/

# Restart service and check startup messages
```

### Performance Issues

#### Service Running Slowly

```bash
# Check CPU/Memory usage
# macOS/Linux: top, htop
# Windows: Task Manager

# Reduce workers in production mode
uvicorn app.main:app --workers 2

# Check LLM response times in logs
```

#### High Memory Usage

```bash
# Restart service
# Memory is typically used by:
# - LLM models in memory
# - Conversation context storage
# - Generated documents

# Clear old conversations if implemented
```

## Security

### Best Practices

✅ **DO:**
- Store secrets in `.env` (never in code)
- Use strong API keys (32+ characters for `INTERNAL_API_SECRET`)
- Rotate API keys regularly (monthly recommended)
- Validate all user inputs on the backend
- Use HTTPS in production
- Implement rate limiting for production
- Review [security.py](app/core/security.py) implementation

❌ **DON'T:**
- Commit `.env` to version control
- Log sensitive data
- Use default/weak API keys
- Expose API keys in frontend code
- Run production with `--reload` flag
- Skip CORS configuration validation

### Authentication Flow

```
Client Request
    ↓
X-API-Key Header Check (security.py)
    ↓
Bcrypt Hash Comparison
    ↓
Request Allowed / Denied
    ↓
Response
```

### Data Protection

- All API requests validated for injection attacks
- Database queries use parameterized statements (SQLAlchemy ORM)
- Document exports sanitized before generation
- External API calls use HTTPS

## Development

### Development Workflow

1. **Activate Environment**
   ```bash
   source venv/bin/activate  # macOS/Linux
   venv\Scripts\activate      # Windows
   ```

2. **Start Development Server**
   ```bash
   uvicorn app.main:app --reload
   ```

3. **Make Changes**
   - Edit files in `app/` directory
   - Server auto-reloads on save

4. **Test Changes**
   - Use http://localhost:8000/docs
   - Run manual tests/curl commands

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   ```

### Code Style

This project uses:
- **Black** for code formatting (auto on commit if pre-commit hooks enabled)
- **Type hints** for all function parameters and returns
- **Docstrings** for all public functions
- **Async/await** for I/O operations

### Testing

```bash
# Run unit tests (if implemented)
pytest

# Run with coverage
pytest --cov=app

# Run specific test
pytest tests/test_deal_hunter.py
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "feat: your feature"`
4. Push to branch: `git push origin feature/your-feature`
5. Open Pull Request

## Performance & Scalability

### Performance Characteristics

- **API Response Time**: 200-500ms typical (depends on LLM model)
- **Document Generation**: 5-30 seconds (depending on complexity)
- **Concurrent Requests**: 100+ with async workers
- **Memory Usage**: 1-2GB during normal operation

### Scaling for Production

1. **Multiple Workers**
   ```bash
   uvicorn app.main:app --workers 4
   ```

2. **Load Balancing** (Nginx, HAProxy)
   ```nginx
   upstream api {
       server localhost:8000;
       server localhost:8001;
       server localhost:8002;
   }
   ```

3. **Database Optimization**
   - Use connection pooling
   - Enable query caching
   - Regular VACUUM and ANALYZE

4. **Monitoring**
   - Set up application logging
   - Monitor LLM API costs
   - Track response times

## Monitoring & Logging

### Checking Service Health

```bash
# Simple health check
curl http://localhost:8000/

# Detailed startup log
uvicorn app.main:app --log-level debug
```

### Log Levels

```bash
# Development (verbose)
uvicorn app.main:app --log-level debug

# Production (less noisy)
uvicorn app.main:app --log-level info

# Quiet mode
uvicorn app.main:app --log-level warning
```

## FAQ

**Q: Can I use SQLite instead of PostgreSQL?**
A: Yes, for development. Change `DATABASE_URL` in `.env` to `sqlite:///./app.db`. Not recommended for production.

**Q: How do I update my OpenAI API key?**
A: Edit `.env`, update `OPENAI_API_KEY`, save file, and restart the service.

**Q: Is the API suitable for production?**
A: Yes, with proper deployment (use Gunicorn, enable HTTPS, set up monitoring, use PostgreSQL).

**Q: How can I monitor LLM API costs?**
A: Check OpenAI dashboard, implement logging in `llm_client.py`, or use third-party monitoring tools.

**Q: Can I run multiple instances?**
A: Yes, use a load balancer and ensure they share the same database.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 📧 Email: [support-email@example.com]
- 🐛 Issues: [Report bugs on GitHub](https://github.com/jessewilliams/ai-service/issues)
- 📚 Docs: [FastAPI Documentation](https://fastapi.tiangolo.com/)
- 🤖 LLM: [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

## Version History

| Version | Release Date | Changes |
|---------|-------------|---------|
| **2.0.0** | Jan 2026 | Production-grade AI with memory and file generation |
| **1.5.0** | Dec 2025 | Enhanced underwriting analyzer |
| **1.0.0** | Nov 2025 | Initial release |

---

**Last Updated**: January 24, 2026
**Maintained By**: SAIFZaman007