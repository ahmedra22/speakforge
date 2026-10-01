import { validateContent } from '../src/content/validate/validate-content.js';

const result = await validateContent();
for (const message of result.warnings) console.warn(`WARNING ${message}`);
for (const message of result.errors) console.error(`ERROR ${message}`);
if (result.errors.length) {
  console.error(`Content validation failed: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  process.exitCode = 1;
} else {
  console.log(`Content validation passed: ${result.unitCount} units in ${result.sourceSetCount} available content sources (${result.catalogBookCount} catalog books total); ${result.warnings.length} warning(s).`);
}
