.PHONY: help install dev test lint format docker-up docker-down sync-test clean

help:
	@echo "Field Sales Command - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install           Install all dependencies (Node + Python)"
	@echo "  make install-node      Install Node dependencies"
	@echo "  make install-python    Install Python dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev               Start development servers (FastAPI + Expo)"
	@echo "  make dev-backend       Start FastAPI development server"
	@echo "  make dev-mobile        Start Expo development server"
	@echo "  make dev-docker        Start all services with Docker Compose"
	@echo ""
	@echo "Testing:"
	@echo "  make test              Run all tests (Node + Python)"
	@echo "  make test-mobile       Run React Native tests"
	@echo "  make test-backend      Run Python tests with coverage"
	@echo "  make test-e2e          Run end-to-end tests"
	@echo "  make test-sync         Test data sync pipeline"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint              Lint all code"
	@echo "  make lint-mobile       Lint React Native code"
	@echo "  make lint-backend      Lint Python code"
	@echo "  make format            Format all code"
	@echo "  make format-check      Check if code needs formatting"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up         Start Docker Compose services"
	@echo "  make docker-down       Stop Docker Compose services"
	@echo "  make docker-logs       View Docker logs"
	@echo "  make docker-clean      Remove all Docker containers/volumes"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate        Run database migrations"
	@echo "  make db-seed           Seed database with test data"
	@echo "  make db-reset          Reset database (careful!)"
	@echo ""
	@echo "Utility:"
	@echo "  make clean             Clean build artifacts and cache"
	@echo "  make env-setup         Create .env from .env.example"

# Install targets
install: install-node install-python
	@echo "Dependencies installed. Run 'make dev' to start development."

install-node:
	@echo "Installing Node dependencies..."
	npm install

install-python:
	@echo "Installing Python dependencies..."
	python -m venv venv
	./venv/bin/pip install --upgrade pip
	./venv/bin/pip install -r requirements.txt

# Development targets
dev: dev-backend dev-mobile
	@echo "Development servers started"

dev-backend:
	@echo "Starting FastAPI development server..."
	./venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

dev-mobile:
	@echo "Starting Expo development server..."
	npx expo start

dev-docker:
	@echo "Starting all services with Docker Compose..."
	docker-compose up -d
	@echo "Services starting. View logs with 'make docker-logs'"

# Testing targets
test: test-mobile test-backend
	@echo "All tests completed"

test-mobile:
	@echo "Running React Native tests..."
	npm test -- --coverage

test-backend:
	@echo "Running Python tests..."
	./venv/bin/pytest backend/ --cov=backend --cov-report=html --cov-report=term-missing

test-e2e:
	@echo "Running end-to-end tests..."
	npm run test:e2e

test-sync:
	@echo "Testing data sync pipeline..."
	./venv/bin/pytest backend/tests/test_sync.py -v

# Linting targets
lint: lint-mobile lint-backend
	@echo "Linting completed"

lint-mobile:
	@echo "Linting React Native code..."
	npx eslint . --ext .js,.jsx,.ts,.tsx

lint-backend:
	@echo "Linting Python code..."
	./venv/bin/flake8 backend --max-line-length=100
	./venv/bin/pylint backend

# Formatting targets
format: format-mobile format-backend
	@echo "Code formatted"

format-check:
	@echo "Checking code formatting..."
	npx prettier --check .
	./venv/bin/black --check backend
	./venv/bin/isort --check-only backend

format-mobile:
	@echo "Formatting React Native code..."
	npx prettier --write .

format-backend:
	@echo "Formatting Python code..."
	./venv/bin/black backend
	./venv/bin/isort backend

# Docker targets
docker-up:
	@echo "Starting Docker Compose services..."
	docker-compose up -d
	@echo "Services started. Running migrations..."
	docker-compose exec -T backend python -m alembic upgrade head
	@echo "Setup complete. Access services at:"
	@echo "  FastAPI: http://localhost:8000"
	@echo "  Supabase: http://localhost:54321"
	@echo "  Redis: localhost:6379"
	@echo "  n8n: http://localhost:5678"

docker-down:
	@echo "Stopping Docker Compose services..."
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-clean:
	@echo "Removing Docker containers and volumes (this will delete data!)..."
	docker-compose down -v
	@echo "Docker cleaned"

# Database targets
db-migrate:
	@echo "Running database migrations..."
	./venv/bin/alembic upgrade head

db-seed:
	@echo "Seeding database with test data..."
	./venv/bin/python backend/scripts/seed_db.py

db-reset:
	@echo "WARNING: This will reset the entire database!"
	@read -p "Continue? [y/N] " confirm && [ "$${confirm}" = "y" ] || exit 1
	docker-compose down -v
	docker-compose up -d
	sleep 5
	./venv/bin/alembic upgrade head
	./venv/bin/python backend/scripts/seed_db.py
	@echo "Database reset and seeded"

# Utility targets
clean:
	@echo "Cleaning build artifacts..."
	rm -rf node_modules .next .expo dist build coverage .pytest_cache __pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "Cleaned"

env-setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example. Please update with your credentials."; \
	else \
		echo ".env already exists"; \
	fi
