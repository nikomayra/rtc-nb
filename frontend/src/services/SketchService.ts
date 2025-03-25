import { Sketch } from "../types/interfaces";
import { sketchApi } from "../api/sketchApi";

const DEBUG = true;

interface SketchCache {
  sketches: Map<string, Sketch>;
  lastFetch: Map<string, number>;
}

export class SketchService {
  private static instance: SketchService | null = null;
  private cache: SketchCache = {
    sketches: new Map(),
    lastFetch: new Map(),
  };

  private constructor() {}

  static getInstance(): SketchService {
    if (!this.instance) {
      this.instance = new SketchService();
    }
    return this.instance;
  }

  // Cache management
  private getCachedSketch(sketchId: string): Sketch | null {
    const sketch = this.cache.sketches.get(sketchId);
    const lastFetch = this.cache.lastFetch.get(sketchId);

    // Cache for 5 minutes
    if (sketch && lastFetch && Date.now() - lastFetch < 5 * 60 * 1000) {
      if (DEBUG) console.log(`📦 [SketchService] Using cached sketch: ${sketchId}`);
      return sketch;
    }

    return null;
  }

  private cacheSketch(sketch: Sketch) {
    this.cache.sketches.set(sketch.id, sketch);
    this.cache.lastFetch.set(sketch.id, Date.now());
    if (DEBUG) console.log(`📦 [SketchService] Cached sketch: ${sketch.id}`);
  }

  // API Methods
  async getSketch(channelName: string, sketchId: string, token: string, forceFetch = false): Promise<Sketch | null> {
    try {
      // Check cache first unless force fetch
      if (!forceFetch) {
        const cached = this.getCachedSketch(sketchId);
        if (cached) return cached;
      }

      if (DEBUG) console.log(`🔍 [SketchService] Fetching sketch: ${sketchId}`);

      const sketch = await sketchApi.getSketch(channelName, sketchId, token);
      if (sketch) {
        this.cacheSketch(sketch);
      }
      return sketch;
    } catch (error) {
      console.error(`❌ [SketchService] Failed to fetch sketch:`, error);
      throw error;
    }
  }

  async createSketch(
    channelName: string,
    displayName: string,
    width: number,
    height: number,
    token: string
  ): Promise<Sketch | null> {
    try {
      if (DEBUG) console.log(`📝 [SketchService] Creating sketch: ${displayName}`);

      await sketchApi.createSketch(channelName, displayName, width, height, token);

      // Fetch the newly created sketch by getting the updated sketch list
      const sketches = await this.getSketches(channelName, token);
      const newSketch = sketches.find((s) => s.displayName === displayName);

      if (newSketch) {
        this.cacheSketch(newSketch);
      }

      return newSketch || null;
    } catch (error) {
      console.error(`❌ [SketchService] Failed to create sketch:`, error);
      throw error;
    }
  }

  async deleteSketch(sketchId: string, token: string): Promise<void> {
    try {
      if (DEBUG) console.log(`🗑️ [SketchService] Deleting sketch: ${sketchId}`);

      await sketchApi.deleteSketch(sketchId, token);

      // Clear from cache
      this.cache.sketches.delete(sketchId);
      this.cache.lastFetch.delete(sketchId);
    } catch (error) {
      console.error(`❌ [SketchService] Failed to delete sketch:`, error);
      throw error;
    }
  }

  async clearSketch(channelName: string, sketchId: string, token: string): Promise<void> {
    try {
      if (DEBUG) console.log(`🧹 [SketchService] Clearing sketch: ${sketchId}`);

      await sketchApi.clearSketch(channelName, sketchId, token);

      // Update cache
      const sketch = this.cache.sketches.get(sketchId);
      if (sketch) {
        sketch.regions = {};
        this.cacheSketch(sketch);
      }
    } catch (error) {
      console.error(`❌ [SketchService] Failed to clear sketch:`, error);
      throw error;
    }
  }

  async getSketches(channelName: string, token: string): Promise<Sketch[]> {
    try {
      if (DEBUG) console.log(`📋 [SketchService] Fetching sketches for channel: ${channelName}`);

      const sketches = await sketchApi.getSketches(channelName, token);

      sketches.forEach((sketch: Sketch) => this.cacheSketch(sketch));
      return sketches;
    } catch (error) {
      console.error(`❌ [SketchService] Failed to fetch sketches:`, error);
      throw error;
    }
  }

  // Cache management methods
  clearCache() {
    if (DEBUG) console.log(`🧹 [SketchService] Clearing cache`);
    this.cache.sketches.clear();
    this.cache.lastFetch.clear();
  }

  invalidateSketch(sketchId: string) {
    if (DEBUG) console.log(`🔄 [SketchService] Invalidating cache for sketch: ${sketchId}`);
    this.cache.sketches.delete(sketchId);
    this.cache.lastFetch.delete(sketchId);
  }
}
