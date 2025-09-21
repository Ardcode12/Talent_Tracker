// src/ai/modelVersioning.ts
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-node';

interface ModelVersion {
  version: string;
  createdAt: Date;
  metrics: {
    accuracy: number;
    mae: number;
  };
  isActive: boolean;
}

export class ModelVersionManager {
  private versionsPath = path.join(__dirname, '../../models/versions');
  private versionManifestPath = path.join(this.versionsPath, 'manifest.json');
  
  constructor() {
    this.ensureDirectories();
  }
  
  private ensureDirectories() {
    if (!fs.existsSync(this.versionsPath)) {
      fs.mkdirSync(this.versionsPath, { recursive: true });
    }
  }
  
  async saveNewVersion(model: tf.LayersModel, metrics: any): Promise<string> {
    const version = `v${Date.now()}`;
    const versionPath = path.join(this.versionsPath, version);
    
    // Save model
    await model.save(`file://${versionPath}`);
    
    // Update manifest
    const manifest = this.loadManifest();
    
    // Deactivate previous versions
    manifest.forEach(v => v.isActive = false);
    
    // Add new version
    manifest.push({
      version,
      createdAt: new Date(),
      metrics,
      isActive: true
    });
    
    this.saveManifest(manifest);
    
    return version;
  }
  
  async loadActiveModel(): Promise<{ model: tf.LayersModel, version: string }> {
    const manifest = this.loadManifest();
    const activeVersion = manifest.find(v => v.isActive);
    
    if (!activeVersion) {
      throw new Error('No active model version found');
    }
    
    const modelPath = path.join(this.versionsPath, activeVersion.version, 'model.json');
    const model = await tf.loadLayersModel(`file://${modelPath}`);
    
    return { model, version: activeVersion.version };
  }
  
  private loadManifest(): ModelVersion[] {
    if (!fs.existsSync(this.versionManifestPath)) {
      return [];
    }
    
    return JSON.parse(fs.readFileSync(this.versionManifestPath, 'utf8'));
  }
  
  private saveManifest(manifest: ModelVersion[]) {
    fs.writeFileSync(
      this.versionManifestPath,
      JSON.stringify(manifest, null, 2)
    );
  }
}

