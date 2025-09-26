export interface ShaderModule {
  name: string;
  header?: string;
  body: string;
}

export class UberShaderBuilder {
  private readonly modules: ShaderModule[] = [];

  addModule(module: ShaderModule) {
    this.modules.push(module);
  }

  build(): string {
    const header = this.modules.map(module => module.header ?? '').join('\n');
    const body = this.modules.map(module => `// module: ${module.name}\n${module.body}`).join('\n\n');
    return `${header}\n${body}`.trim();
  }
}
