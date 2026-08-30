/* Ambient module declaration for @teachablemachine/pose (npm).
   Guarantees stable typings for the subset of the API the game uses,
   regardless of the type files shipped inside the package. */

declare module "@teachablemachine/pose" {
  export interface PosePrediction {
    className: string;
    probability: number;
  }

  export interface CustomPoseMetadata {
    labels?: string[];
    [key: string]: unknown;
  }

  export interface CustomPoseNetModel {
    metadata?: CustomPoseMetadata;
    getMaxClasses?(): number;
    estimatePose(
      sample: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
    ): Promise<{ pose: unknown; posenetOutput: Float32Array }>;
    predict(posenetOutput: Float32Array): Promise<PosePrediction[]>;
  }

  export function load(
    modelUrl: string,
    metadataUrl?: string
  ): Promise<CustomPoseNetModel>;
}
