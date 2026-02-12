import { describe, it, expect } from 'vitest';
import { Region } from '../../../domain/valueObjects/Region.js';
import { InvalidRegionError } from '../../../domain/errors/DomainError.js';

describe('Region', () => {
  describe('create', () => {
    it('should create a valid region', () => {
      const region = Region.create('ap-northeast-1');
      expect(region.code).toBe('ap-northeast-1');
      expect(region.toString()).toBe('ap-northeast-1');
    });

    it('should throw InvalidRegionError for invalid region', () => {
      expect(() => Region.create('invalid-region')).toThrow(InvalidRegionError);
      expect(() => Region.create('')).toThrow(InvalidRegionError);
    });
  });

  describe('isValid', () => {
    it('should return true for valid regions', () => {
      expect(Region.isValid('ap-northeast-1')).toBe(true);
      expect(Region.isValid('us-east-1')).toBe(true);
      expect(Region.isValid('us-west-2')).toBe(true);
    });

    it('should return false for invalid regions', () => {
      expect(Region.isValid('eu-west-1')).toBe(false);
      expect(Region.isValid('')).toBe(false);
    });
  });

  describe('all', () => {
    it('should return all valid regions', () => {
      const regions = Region.all();
      expect(regions).toContain('ap-northeast-1');
      expect(regions).toContain('us-east-1');
      expect(regions).toContain('us-west-2');
      expect(regions.length).toBe(3);
    });
  });

  describe('default', () => {
    it('should return ap-northeast-1', () => {
      const region = Region.default();
      expect(region.code).toBe('ap-northeast-1');
    });
  });

  describe('equals', () => {
    it('should return true for same region', () => {
      const region1 = Region.create('ap-northeast-1');
      const region2 = Region.create('ap-northeast-1');
      expect(region1.equals(region2)).toBe(true);
    });

    it('should return false for different regions', () => {
      const region1 = Region.create('ap-northeast-1');
      const region2 = Region.create('us-east-1');
      expect(region1.equals(region2)).toBe(false);
    });
  });
});
