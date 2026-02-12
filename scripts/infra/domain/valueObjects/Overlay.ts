/**
 * Overlay Value Object
 *
 * Represents a Kubernetes deployment overlay (environment).
 */

import { InvalidOverlayError } from '../errors/DomainError.js';

/** Supported overlay types */
const VALID_OVERLAYS = ['local', 'staging', 'prod'] as const;

export type OverlayType = (typeof VALID_OVERLAYS)[number];

/**
 * Immutable value object representing a Kubernetes overlay.
 *
 * @example
 * const overlay = Overlay.create('staging');
 * console.log(overlay.isProduction()); // false
 */
export class Overlay {
  private constructor(private readonly value: OverlayType) {}

  /**
   * Create an Overlay from a string.
   * @throws InvalidOverlayError if the overlay is not supported
   */
  static create(value: string): Overlay {
    if (!Overlay.isValid(value)) {
      throw new InvalidOverlayError(value);
    }
    return new Overlay(value as OverlayType);
  }

  /**
   * Check if a string is a valid overlay.
   */
  static isValid(value: string): value is OverlayType {
    return VALID_OVERLAYS.includes(value as OverlayType);
  }

  /**
   * Get all supported overlays.
   */
  static all(): readonly OverlayType[] {
    return VALID_OVERLAYS;
  }

  /**
   * Create the local overlay.
   */
  static local(): Overlay {
    return new Overlay('local');
  }

  /**
   * Create the staging overlay.
   */
  static staging(): Overlay {
    return new Overlay('staging');
  }

  /**
   * Create the prod overlay.
   */
  static prod(): Overlay {
    return new Overlay('prod');
  }

  /**
   * Get the overlay name.
   */
  get name(): OverlayType {
    return this.value;
  }

  /**
   * Check if this is the production overlay.
   */
  isProduction(): boolean {
    return this.value === 'prod';
  }

  /**
   * Check if this is the local overlay.
   */
  isLocal(): boolean {
    return this.value === 'local';
  }

  /**
   * Check if this is the staging overlay.
   */
  isStaging(): boolean {
    return this.value === 'staging';
  }

  /**
   * Check if this overlay uses Kind (local Kubernetes).
   */
  usesKind(): boolean {
    return this.value === 'local' || this.value === 'staging';
  }

  /**
   * Check if this overlay uses EKS.
   */
  usesEks(): boolean {
    return this.value === 'prod';
  }

  toString(): string {
    return this.value;
  }

  equals(other: Overlay): boolean {
    return this.value === other.value;
  }
}
