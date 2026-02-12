import { CognitoIdentityProviderClient, InitiateAuthCommand, GlobalSignOutCommand, GetUserCommand, } from '@aws-sdk/client-cognito-identity-provider';
import * as jose from 'jose';
import { BaseAuthAdapter } from './BaseAuthAdapter.js';
/**
 * AWS Cognito authentication adapter
 *
 * Uses real AWS Cognito User Pool for authentication.
 * Tokens are issued by Cognito and verified using JWKS.
 *
 * Required env vars:
 * - COGNITO_USER_POOL_ID
 * - COGNITO_CLIENT_ID
 * - COGNITO_REGION
 */
export class CognitoAuthAdapter extends BaseAuthAdapter {
    tokenBlacklist;
    env;
    client;
    clientId;
    userPoolId;
    region;
    jwks = null;
    constructor(tokenBlacklist, env, logger) {
        super(logger);
        this.tokenBlacklist = tokenBlacklist;
        this.env = env;
        this.region = env.COGNITO_REGION || 'ap-northeast-1';
        this.userPoolId = env.COGNITO_USER_POOL_ID || '';
        this.clientId = env.COGNITO_CLIENT_ID || '';
        this.client = new CognitoIdentityProviderClient({
            region: this.region,
        });
        this.logger.info({
            userPoolId: this.userPoolId || 'not-configured',
            clientId: this.clientId || 'not-configured',
            region: this.region,
        }, 'CognitoAuthAdapter initialized');
    }
    async getJwks() {
        if (!this.jwks) {
            const jwksUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;
            this.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
        }
        return this.jwks;
    }
    async login(credentials) {
        this.logger.info({ username: credentials.username }, 'Cognito login attempt');
        try {
            const command = new InitiateAuthCommand({
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: this.clientId,
                AuthParameters: {
                    USERNAME: credentials.username,
                    PASSWORD: credentials.password,
                },
            });
            const response = await this.client.send(command);
            if (!response.AuthenticationResult) {
                // Challenge required (e.g., NEW_PASSWORD_REQUIRED)
                if (response.ChallengeName) {
                    this.logger.warn({ challenge: response.ChallengeName }, 'Cognito authentication requires challenge');
                    return this.failureResult(`Authentication challenge required: ${response.ChallengeName}`);
                }
                return this.failureResult('Authentication failed');
            }
            const { AccessToken, RefreshToken, ExpiresIn, IdToken } = response.AuthenticationResult;
            if (!AccessToken || !RefreshToken) {
                return this.failureResult('Missing tokens in response');
            }
            // Decode ID token to get user info
            let userId = 'unknown';
            let email = credentials.username;
            if (IdToken) {
                try {
                    const decoded = jose.decodeJwt(IdToken);
                    userId = decoded.sub || 'unknown';
                    email = decoded.email || credentials.username;
                }
                catch {
                    this.logger.warn('Failed to decode ID token');
                }
            }
            this.logger.info({ userId, email }, 'User logged in via Cognito');
            return this.successResult({ id: userId, email }, { accessToken: AccessToken, refreshToken: RefreshToken, expiresIn: ExpiresIn || 3600 });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorName = error instanceof Error ? error.name : 'UnknownError';
            this.logger.error({ error: errorMessage, errorName }, 'Cognito login failed');
            // Map Cognito errors to user-friendly messages
            if (errorName === 'NotAuthorizedException') {
                return this.failureResult('Invalid credentials');
            }
            if (errorName === 'UserNotFoundException') {
                return this.failureResult('User not found');
            }
            if (errorName === 'UserNotConfirmedException') {
                return this.failureResult('User not confirmed');
            }
            return this.failureResult(errorMessage);
        }
    }
    async verify(token) {
        this.logger.debug({ tokenPrefix: token.substring(0, 20) }, 'Cognito verify');
        // Check blacklist first
        if (await this.tokenBlacklist.isBlacklisted(token)) {
            return { success: false, message: 'Token has been revoked' };
        }
        try {
            const jwks = await this.getJwks();
            const { payload } = await jose.jwtVerify(token, jwks, {
                issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
            });
            // Cognito access tokens have 'client_id' claim, ID tokens have 'aud'
            // We accept both
            const tokenUse = payload.token_use;
            if (tokenUse !== 'access' && tokenUse !== 'id') {
                this.logger.warn({ tokenUse }, 'Invalid token_use claim');
                return { success: false, message: 'Invalid token type' };
            }
            // Cognito access tokens don't include custom:role or email claims.
            // Fall back to GetUser API to retrieve actual user attributes.
            let role = (payload['custom:role'] || 'user');
            let email = payload.email || '';
            const sub = payload.sub;
            if (tokenUse === 'access' && (!payload['custom:role'] || !payload.email)) {
                const userInfo = await this.getUserWithRole(token);
                if (userInfo) {
                    email = email || userInfo.email;
                    role = (userInfo.role || role);
                }
            }
            return {
                success: true,
                payload: {
                    sub,
                    email: email || payload.username || '',
                    role,
                    iat: payload.iat || Math.floor(Date.now() / 1000),
                    exp: payload.exp || Math.floor(Date.now() / 1000) + 3600,
                },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Token verification failed';
            this.logger.debug({ error: errorMessage }, 'Token verification failed');
            return { success: false, message: 'Invalid or expired token' };
        }
    }
    async refresh(refreshToken) {
        this.logger.debug('Cognito refresh');
        try {
            const command = new InitiateAuthCommand({
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                ClientId: this.clientId,
                AuthParameters: {
                    REFRESH_TOKEN: refreshToken,
                },
            });
            const response = await this.client.send(command);
            if (!response.AuthenticationResult?.AccessToken) {
                return { success: false, message: 'Failed to refresh token' };
            }
            const { AccessToken, ExpiresIn } = response.AuthenticationResult;
            this.logger.info('Token refreshed via Cognito');
            return {
                success: true,
                accessToken: AccessToken,
                expiresIn: ExpiresIn || 3600,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: errorMessage }, 'Cognito refresh failed');
            return { success: false, message: 'Invalid or expired refresh token' };
        }
    }
    async logout(accessToken, _refreshToken) {
        this.logger.info('Cognito logout');
        try {
            // Global sign out - invalidates all tokens for this user
            const command = new GlobalSignOutCommand({
                AccessToken: accessToken,
            });
            await this.client.send(command);
            // Also add to local blacklist for immediate effect
            const expiresAt = new Date(Date.now() + this.env.ACCESS_TOKEN_TTL * 1000);
            await this.tokenBlacklist.add(accessToken, expiresAt);
            this.logger.info('User signed out via Cognito');
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: errorMessage }, 'Cognito logout failed');
            // Still add to local blacklist even if Cognito call fails
            const expiresAt = new Date(Date.now() + this.env.ACCESS_TOKEN_TTL * 1000);
            await this.tokenBlacklist.add(accessToken, expiresAt);
            return { success: true };
        }
    }
    /**
     * Get user info from Cognito using access token
     */
    async getUser(accessToken) {
        try {
            const command = new GetUserCommand({
                AccessToken: accessToken,
            });
            const response = await this.client.send(command);
            const email = response.UserAttributes?.find(attr => attr.Name === 'email')?.Value;
            const sub = response.UserAttributes?.find(attr => attr.Name === 'sub')?.Value;
            return {
                sub: sub || response.Username || 'unknown',
                email: email || response.Username || 'unknown',
            };
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to get user from Cognito');
            return null;
        }
    }
    /**
     * Get user info including custom:role from Cognito using access token
     */
    async getUserWithRole(accessToken) {
        try {
            const command = new GetUserCommand({
                AccessToken: accessToken,
            });
            const response = await this.client.send(command);
            const email = response.UserAttributes?.find(attr => attr.Name === 'email')?.Value;
            const sub = response.UserAttributes?.find(attr => attr.Name === 'sub')?.Value;
            const role = response.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value;
            return {
                sub: sub || response.Username || 'unknown',
                email: email || response.Username || 'unknown',
                role: role || 'user',
            };
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to get user attributes from Cognito');
            return null;
        }
    }
}
