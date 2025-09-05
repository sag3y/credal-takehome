# Credal.ai Take-Home

Hello! Super excited to work on this takehome project. This repo contains my solution for the Credal.ai take-home project. It includes a TypeScript script that parses requests from a CSV file, calls the OpenAI API, and prints results to the console.

## Setup
```bash
npm install

### Prereqs
- Node.js
- npm

### Environment Variables
Add your key to the `.env` file in the project root

## Running the script

```bash
npx tsx example-main.ts
```

## What to Expect
- The script loads and parses `requests.csv`.
- Each row is processed and, if an API key is available, sent to OpenAI
- Output is printed to the console

---

## CSV Format
The CSV must have a header row with `system_prompt` and `prompt`:

```csv
system_prompt,prompt
"Act as a personal assistant helping me draft a professional email response.","Please draft a response..."
"Pretend to be a HR manager preparing an onboarding package.","Create a welcome message..."
```

## File Map
- `example-main.ts` — main entry point.  
- `requests.csv` — sample input.  
- `.env` — environment file (not committed).  
- `tsconfig.json` — TypeScript config.  
- `README.md` — setup and run instructions.  
- `IMPLEMENTATION_NOTES.md` — design decisions and next steps.