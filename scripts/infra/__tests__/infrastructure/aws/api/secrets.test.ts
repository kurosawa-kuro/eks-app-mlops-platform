/**
 * Tests for aws/secrets.ts - AWS Secrets Manager utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../../infrastructure/shell/index.js', () => ({
  aws: vi.fn(),
}));

vi.mock('../../../../framework/logging/index.js', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    fail: vi.fn(),
  },
}));

import { aws } from '../../../../infrastructure/shell/index.js';
import {
  secretsList,
  secretsExists,
  secretsDescribe,
  secretsGetValue,
  secretsCreate,
  secretsUpdate,
  secretsDelete,
} from '../../../../infrastructure/aws/api/secrets.js';

const mockAws = vi.mocked(aws);

describe('secretsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed secrets list', () => {
    const secretsData = [
      { Name: 'secret1', Description: 'desc1', Modified: '2024-01-01' },
      { Name: 'secret2', Description: 'desc2', Modified: '2024-01-02' },
    ];
    mockAws.mockReturnValue(JSON.stringify(secretsData));

    const result = secretsList();

    expect(result).toHaveLength(2);
    expect(result[0].Name).toBe('secret1');
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('secretsmanager list-secrets'),
      expect.objectContaining({ silent: true })
    );
  });

  it('returns empty array on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('AWS error');
    });

    const result = secretsList();

    expect(result).toEqual([]);
  });

  it('uses provided region', () => {
    mockAws.mockReturnValue('[]');

    secretsList('us-west-2');

    expect(mockAws).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ region: 'us-west-2' })
    );
  });
});

describe('secretsExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when secret exists', () => {
    mockAws.mockReturnValue('{}');

    const result = secretsExists('my-secret');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      'secretsmanager describe-secret --secret-id my-secret',
      expect.objectContaining({ silent: true })
    );
  });

  it('returns false when secret does not exist', () => {
    mockAws.mockImplementation(() => {
      throw new Error('ResourceNotFoundException');
    });

    const result = secretsExists('nonexistent');

    expect(result).toBe(false);
  });

  it('throws on invalid secret name', () => {
    expect(() => secretsExists('bad name with spaces')).toThrow();
  });
});

describe('secretsDescribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns secret info when found', () => {
    const secretInfo = {
      Name: 'my-secret',
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
      Description: 'My secret',
    };
    mockAws.mockReturnValue(JSON.stringify(secretInfo));

    const result = secretsDescribe('my-secret');

    expect(result).toEqual(expect.objectContaining({ Name: 'my-secret' }));
  });

  it('returns null when secret not found', () => {
    mockAws.mockImplementation(() => {
      throw new Error('ResourceNotFoundException');
    });

    const result = secretsDescribe('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null for invalid JSON response', () => {
    mockAws.mockReturnValue('invalid json');

    const result = secretsDescribe('my-secret');

    expect(result).toBeNull();
  });
});

describe('secretsGetValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns secret value', () => {
    mockAws.mockReturnValue('secret-value-123');

    const result = secretsGetValue('my-secret');

    expect(result).toBe('secret-value-123');
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining("get-secret-value --secret-id my-secret"),
      expect.objectContaining({ silent: true })
    );
  });

  it('returns null on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Access denied');
    });

    const result = secretsGetValue('my-secret');

    expect(result).toBeNull();
  });

  it('uses provided region', () => {
    mockAws.mockReturnValue('value');

    secretsGetValue('my-secret', 'eu-west-1');

    expect(mockAws).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ region: 'eu-west-1' })
    );
  });
});

describe('secretsCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates secret and returns ARN', () => {
    const response = {
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
      Name: 'my-secret',
    };
    mockAws.mockReturnValue(JSON.stringify(response));

    const result = secretsCreate('my-secret', 'secret-value');

    expect(result.ARN).toContain('my-secret');
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('secretsmanager create-secret --name my-secret'),
      expect.any(Object)
    );
  });

  it('includes description when provided', () => {
    mockAws.mockReturnValue('{}');

    secretsCreate('my-secret', 'value', undefined, 'My description');

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining("--description 'My description'"),
      expect.any(Object)
    );
  });

  it('escapes single quotes in secret value', () => {
    mockAws.mockReturnValue('{}');

    secretsCreate('my-secret', "value'with'quotes");

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining("'\\''"),
      expect.any(Object)
    );
  });
});

describe('secretsUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true on successful update', () => {
    mockAws.mockReturnValue('');

    const result = secretsUpdate('my-secret', 'new-value');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('secretsmanager put-secret-value --secret-id my-secret'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Update failed');
    });

    const result = secretsUpdate('my-secret', 'new-value');

    expect(result).toBe(false);
  });
});

describe('secretsDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true on successful delete', () => {
    mockAws.mockReturnValue('');

    const result = secretsDelete('my-secret');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('secretsmanager delete-secret --secret-id my-secret'),
      expect.any(Object)
    );
  });

  it('uses force delete when specified', () => {
    mockAws.mockReturnValue('');

    secretsDelete('my-secret', undefined, true);

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('--force-delete-without-recovery'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Delete failed');
    });

    const result = secretsDelete('my-secret');

    expect(result).toBe(false);
  });
});
