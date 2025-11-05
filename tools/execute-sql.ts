import { SqlDatabase } from "@langchain/classic/sql_db";
import { tool } from "langchain";
import { DataSource } from "typeorm";
import { z } from "zod";

/**
 * Database
 * - Make sure ../Chinook.db exists
 * - TypeORM DataSource + SqlDatabase
 */
const datasource = new DataSource({
  type: "sqlite",
  database: "../Chinook.db",
});

const db = await SqlDatabase.fromDataSourceParams({ appDataSource: datasource });

/**
 * Tool (function-first signature; matches LangChain umbrella API)
 * - No runtime context required; closes over `db`
 */
const executeSQL = tool(
  async ({ query }: { query: string }) => {
    try {
      return await db.run(query);
    // deno-lint-ignore no-explicit-any
    } catch (e: any) {
      return `Error: ${e?.message ?? String(e)}`;
    }
  },
  {
    name: "execute_sql",
    description: "Execute a READ-ONLY SQLite SELECT query and return results.",
    schema: z.object({ query: z.string() }),
  }
);

export default executeSQL;
