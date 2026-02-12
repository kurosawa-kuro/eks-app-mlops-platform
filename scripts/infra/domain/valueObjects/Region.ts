/**
 * Region Value Object
 *
 * Represents a valid AWS region for infrastructure operations.
 */

import { InvalidRegionError } from '../errors/DomainError.js';

/** Supported AWS regions */
const VALID_REGIONS = ['ap-northeast-1', 'us-east-1', 'us-west-2'] as const;

export type RegionCode = (typeof VALID_REGIONS)[number];

/**
 * Immutable value object representing an AWS region.
 *
 * @example
 * const region = Region.create('ap-northeast-1');
 * console.log(region.toString()); // 'ap-northeast-1'
 */
export class Region {
  private constructor(private readonly value: RegionCode) {}

  /**
   * Create a Region from a string.
   * @throws InvalidRegionError if the region is not supported
   */
  static create(value: string): Region {
    if (!Region.isValid(value)) {
      throw new InvalidRegionError(value);
    }
    return new Region(value as RegionCode);
  }

  /**
   * Check if a string is a valid region.
   */
  static isValid(value: string): value is RegionCode {
    return VALID_REGIONS.includes(value as RegionCode);
  }

  /**
   * Get all supported regions.
   */
  static all(): readonly RegionCode[] {
    return VALID_REGIONS;
  }

  /**
   * Get the default region.
   */
  static default(): Region {
    return new Region('ap-northeast-1');
  }

  /**
   * Get the region code.
   */
  get code(): RegionCode {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: Region): boolean {
    return this.value === other.value;
  }
}
