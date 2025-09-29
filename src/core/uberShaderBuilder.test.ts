import { describe, expect, it } from 'vitest';
import { UberShaderBuilder } from './uberShaderBuilder';

describe('UberShaderBuilder', () => {
  it('concatenates modules with headers', () => {
    const builder = new UberShaderBuilder();
    builder.addModule({
      name: 'geometry',
      header: '#define ENABLE_GEOMETRY',
      body: 'vec4 loadGeometry() { return vec4(0.0); }'
    });
    builder.addModule({
      name: 'projection',
      body: 'vec3 project(vec4 v) { return v.xyz; }'
    });

    const result = builder.build();
    expect(result).toContain('#define ENABLE_GEOMETRY');
    expect(result).toContain('module: projection');
  });
});
