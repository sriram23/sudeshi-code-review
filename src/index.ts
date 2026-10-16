#!/usr/bin/env node

import { runCLI } from './cli.js';

await runCLI(process.argv.slice(2));
