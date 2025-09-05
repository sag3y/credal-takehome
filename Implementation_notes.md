# Implementation Notes

## What the Program Does
1. Loads `requests.csv`
2. Parses each row into `{ system_prompt, prompt }`
3. If an OpenAI API key is provided, sends those prompts to the API
4. Prints results to the console with logging and minimal error handling

## Key Decisions

### CSV Parsing
- Used `csv-parse/sync` because it’s simple for small files
- Required headers (`system_prompt`, `prompt`) so that the program exits with an error if missing

### TypeScript Setup
- Chose `NodeNext` for module resolution so imports like `csv-parse/sync` work
- Enabled `esModuleInterop` for smoother ESM interoperability

### Environment Variables
- API key is read from `.env`, to keep secrets out of versions 
- If key isn’t present, the script runs in a dry-run mode where parsing still works but the API calls are skipped

### Logging & Error Handling
- Console output shows how many rows were loaded, which request is being processed, and the result
- Each row is handled independently so one bad row won’t break the whole run

## Improvements If I Had More Time
- It would be nice to have a basic schema validation for cleaner error messages on malformed rows 
- Have more structured output formats, it can be hard to read such verbose logs
- Handle retries and rate limits for more reliable API usage. I found that alot of text cut off or looked weird because of so many requests

## Tradeoffs
- Synchronous CSV parsing is simple and fine for small files but streaming would scale better for larger datasets.  
- Minimal dependencies is easier setup but fewer features and there is alot of potential ones that could be added
- Console output was quickest to implement but writing to files would make results alot easier to reuse and cleaner

