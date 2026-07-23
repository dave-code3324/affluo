import { detectionConfig } from "@/modules/detection/config";
import { BodaccSource } from "@/modules/detection/sources/bodacc";
import { BodaccDemoSource } from "@/modules/detection/sources/demo";
import type { ProspectSource } from "@/modules/detection/types";

export type DetectionSourceRegistration = {
  source: ProspectSource;
  enabled: boolean;
  intervalMinutes: number;
  isDemo: boolean;
};

const registrations: DetectionSourceRegistration[] = [
  {
    source: new BodaccSource(),
    enabled: detectionConfig.bodacc.enabled,
    intervalMinutes: detectionConfig.bodacc.intervalMinutes,
    isDemo: false,
  },
  {
    source: new BodaccDemoSource(),
    enabled: detectionConfig.demo.enabled,
    intervalMinutes: detectionConfig.demo.intervalMinutes,
    isDemo: true,
  },
];

export function detectionSources() {
  return registrations;
}

export function detectionSource(sourceKey: string) {
  return registrations.find(({ source }) => source.key === sourceKey) ?? null;
}
