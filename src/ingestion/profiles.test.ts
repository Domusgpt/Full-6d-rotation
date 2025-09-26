import { describe, expect, it } from 'vitest';
import { AVAILABLE_PROFILES, DEFAULT_PROFILE, getProfileById } from './profiles';

describe('profiles', () => {
  it('exposes the default profile in the registry', () => {
    const profile = getProfileById(DEFAULT_PROFILE.id);
    expect(profile?.name).toBe(DEFAULT_PROFILE.name);
  });

  it('returns undefined for unknown profile ids', () => {
    expect(getProfileById('missing-profile')).toBeUndefined();
  });

  it('lists profiles in a deterministic order', () => {
    const ids = AVAILABLE_PROFILES.map(profile => profile.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
