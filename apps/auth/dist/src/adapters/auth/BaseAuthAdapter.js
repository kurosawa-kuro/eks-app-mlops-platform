/**
 * Base authentication adapter providing common utilities
 * Concrete adapters (Dummy, Cognito) extend this class
 */
export class BaseAuthAdapter {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Create a successful authentication result
     */
    successResult(user, tokens) {
        return {
            success: true,
            message: 'Login successful',
            user,
            ...tokens,
        };
    }
    /**
     * Create a failed authentication result
     */
    failureResult(message) {
        return {
            success: false,
            message,
        };
    }
}
