import { describe, it, expect } from 'vitest';
import { Overlay } from '../../../domain/valueObjects/Overlay.js';
import { InvalidOverlayError } from '../../../domain/errors/DomainError.js';

describe('Overlay', () => {
  describe('create', () => {
    it('should create valid overlays', () => {
      expect(Overlay.create('local').name).toBe('local');
      expect(Overlay.create('staging').name).toBe('staging');
      expect(Overlay.create('prod').name).toBe('prod');
    });

    it('should throw InvalidOverlayError for invalid overlay', () => {
      expect(() => Overlay.create('development')).toThrow(InvalidOverlayError);
      expect(() => Overlay.create('')).toThrow(InvalidOverlayError);
    });
  });

  describe('factory methods', () => {
    it('should create local overlay', () => {
      const overlay = Overlay.local();
      expect(overlay.name).toBe('local');
      expect(overlay.isLocal()).toBe(true);
    });

    it('should create staging overlay', () => {
      const overlay = Overlay.staging();
      expect(overlay.name).toBe('staging');
      expect(overlay.isStaging()).toBe(true);
    });

    it('should create prod overlay', () => {
      const overlay = Overlay.prod();
      expect(overlay.name).toBe('prod');
      expect(overlay.isProduction()).toBe(true);
    });
  });

  describe('environment checks', () => {
    it('should correctly identify production', () => {
      expect(Overlay.prod().isProduction()).toBe(true);
      expect(Overlay.local().isProduction()).toBe(false);
      expect(Overlay.staging().isProduction()).toBe(false);
    });

    it('should correctly identify Kind usage', () => {
      expect(Overlay.local().usesKind()).toBe(true);
      expect(Overlay.staging().usesKind()).toBe(true);
      expect(Overlay.prod().usesKind()).toBe(false);
    });

    it('should correctly identify EKS usage', () => {
      expect(Overlay.prod().usesEks()).toBe(true);
      expect(Overlay.local().usesEks()).toBe(false);
      expect(Overlay.staging().usesEks()).toBe(false);
    });
  });

  describe('all', () => {
    it('should return all valid overlays', () => {
      const overlays = Overlay.all();
      expect(overlays).toContain('local');
      expect(overlays).toContain('staging');
      expect(overlays).toContain('prod');
      expect(overlays.length).toBe(3);
    });
  });

  describe('equals', () => {
    it('should return true for same overlay', () => {
      const overlay1 = Overlay.create('prod');
      const overlay2 = Overlay.create('prod');
      expect(overlay1.equals(overlay2)).toBe(true);
    });

    it('should return false for different overlays', () => {
      const overlay1 = Overlay.create('prod');
      const overlay2 = Overlay.create('staging');
      expect(overlay1.equals(overlay2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the overlay name', () => {
      expect(Overlay.local().toString()).toBe('local');
      expect(Overlay.staging().toString()).toBe('staging');
      expect(Overlay.prod().toString()).toBe('prod');
    });
  });
});
