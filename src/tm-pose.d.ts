/* Type declarations for the CDN-loaded Teachable Machine Pose bundle
   (window.tmPose), which ships without its own TypeScript types.

   API reference (official sample):
     const model = await tmPose.load(URL + "model.json");
     // -> also fetches URL + "metadata.json" internally
     const { posenetOutput } = await model.estimatePose(videoElement);
     const predictions = await model.predict(posenetOutput);
     // -> Array<{ className: string; probability: number }>  (may be sorted)
     model.getClassLabels() -> string[]  (e.g. ["Class 1", ..., "Class 4"])
*/

export interface TmPosePrediction {
  className: string;
  probability: number;
}

export interface TmPoseModel {
  predict(posenetOutput: unknown): Promise<TmPosePrediction[]>;
  estimatePose(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<{ pose: unknown; posenetOutput: unknown }>;
  getClassLabels(): string[];
  metadata?: { labels?: string[] };
}

declare global {
  interface Window {
    tmPose: {
      load(url: string): Promise<TmPoseModel>;
    };
  }
  const tmPose: Window["tmPose"];
}

export {};
