/* Type declarations for the CDN-loaded Teachable Machine Pose bundle
   (window.tmPose), which ships without its own TypeScript types.

   API reference (official sample):
     const model = await tmPose.load(URL + "model.json");
     const webcam = new tmPose.Webcam(width, height, flip);
     await webcam.setup(); await webcam.play();
     webcam.update();
     const { pose, posenetOutput } = await webcam.estimatePose(webcam.canvas);
     const predictions = await model.predict(posenetOutput);
     // -> Array<{ className: string; probability: number }>  (may be sorted)
*/

export interface TmPosePrediction {
  className: string;
  probability: number;
}

export interface TmPoseModel {
  predict(posenetOutput: unknown): Promise<TmPosePrediction[]>;
  metadata?: { labels?: string[] };
}

export interface TmPoseWebcam {
  canvas: HTMLCanvasElement;
  setup(): Promise<void>;
  play(): Promise<void>;
  stop(): void;
  update(): void;
  estimatePose(
    source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement
  ): Promise<{ pose: unknown; posenetOutput: unknown }>;
}

declare global {
  interface Window {
    tmPose: {
      load(url: string): Promise<TmPoseModel>;
      Webcam: new (width: number, height: number, flip?: boolean) => TmPoseWebcam;
    };
  }
  const tmPose: Window["tmPose"];
}

export {};
