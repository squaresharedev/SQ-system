import { describe, expect, it } from "vitest";
import {
  AGENT_CONTRACTS,
  STOREFRONT_ENUMS,
  STOREFRONT_FIELD_META,
  STOREFRONT_LIMITS,
  describeContract,
  type AgentContractName,
} from "../src/agent-meta.js";
import { OBJECT_KEY_PATTERN } from "../src/object-key.js";

const names = Object.keys(AGENT_CONTRACTS) as AgentContractName[];

describe("describeContract", () => {
  // z.toJSONSchema() throws on constructs it cannot represent, and the
  // contracts carry .refine()/.preprocess() layers. Every contract must stay
  // describable or the agent surface breaks silently.
  it.each(names)("describes %s without throwing", (name) => {
    const described = describeContract(name);
    expect(described.contract).toBe(name);
    expect(described.jsonSchema).toBeTypeOf("object");
    expect(described.jsonSchema).not.toBeNull();
  });

  it("attaches field metadata, limits and enums to storefront_config only", () => {
    const config = describeContract("storefront_config");
    expect(config.fields).toBe(STOREFRONT_FIELD_META);
    expect(config.limits).toBe(STOREFRONT_LIMITS);
    expect(config.enums).toBe(STOREFRONT_ENUMS);

    for (const name of names.filter((n) => n !== "storefront_config")) {
      const described = describeContract(name);
      expect(described.fields).toBeUndefined();
      expect(described.limits).toBeUndefined();
      expect(described.enums).toBeUndefined();
    }
  });

  // The point of the introspection layer is that discovery and enforcement
  // cannot disagree. An agent reading the artifact contract must be able to
  // see the object-key gate, not discover it by having a write rejected.
  it("publishes the object-key gate for artifact.imageKey", () => {
    const described = describeContract("artifact");
    const imageKey = (
      described.jsonSchema as {
        properties: Record<string, { pattern?: string; maxLength?: number }>;
      }
    ).properties.imageKey;

    expect(imageKey.pattern).toBeDefined();
    // Same gate the write path enforces, not a copy that could drift.
    expect(new RegExp(imageKey.pattern!).source).toBe(OBJECT_KEY_PATTERN.source);
  });
});
