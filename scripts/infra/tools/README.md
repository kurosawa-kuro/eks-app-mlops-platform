# Tools

This directory contains **human-operated tools**.

These are not part of the Clean Architecture / UseCase flow and are not intended for CI or automation.

## Structure

```
tools/
├── aws/           # AWS service inspection tools
│   ├── cognito.ts
│   ├── ec2.ts
│   ├── ecr.ts
│   ├── eks.ts
│   ├── firehose.ts
│   ├── s3.ts
│   └── secrets.ts
├── bastion/       # Interactive bastion connection
│   └── connect.ts
├── kubernetes/    # K8s debugging tools
│   ├── debug.ts
│   └── kind.ts
└── setup/         # Environment setup
    └── prerequisites.ts
```

## Usage

```bash
# Direct execution
npx tsx tools/aws/eks.ts

# Or via npm scripts (if configured)
npm run tool:eks
```

## Key Differences from interface/cli

| Aspect | interface/cli | tools |
|--------|--------------|-------|
| Purpose | Formal operations | Ad-hoc inspection |
| CI/CD | Yes | No |
| UseCase | Required | Not applicable |
| Logging | Structured | Console only |
| Error handling | Comprehensive | Best-effort |
