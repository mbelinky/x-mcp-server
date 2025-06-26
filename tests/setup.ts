// Jest setup file
import { jest } from '@jest/globals';

// Mock console.error to avoid noise in tests unless DEBUG is set
if (process.env.DEBUG !== 'true') {
  global.console.error = jest.fn();
}

// Set up test environment variables
process.env.NODE_ENV = 'test';