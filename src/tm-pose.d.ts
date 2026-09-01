/* Ambient module declaration for @teachablemachine/pose (npm).
   Guarantees stable typings for the subset of the API the game uses. */

declare module "@teachablemachine/pose" {
  export interface PosePrediction {
    className: string;
    probability: number;
  }

  export interface CustomPoseNetModel {
    metadata?: { labels?: string[]; [key: string]: unknown };
    getMaxClasses?(): number;
    estimatePose(
      sample: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
    ): Promise<{ pose: unknown; posenetOutput: Float32Array }>;
    predict(posenetOutput: Float32Array): Promise<PosePrediction[]>;
  }

  export function load(modelUrl: string, metadataUrl?: string): Promise<CustomPoseNetModel>;
}
