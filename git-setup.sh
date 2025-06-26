#!/bin/bash

# Initialize git repository and push to GitHub
echo "Setting up git repository for x-mcp-server..."

# Initialize git if not already
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Twitter/X MCP Server with OAuth 2.0 and media upload support"

# Add remote origin
git remote add origin https://github.com/mbelinky/x-mcp-server.git

# Push to main branch
git branch -M main
git push -u origin main

echo "✅ Repository pushed to https://github.com/mbelinky/x-mcp-server"