import request from 'supertest';
import { serve } from '@hono/node-server';
import app from '../../src/app.js';
describe('Auth API', () => {
    let server;
    beforeAll(() => {
        server = serve({ fetch: app.fetch, port: 0 });
    });
    afterAll(() => {
        server.close();
    });
    describe('GET /', () => {
        it('should return API info', async () => {
            const response = await request(server).get('/');
            expect(response.status).toBe(200);
            expect(response.body.name).toBe('auth-service');
            expect(response.body.endpoints).toBeDefined();
            expect(response.body.provider).toBeDefined();
        });
    });
    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(server).get('/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
        });
    });
    describe('POST /auth/login', () => {
        it('should return JWT on valid credentials', async () => {
            const response = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            expect(response.status).toBe(200);
            expect(response.body.access_token).toBeDefined();
            expect(response.body.token_type).toBe('Bearer');
            expect(response.body.expires_in).toBe(3600);
        });
        it('should set session cookie on login', async () => {
            const response = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toMatch(/session=/);
        });
        it('should return 401 on invalid credentials', async () => {
            const response = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'wrong' });
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid credentials');
        });
    });
    describe('GET /auth/me', () => {
        it('should return user info with valid Bearer token', async () => {
            const loginResponse = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            const token = loginResponse.body.access_token;
            const response = await request(server)
                .get('/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(200);
            expect(response.body.authenticated).toBe(true);
            expect(response.body.user.sub).toBe('dummy-admin-id');
            expect(response.body.user.email).toBe('admin@example.com');
        });
        it('should return user info with valid session cookie', async () => {
            const loginResponse = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            const cookies = loginResponse.headers['set-cookie'];
            const response = await request(server)
                .get('/auth/me')
                .set('Cookie', cookies);
            expect(response.status).toBe(200);
            expect(response.body.authenticated).toBe(true);
        });
        it('should return authenticated: false without token', async () => {
            const response = await request(server).get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body.authenticated).toBe(false);
        });
        it('should return authenticated: false with invalid token', async () => {
            const response = await request(server)
                .get('/auth/me')
                .set('Authorization', 'Bearer invalid-token');
            expect(response.status).toBe(200);
            expect(response.body.authenticated).toBe(false);
        });
    });
    describe('POST /auth/refresh', () => {
        it('should return new access token with valid refresh token', async () => {
            // First login to get refresh token
            const loginResponse = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            const refreshToken = loginResponse.body.refresh_token;
            // Use refresh token to get new access token
            const response = await request(server)
                .post('/auth/refresh')
                .send({ refresh_token: refreshToken });
            expect(response.status).toBe(200);
            expect(response.body.access_token).toBeDefined();
            expect(response.body.token_type).toBe('Bearer');
            expect(response.body.expires_in).toBe(3600);
        });
        it('should update session cookie on refresh', async () => {
            const loginResponse = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            const refreshToken = loginResponse.body.refresh_token;
            const response = await request(server)
                .post('/auth/refresh')
                .send({ refresh_token: refreshToken });
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toMatch(/session=/);
        });
    });
    describe('POST /auth/logout', () => {
        it('should return logged out message', async () => {
            const response = await request(server).post('/auth/logout');
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('logged out');
        });
        it('should clear session cookie', async () => {
            const response = await request(server).post('/auth/logout');
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toMatch(/session=;/);
        });
        it('should invalidate token after logout', async () => {
            // Login
            const loginResponse = await request(server)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password' });
            const token = loginResponse.body.access_token;
            // Verify token works
            const verifyBefore = await request(server)
                .get('/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(verifyBefore.body.authenticated).toBe(true);
            // Logout
            await request(server)
                .post('/auth/logout')
                .set('Authorization', `Bearer ${token}`);
            // Token should no longer work
            const verifyAfter = await request(server)
                .get('/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(verifyAfter.body.authenticated).toBe(false);
        });
    });
});
