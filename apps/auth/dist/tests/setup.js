// Jest setup file - override env vars for testing
process.env.AUTH_PROVIDER = 'dummy';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jest-testing-32chars!';
process.env.ACCESS_TOKEN_TTL = '3600';
process.env.REFRESH_TOKEN_TTL = '604800';
export {};
