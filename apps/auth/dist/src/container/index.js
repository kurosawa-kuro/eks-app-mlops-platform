import { createContainer, asClass, asValue, asFunction, InjectionMode } from 'awilix';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
// Adapters
import { CognitoAuthAdapter } from '../adapters/auth/CognitoAuthAdapter.js';
import { DummyAuthAdapter } from '../adapters/auth/DummyAuthAdapter.js';
import { InMemoryBlacklist } from '../adapters/blacklist/InMemoryBlacklist.js';
import { RedisBlacklist } from '../adapters/blacklist/RedisBlacklist.js';
// Services
import { JwtService } from '../services/JwtService.js';
// Middleware
import { createAuditLogger } from '../middleware/auditLog.js';
// UseCases
import { AuthUseCase } from '../usecases/AuthUseCase.js';
/**
 * Create the appropriate token blacklist based on environment
 */
function createTokenBlacklist() {
    if (env.REDIS_URL) {
        logger.info('Using Redis for token blacklist (distributed)');
        return new RedisBlacklist(env.REDIS_URL, logger);
    }
    logger.info('Using in-memory token blacklist (single instance)');
    return new InMemoryBlacklist(logger);
}
/**
 * Creates and configures the Awilix DI container
 */
export function createAppContainer() {
    const container = createContainer({
        injectionMode: InjectionMode.CLASSIC,
    });
    container.register({
        // Config (registered as values)
        env: asValue(env),
        logger: asValue(logger),
        // Services (singletons)
        jwtService: asClass(JwtService).singleton(),
        auditLogger: asFunction(() => createAuditLogger(logger)).singleton(),
        // Adapters (singletons)
        // Use Redis when REDIS_URL is set, otherwise use in-memory
        tokenBlacklist: asFunction(createTokenBlacklist).singleton(),
        // Auth adapter: switch based on AUTH_PROVIDER
        authAdapter: env.AUTH_PROVIDER === 'dummy'
            ? asClass(DummyAuthAdapter).singleton()
            : asClass(CognitoAuthAdapter).singleton(),
        // UseCases (singletons)
        authUseCase: asClass(AuthUseCase).singleton(),
    });
    const providerLabel = env.AUTH_PROVIDER === 'dummy' ? 'Dummy' : 'Cognito';
    logger.info(`DI container initialized (${providerLabel} auth)`);
    return container;
}
/**
 * Default application container instance
 */
export const container = createAppContainer();
/**
 * Helper function to resolve a dependency from the container
 */
export function resolve(name) {
    return container.resolve(name);
}
