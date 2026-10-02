import { seedSql } from "../src/seed.ts";

process.stdout.write(seedSql(Date.now()));
