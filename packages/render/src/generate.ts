import type { TemplateId } from "@artmint/common";
import { renderFlowFields } from "./templates/flow-fields";
import { renderJazzNoir } from "./templates/jazz-noir";

interface GenerateInput {
  templateId: TemplateId;
  seed: number;
  palette: string[];
  params: Record<string, unknown>;
}

/**
 * Generate deterministic SVG from input parameters.
 * This is the canonical renderer — same input always produces same SVG.
 */
export function generateSVG(input: GenerateInput): string {
  switch (input.templateId) {
    case "flow_fields":
      return renderFlowFields({
        seed: input.seed,
        palette: input.palette,
        params: input.params as Parameters<typeof renderFlowFields>[0]["params"],
      });
    case "jazz_noir":
      return renderJazzNoir({
        seed: input.seed,
        palette: input.palette,
        params: input.params as Parameters<typeof renderJazzNoir>[0]["params"],
      });
    case "custom_code":
      throw new Error("custom_code template cannot be rendered server-side");
    default: {
      const _exhaustive: never = input.templateId;
      throw new Error(`Unknown template: ${_exhaustive}`);
    }
  }
}
