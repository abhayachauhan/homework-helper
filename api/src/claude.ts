import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { MODEL, getProfile } from "./config.js";
import { buildSystemPrompt, buildUserInstruction, type TutorInput } from "./prompts.js";
import { parseTutorResult, TutorValidationError } from "./tutorResult.js";
import type { TutorResult } from "./types.js";

export interface RunArgs {
  system: string;
  userText: string;
  image?: { base64: string; mediaType: string };
}
export type QueryRunner = (args: RunArgs) => Promise<string>;

/** Pull the first balanced JSON object out of model text (handles ```json fences / stray prose). */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return body.trim();
  return body.slice(start, end + 1);
}

/** Real runner: one Agent SDK call, no tools, single turn. */
export const callModelOnce: QueryRunner = async ({ system, userText, image }) => {
  // When an image is present the prompt must be an AsyncIterable<SDKUserMessage>
  // (a plain string cannot carry image content blocks).
  // @anthropic-ai/sdk is bundled inside claude-agent-sdk and not a separate
  // installable package, so we cannot import MessageParam / ContentBlockParam
  // directly. We cast the content array to the expected shape instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyContent = any;

  let prompt: string | AsyncIterable<SDKUserMessage>;

  if (image) {
    const imageContent: AnyContent[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.base64,
        },
      },
      { type: "text", text: userText },
    ];

    const userMsg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: imageContent as AnyContent },
      parent_tool_use_id: null,
      session_id: "",
    };

    prompt = (async function* (): AsyncGenerator<SDKUserMessage> {
      yield userMsg;
    })();
  } else {
    prompt = userText;
  }

  let text = "";
  for await (const msg of query({
    prompt,
    options: {
      model: MODEL,
      systemPrompt: system,
      maxTurns: 1,
      tools: [], // disable ALL built-in tools — this is a pure inference call, never an agentic one
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          text += block.text;
        }
      }
    }
  }
  return text;
};

export async function tutor(input: TutorInput, run: QueryRunner = callModelOnce): Promise<TutorResult> {
  const profile = getProfile(input.profileId);
  if (!profile) throw new Error(`unknown profile: ${input.profileId}`);

  const system = buildSystemPrompt(profile);
  const userText = buildUserInstruction(profile, input);
  const image = input.kind === "image" ? { base64: input.imageBase64, mediaType: input.mediaType } : undefined;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await run({ system, userText, image });
    try {
      return parseTutorResult(JSON.parse(extractJson(raw)));
    } catch (err) {
      lastErr = err instanceof SyntaxError ? new TutorValidationError(`model returned non-JSON: ${err.message}`) : err;
      if (!(lastErr instanceof TutorValidationError)) throw lastErr;
    }
  }
  throw lastErr;
}
