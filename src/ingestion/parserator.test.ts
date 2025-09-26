import { describe, expect, it, vi } from 'vitest';
import type { ImuPacket } from './imuMapper';
import { Parserator, gravityIsolation } from './parserator';
import type { PlaneMappingProfile } from './profiles';

const basePacket: ImuPacket = {
  timestamp: 1_000,
  gyro: [0.5, -0.25, 0.75],
  accel: [0.1, 0.2, 0.3],
  confidence: 0.2
};

const identityProfile: PlaneMappingProfile = {
  id: 'identity',
  name: 'Identity passthrough',
  spatial: [
    { axis: 'x', plane: 'xy', gain: 1, smoothing: 0 },
    { axis: 'y', plane: 'xz', gain: 1, smoothing: 0 },
    { axis: 'z', plane: 'yz', gain: 1, smoothing: 0 }
  ],
  hyperspatial: [
    { axis: 'x', plane: 'xw', gain: 1, smoothing: 0 },
    { axis: 'y', plane: 'yw', gain: 1, smoothing: 0 },
    { axis: 'z', plane: 'zw', gain: 1, smoothing: 0 }
  ]
};

describe('Parserator', () => {
  it('applies preprocessors and enforces the confidence floor', () => {
    const parserator = new Parserator({ profile: identityProfile, confidenceFloor: 0.6 });
    const preprocessor = vi.fn((packet: ImuPacket) => ({
      ...packet,
      gyro: [1, 2, 3]
    }));
    parserator.registerPreprocessor(preprocessor, { id: 'mock-preprocessor' });

    const listener = vi.fn();
    parserator.onSnapshot(listener);

    parserator.ingest(basePacket);

    expect(preprocessor).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = listener.mock.calls[0][0];
    expect(snapshot.xy).toBeCloseTo(1, 6);
    expect(snapshot.xz).toBeCloseTo(2, 6);
    expect(snapshot.yz).toBeCloseTo(3, 6);
    expect(snapshot.confidence).toBeCloseTo(0.6, 6);
  });

  it('supports unregistering preprocessors via disposer', () => {
    const parserator = new Parserator({ profile: identityProfile });
    const preprocessor = vi.fn((packet: ImuPacket) => packet);
    const registration = parserator.registerPreprocessor(preprocessor, { id: 'disposable' });

    parserator.ingest({ ...basePacket, timestamp: 2_000 });
    registration.dispose();
    parserator.ingest({ ...basePacket, timestamp: 3_000 });

    expect(preprocessor).toHaveBeenCalledTimes(1);
    expect(parserator.listPreprocessors()).not.toContain('disposable');
  });

  it('switches mapping profiles at runtime', () => {
    const parserator = new Parserator({ profile: identityProfile });
    const listener = vi.fn();
    parserator.onSnapshot(listener);

    parserator.ingest({ ...basePacket, timestamp: 4_000 });

    const remappedProfile: PlaneMappingProfile = {
      id: 'remap',
      name: 'Remapped planes',
      spatial: [
        { axis: 'x', plane: 'yz', gain: 2, smoothing: 0 },
        { axis: 'y', plane: 'xy', gain: 0.5, smoothing: 0 },
        { axis: 'z', plane: 'xz', gain: 1.5, smoothing: 0 }
      ],
      hyperspatial: identityProfile.hyperspatial
    };

    parserator.setProfile(remappedProfile);
    listener.mockClear();

    const packet: ImuPacket = {
      timestamp: 5_000,
      gyro: [0.4, -0.6, 0.2],
      accel: [0.3, 0.1, 0.5]
    };

    parserator.ingest(packet);

    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = listener.mock.calls[0][0];
    expect(snapshot.yz).toBeCloseTo(0.8, 6);
    expect(snapshot.xy).toBeCloseTo(-0.3, 6);
    expect(snapshot.xz).toBeCloseTo(0.3, 6);
  });

  it('allows updating the confidence floor dynamically', () => {
    const parserator = new Parserator({ profile: identityProfile, confidenceFloor: 0.1 });
    const listener = vi.fn();
    parserator.onSnapshot(listener);

    parserator.ingest({ ...basePacket, confidence: 0.05, timestamp: 6_000 });
    parserator.setConfidenceFloor(0.9);
    parserator.ingest({ ...basePacket, confidence: 0.2, timestamp: 7_000 });

    const [, second] = listener.mock.calls;
    expect(second[0].confidence).toBeCloseTo(0.9, 6);
  });

  it('composes preprocessors with gravity isolation helper', () => {
    const parserator = new Parserator({ profile: identityProfile });
    const listener = vi.fn();
    parserator.onSnapshot(listener);

    parserator.registerPreprocessor(gravityIsolation(0.5), { id: 'gravity' });

    const packet: ImuPacket = {
      timestamp: 8_000,
      gyro: [0, 0, 0],
      accel: [0, 0, 1]
    };

    parserator.ingest(packet);

    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = listener.mock.calls[0][0];
    expect(snapshot.xw).toBeCloseTo(0, 6);
    expect(snapshot.yw).toBeCloseTo(0, 6);
    expect(snapshot.zw).toBeCloseTo(0.5, 6);
    expect(parserator.listPreprocessors()).toContain('gravity');
  });

  it('reports current profile metadata and confidence floor', () => {
    const parserator = new Parserator({ profile: identityProfile, confidenceFloor: 0.42 });
    expect(parserator.getProfile().id).toBe('identity');
    expect(parserator.getConfidenceFloor()).toBeCloseTo(0.42);

    const alternate: PlaneMappingProfile = {
      id: 'alternate',
      name: 'Alternate Profile',
      spatial: identityProfile.spatial,
      hyperspatial: identityProfile.hyperspatial
    };

    parserator.setProfile(alternate);
    parserator.setConfidenceFloor(0.73);

    expect(parserator.getProfile().id).toBe('alternate');
    expect(parserator.getConfidenceFloor()).toBeCloseTo(0.73);
  });
});
