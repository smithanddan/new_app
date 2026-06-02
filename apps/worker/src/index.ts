import "dotenv/config";
import { Command } from "commander";
import { runSource } from "./jobs/runSource.js";

const program = new Command();

program
  .name("web-monitor-worker")
  .description("Run scraping jobs for enabled sources")
  .option("--source-id <id>", "Run only one source")
  .action(async (options) => {
    await runSource(options.sourceId);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
