import { describe, it, expect } from 'vitest';
import {
  Phase,
  createNarrativePhases,
  flattenPhases,
} from '../../../domain/valueObjects/Phase.js';

describe('Phase', () => {
  describe('creation', () => {
    it('should create a pending phase', () => {
      const phase = Phase.pending('Setup', 'Setting up environment');
      expect(phase.name).toBe('Setup');
      expect(phase.description).toBe('Setting up environment');
      expect(phase.status).toBe('pending');
      expect(phase.isPending()).toBe(true);
    });

    it('should create a completed phase', () => {
      const phase = Phase.completed('Setup', 'Setting up environment', 1500);
      expect(phase.status).toBe('success');
      expect(phase.durationMs).toBe(1500);
      expect(phase.isSuccess()).toBe(true);
    });

    it('should create a skipped phase', () => {
      const phase = Phase.skipped('Setup', 'Setting up environment', 'Dry run mode');
      expect(phase.status).toBe('skipped');
      expect(phase.error).toBe('Dry run mode');
      expect(phase.isSkipped()).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition from pending to running', () => {
      const pending = Phase.pending('Test', 'Testing');
      const running = pending.start();
      expect(running.status).toBe('running');
      expect(running.isRunning()).toBe(true);
    });

    it('should transition from running to success', () => {
      const running = Phase.pending('Test', 'Testing').start();
      const success = running.succeed(1000);
      expect(success.status).toBe('success');
      expect(success.durationMs).toBe(1000);
    });

    it('should transition from running to failed', () => {
      const running = Phase.pending('Test', 'Testing').start();
      const failed = running.fail('Something went wrong', 500);
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Something went wrong');
      expect(failed.durationMs).toBe(500);
    });

    it('should transition to skipped', () => {
      const pending = Phase.pending('Test', 'Testing');
      const skipped = pending.skip('Not needed');
      expect(skipped.status).toBe('skipped');
      expect(skipped.error).toBe('Not needed');
    });
  });

  describe('completion checks', () => {
    it('should identify complete phases', () => {
      expect(Phase.completed('Test', 'Testing', 100).isComplete()).toBe(true);
      expect(Phase.skipped('Test', 'Testing').isComplete()).toBe(true);
      expect(Phase.pending('Test', 'Testing').start().fail('error').isComplete()).toBe(true);
    });

    it('should identify incomplete phases', () => {
      expect(Phase.pending('Test', 'Testing').isComplete()).toBe(false);
      expect(Phase.pending('Test', 'Testing').start().isComplete()).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      const phase = Phase.completed('Test', 'Testing', 500);
      expect(phase.formatDuration()).toBe('500ms');
    });

    it('should format seconds', () => {
      const phase = Phase.completed('Test', 'Testing', 5000);
      expect(phase.formatDuration()).toBe('5s');
    });

    it('should format minutes and seconds', () => {
      const phase = Phase.completed('Test', 'Testing', 125000);
      expect(phase.formatDuration()).toBe('2m 5s');
    });

    it('should return dash for undefined duration', () => {
      const phase = Phase.pending('Test', 'Testing');
      expect(phase.formatDuration()).toBe('-');
    });
  });
});

describe('NarrativePhases', () => {
  describe('createNarrativePhases', () => {
    it('should create empty narrative structure', () => {
      const narrative = createNarrativePhases();
      expect(narrative.setup).toEqual([]);
      expect(narrative.action).toEqual([]);
      expect(narrative.transition).toEqual([]);
      expect(narrative.verification).toEqual([]);
    });
  });

  describe('flattenPhases', () => {
    it('should flatten all phases into a single array', () => {
      const narrative = createNarrativePhases();
      narrative.setup.push(Phase.pending('Setup1', 'Desc1'));
      narrative.action.push(Phase.pending('Action1', 'Desc2'));
      narrative.transition.push(Phase.pending('Transition1', 'Desc3'));
      narrative.verification.push(Phase.pending('Verify1', 'Desc4'));

      const flat = flattenPhases(narrative);
      expect(flat.length).toBe(4);
      expect(flat[0].name).toBe('Setup1');
      expect(flat[1].name).toBe('Action1');
      expect(flat[2].name).toBe('Transition1');
      expect(flat[3].name).toBe('Verify1');
    });

    it('should handle empty narrative', () => {
      const narrative = createNarrativePhases();
      const flat = flattenPhases(narrative);
      expect(flat).toEqual([]);
    });
  });
});
