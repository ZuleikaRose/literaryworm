# literaryworm

LiteraryWorm from the command line. Everything here only reads: nothing can change an account.

```bash
npx literaryworm search pride and prejudice   # the catalog, no log-in needed
npx literaryworm book pride-and-prejudice
npx literaryworm pricing
npx literaryworm whats-new

npx literaryworm login       # opens LiteraryWorm in your browser; allow it with your account password
npx literaryworm library --status reading
npx literaryworm highlights dracula
npx literaryworm stats --days 30
npx literaryworm logout
```

Add `--json` to any command for the raw answer. Needs Node 18 or later; no dependencies.

## What it can read

After `login`, this computer can read your library and how far through each book you are, your
highlights and their notes, and reading time for grown-up and teen profiles. It never sees your
password, payment details or a Kids profile's reading time, and books read on Kids profiles are
left out.

The connection is kept in one file readable only by you (`~/.config/literaryworm/credentials.json`,
or `%APPDATA%\literaryworm\credentials.json` on Windows). `logout` ends it, and so does
**Account → Sign-in → Connected apps** on literaryworm.com. A connection unused for 90 days ends on
its own.

## AI assistants (MCP)

The same tools are an MCP server (Streamable HTTP). `npx literaryworm mcp` prints how to add it:

- `https://www.literaryworm.com/mcp`: members; the assistant opens your browser so you can allow it.
- `https://www.literaryworm.com/mcp/public`: no log-in; the catalog, pricing and What's new.

## Developing

`npm test` runs the Jest tests (the network is stubbed). `LITERARYWORM_URL` points the tool at
another copy, such as the dev branch's function:
`LITERARYWORM_URL=https://<ref>.supabase.co/functions/v1/mcp`. The server is
`supabase/functions/mcp` in this repository.

Publishing: `npm publish` from this folder (the package is `literaryworm`). Help, What's new and
`llms.txt` tell members to run `npx literaryworm`, so publish before a release that mentions it.
