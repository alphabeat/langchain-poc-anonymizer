import { tool } from "langchain";
import { z } from "zod";


const piiSchema = z.object({
  name: z.string().optional().describe('The name of a person'),
  email: z.string().optional().describe('The email of a person'),
  address: z.string().optional().describe('The physical address of a person'),
  phone: z.string().optional().describe('The phone number of a person'),
  company: z.string().optional().describe('The company a person works at'),
});

const locationSchema = z.object({
  name: z.string().optional().describe('The name of a location'),
  address: z.string().optional().describe('The physical address of a location'),
  company: z.string().optional().describe('The corporate name of a location'),
  city: z.string().optional().describe('The city of a location'),
});

const schema = z.object({
  pii: z.array(piiSchema).describe("All PII grouped by name"),
  locations: z.array(locationSchema).describe("All locations grouped by name"),
});

const extractPII = tool(({ input }: { input: string }) => `
  Extract all Personally Identifiable Information (PII) from the following text:

  ${input}
`, {
  name: "extract_pii",
  description: "Extract all Personally Identifiable Information (PII) from a given text",
  schema: z.object({ input: z.string() }),
});

export default extractPII;
